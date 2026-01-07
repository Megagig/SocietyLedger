import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { PaystackService } from '../payments/paystack/paystack.service';
import { z } from 'zod';

// Validation schema
const purchaseCreditsSchema = z.object({
  credits: z.number().int().positive().min(50, 'Minimum 50 credits required'),
  packageId: z.string().optional(),
});

export const smsCreditsController = {
  /**
   * Initialize SMS credits purchase
   * POST /api/communication/sms/credits/purchase
   */
  async purchaseCredits(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Association ID and User ID are required' 
        });
      }

      const validatedData = purchaseCreditsSchema.parse(req.body);

      // Calculate amount (₦50 per credit)
      const pricePerCredit = 50;
      const amount = validatedData.credits * pricePerCredit;

      // Generate unique reference
      const reference = PaystackService.generateReference('SMS');

      // Convert amount to kobo
      const amountInKobo = PaystackService.nairaToKobo(amount);

      // Get user email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user || !user.email) {
        return res.status(400).json({
          success: false,
          message: 'User email is required for payment',
        });
      }

      // Get association details
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { name: true, subdomain: true },
      });

      // Initialize payment with Paystack
      const paystackService = new PaystackService();
      const paystackResponse = await paystackService.initializePayment({
        email: user.email,
        amount: amountInKobo,
        reference,
        callback_url: `${process.env.FRONTEND_URL}/dashboard/communication/sms/credits/verify?reference=${reference}`,
        metadata: {
          associationId,
          userId,
          userName: `${user.firstName} ${user.lastName}`,
          associationName: association?.name,
          credits: validatedData.credits,
          packageId: validatedData.packageId,
          pricePerCredit,
          totalAmount: amount,
          type: 'sms_credits',
        },
      });

      // Create SMS credits purchase record
      await prisma.sMSCreditsPurchase.create({
        data: {
          associationId,
          userId,
          credits: validatedData.credits,
          amount,
          reference,
          status: 'pending',
          provider: 'paystack',
          metadata: {
            packageId: validatedData.packageId,
            accessCode: paystackResponse.data.access_code,
            authorizationUrl: paystackResponse.data.authorization_url,
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'SMS_CREDITS_PURCHASE_INITIATED',
          tableName: 'sms_credits_purchases',
          newValues: {
            reference,
            credits: validatedData.credits,
            amount,
            provider: 'paystack',
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Payment initialized successfully',
        data: {
          reference,
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          credits: validatedData.credits,
          amount,
          amountInKobo,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      console.error('Error initializing SMS credits purchase:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize payment',
      });
    }
  },

  /**
   * Verify SMS credits purchase
   * GET /api/communication/sms/credits/verify/:reference
   */
  async verifyPurchase(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Association ID is required' 
        });
      }

      // Get purchase record
      const purchase = await prisma.sMSCreditsPurchase.findFirst({
        where: { reference, associationId },
      });

      if (!purchase) {
        return res.status(404).json({
          success: false,
          message: 'Purchase not found',
        });
      }

      // If already successful, return cached result
      if (purchase.status === 'success') {
        return res.status(200).json({
          success: true,
          message: 'Payment already verified',
          data: {
            status: 'success',
            reference: purchase.reference,
            credits: purchase.credits,
            amount: purchase.amount.toNumber(),
          },
        });
      }

      // Verify with Paystack
      const paystackService = new PaystackService();
      const verificationResponse = await paystackService.verifyPayment(reference);

      if (!verificationResponse.status || verificationResponse.data.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          data: { status: verificationResponse.data.status },
        });
      }

      // Update purchase and add credits
      await prisma.$transaction([
        // Update purchase status
        prisma.sMSCreditsPurchase.update({
          where: { id: purchase.id },
          data: {
            status: 'success',
            paidAt: new Date(verificationResponse.data.paid_at),
            paystackResponse: verificationResponse as any,
          },
        }),

        // Add credits to association SMS balance
        prisma.sMSCreditBalance.upsert({
          where: { associationId },
          create: {
            associationId,
            balance: purchase.credits,
            totalPurchased: purchase.credits,
            totalUsed: 0,
          },
          update: {
            balance: { increment: purchase.credits },
            totalPurchased: { increment: purchase.credits },
          },
        }),

        // Audit log
        prisma.auditLog.create({
          data: {
            associationId,
            userId: purchase.userId,
            action: 'SMS_CREDITS_ADDED',
            tableName: 'sms_credit_balances',
            newValues: {
              reference: purchase.reference,
              credits: purchase.credits,
              amount: purchase.amount.toNumber(),
              status: 'success',
            },
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: 'Payment verified and credits added successfully',
        data: {
          status: 'success',
          reference: purchase.reference,
          credits: purchase.credits,
          amount: purchase.amount.toNumber(),
          paidAt: verificationResponse.data.paid_at,
        },
      });
    } catch (error: any) {
      console.error('Error verifying SMS credits purchase:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify payment',
      });
    }
  },
};
