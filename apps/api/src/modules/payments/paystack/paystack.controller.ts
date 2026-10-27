import { Request, Response } from 'express';
import { prisma } from '../../../lib/prisma';
import { syncPaymentEffects } from '../../../services/payment-sync.service';
import { userOwnsCharge } from '../charge-ownership';
import { PaystackService } from './paystack.service';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';
import { SettingsService } from '../../settings/settings.service';

// Validation schemas
const initializePaymentSchema = z.object({
  transactionId: z.number().int().positive('Transaction ID is required'),
  callbackUrl: z.string().url().optional(),
});

const verifyPaymentSchema = z.object({
  reference: z.string().min(1, 'Payment reference is required'),
});

export const paystackController = {
  /**
   * Initialize a payment with Paystack
   * POST /api/payments/paystack/initialize
   */
  async initializePayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = initializePaymentSchema.parse(req.body);

      // R4.6/G53: Integrations Settings' paystackEnabled was saved but
      // never read — this is the real decision point (a member paying
      // dues online), unlike subscription billing which is between the
      // association and the platform and stays always-available.
      const paystackEnabled = await SettingsService.getSetting(associationId, 'integrations', 'paystackEnabled');
      if (paystackEnabled === false) {
        return res.status(400).json({
          success: false,
          message: 'Online payment via Paystack is not enabled for this association',
        });
      }

      // Get transaction with member details
      const transaction = await prisma.transaction.findFirst({
        where: { id: validatedData.transactionId, associationId },
        include: {
          member: { select: { id: true, userId: true, firstName: true, lastName: true, email: true } },
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { amountPaid: true } },
        },
      });

      // Only the member the charge belongs to can start an online payment for it (a 404, so nobody learns another member's charge exists).
      if (!transaction || transaction.isVoided || !userOwnsCharge(req.user, transaction.member)) {
        return res.status(404).json({ success: false, message: 'Transaction not found' });
      }

      if (!transaction.member.email) {
        return res.status(400).json({
          success: false,
          message: 'Member email is required for online payment',
        });
      }

      // Calculate outstanding balance
      const totalPaid = transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const balance = new Decimal(transaction.amount).minus(totalPaid);

      if (balance.lessThanOrEqualTo(0)) {
        return res.status(400).json({
          success: false,
          message: 'Transaction is already fully paid',
        });
      }

      // Generate unique reference
      const reference = PaystackService.generateReference('TXN');

      // Convert amount to kobo
      const amountInKobo = PaystackService.nairaToKobo(balance.toNumber());

      // Get association details for callback
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        select: { name: true, subdomain: true },
      });

      // Initialize payment with Paystack
      const paystackService = new PaystackService();
      const paystackResponse = await paystackService.initializePayment({
        email: transaction.member.email,
        amount: amountInKobo,
        reference,
        callback_url: validatedData.callbackUrl || 
          `${process.env.FRONTEND_URL}/dashboard/finance/payments/verify?reference=${reference}`,
        metadata: {
          associationId,
          transactionId: transaction.id,
          memberId: transaction.member.id,
          memberName: `${transaction.member.firstName} ${transaction.member.lastName}`,
          categoryName: transaction.category.name,
          associationName: association?.name,
        },
      });

      // Create gateway transaction record
      const gatewayTransaction = await prisma.paymentGatewayTransaction.create({
        data: {
          associationId,
          transactionId: transaction.id,
          provider: 'paystack',
          reference,
          amount: balance,
          status: 'pending',
          metadata: {
            accessCode: paystackResponse.data.access_code,
            authorizationUrl: paystackResponse.data.authorization_url,
          },
          paystackResponse: paystackResponse as any,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'PAYMENT_INITIALIZED',
          tableName: 'payment_gateway_transactions',
          recordId: gatewayTransaction.id,
          newValues: {
            reference,
            amount: balance.toNumber(),
            provider: 'paystack',
            transactionId: transaction.id,
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
          amount: balance.toNumber(),
          amountInKobo,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error initializing payment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize payment',
      });
    }
  },

  /**
   * Verify a payment after redirect from Paystack
   * GET /api/payments/paystack/verify/:reference
   */
  async verifyPayment(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      if (!reference) {
        return res.status(400).json({ success: false, message: 'Payment reference is required' });
      }

      // Get gateway transaction
      const gatewayTransaction = await prisma.paymentGatewayTransaction.findFirst({
        where: { reference, associationId },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, firstName: true, lastName: true, email: true } },
              category: { select: { name: true, type: true } },
              payments: { select: { amountPaid: true } },
            },
          },
        },
      });

      if (!gatewayTransaction) {
        return res.status(404).json({ success: false, message: 'Payment record not found' });
      }

      // If already processed, return existing status
      if (gatewayTransaction.status === 'success' && gatewayTransaction.webhookReceived) {
        return res.status(200).json({
          success: true,
          message: 'Payment already verified',
          data: {
            status: 'success',
            reference,
            amount: gatewayTransaction.amount.toNumber(),
            transactionId: gatewayTransaction.transactionId,
          },
        });
      }

      // Verify with Paystack
      const paystackService = new PaystackService();
      const verificationResponse = await paystackService.verifyPayment(reference);

      if (!verificationResponse.status) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          data: { reference },
        });
      }

      const paymentData = verificationResponse.data;

      // Check if payment was successful
      if (paymentData.status !== 'success') {
        // Update gateway transaction status
        await prisma.paymentGatewayTransaction.update({
          where: { id: gatewayTransaction.id },
          data: {
            status: paymentData.status,
            paystackResponse: verificationResponse as any,
          },
        });

        return res.status(400).json({
          success: false,
          message: `Payment ${paymentData.status}`,
          data: {
            status: paymentData.status,
            reference,
            gatewayResponse: paymentData.gateway_response,
          },
        });
      }

      // Payment successful - record it
      const amountPaid = PaystackService.koboToNaira(paymentData.amount);

      // Generate unique receipt number with timestamp to avoid collisions
      const timestamp = Date.now().toString().slice(-6);
      const paymentCount = await prisma.payment.count({ where: { associationId } });
      const receiptNumber = `RCP${String(paymentCount + 1).padStart(6, '0')}-${timestamp}`;

      // Calculate new transaction status
      const transaction = gatewayTransaction.transaction!;
      const currentPaid = transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const newPaidTotal = currentPaid.plus(amountPaid);
      const newStatus = newPaidTotal.greaterThanOrEqualTo(transaction.amount) ? 'paid' : 'partial';

      // Atomic update: gateway transaction, payment record, transaction status
      const [, payment] = await prisma.$transaction([
        prisma.paymentGatewayTransaction.update({
          where: { id: gatewayTransaction.id },
          data: {
            status: 'success',
            webhookReceived: true,
            paystackResponse: verificationResponse as any,
          },
        }),
        prisma.payment.create({
          data: {
            associationId,
            transactionId: transaction.id,
            amountPaid,
            paymentDate: new Date(paymentData.paid_at),
            paymentMethod: 'paystack',
            receiptNumber,
            confirmedBy: req.user!.id,
            confirmedAt: new Date(),
          },
        }),
        prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: newStatus,
            paymentDate: newStatus === 'paid' ? new Date() : undefined,
            paymentMethod: 'paystack',
          },
        }),
      ]);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user!.id,
          action: 'PAYMENT_VERIFIED',
          tableName: 'payments',
          recordId: payment.id,
          newValues: {
            reference,
            amount: amountPaid,
            provider: 'paystack',
            transactionId: transaction.id,
            receiptNumber,
          },
        },
      });

      // The member's ledger and the books, through the one shared function every payment route uses.
      await syncPaymentEffects({ paymentId: payment.id }, req.user!.id);

      return res.status(200).json({
        success: true,
        message: 'Payment verified and recorded successfully',
        data: {
          status: 'success',
          reference,
          amount: amountPaid,
          receiptNumber,
          transactionId: transaction.id,
          transactionStatus: newStatus,
          paidAt: paymentData.paid_at,
        },
      });
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify payment',
      });
    }
  },

  /**
   * Get payment status
   * GET /api/payments/paystack/status/:reference
   */
  async getPaymentStatus(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const gatewayTransaction = await prisma.paymentGatewayTransaction.findFirst({
        where: { reference, associationId },
        include: {
          transaction: {
            select: {
              id: true,
              referenceNumber: true,
              amount: true,
              status: true,
              member: { select: { firstName: true, lastName: true } },
              category: { select: { name: true } },
            },
          },
        },
      });

      if (!gatewayTransaction) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      return res.status(200).json({
        success: true,
        data: {
          reference: gatewayTransaction.reference,
          status: gatewayTransaction.status,
          amount: gatewayTransaction.amount.toNumber(),
          provider: gatewayTransaction.provider,
          webhookReceived: gatewayTransaction.webhookReceived,
          transaction: gatewayTransaction.transaction,
          createdAt: gatewayTransaction.createdAt,
        },
      });
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payment status' });
    }
  },
};
