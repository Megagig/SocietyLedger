/**
 * SMS Controller
 * Phase 6.5: SMS & Bulk Communication
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { SMSService } from './sms.service';
import {
  quickSMSSchema,
  createCampaignSchema,
  updateCampaignSchema,
  createTemplateSchema,
  updateTemplateSchema,
  topUpCreditsSchema,
  listMessagesQuerySchema,
  listCampaignsQuerySchema,
  listTemplatesQuerySchema,
} from './sms.validation';
import { prisma } from '../../lib/prisma';

const smsService = new SMSService();

export const smsController = {
  // ============================================
  // Dashboard
  // ============================================

  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const stats = await smsService.getDashboardStats(associationId);

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching SMS dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },

  // ============================================
  // Quick SMS
  // ============================================

  async sendQuickSMS(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = quickSMSSchema.parse(req.body);
      const result = await smsService.sendQuickSMS(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'sms_messages',
          recordId: 0,
          newValues: { 
            recipients: validatedData.recipients.length,
            sent: result.totalSent,
            failed: result.totalFailed,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: `SMS sent to ${result.totalSent} recipients`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error sending quick SMS:', error);
      const message = error instanceof Error ? error.message : 'Failed to send SMS';
      return res.status(500).json({ success: false, message });
    }
  },

  // ============================================
  // Campaigns
  // ============================================

  async createCampaign(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createCampaignSchema.parse(req.body);
      const campaign = await smsService.createCampaign(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'sms_campaigns',
          recordId: campaign.id,
          newValues: campaign,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        data: campaign,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating campaign:', error);
      const message = error instanceof Error ? error.message : 'Failed to create campaign';
      return res.status(500).json({ success: false, message });
    }
  },

  async getCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const campaign = await smsService.getCampaign(associationId, parseInt(id));

      if (!campaign) {
        return res.status(404).json({ success: false, message: 'Campaign not found' });
      }

      return res.status(200).json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
    }
  },

  async listCampaigns(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = listCampaignsQuerySchema.parse(req.query);
      const result = await smsService.listCampaigns(associationId, {
        page: queryParams.page,
        limit: queryParams.limit,
        status: queryParams.status,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing campaigns:', error);
      return res.status(500).json({ success: false, message: 'Failed to list campaigns' });
    }
  },

  async startCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const stats = await smsService.startCampaign(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'sms_campaigns',
          recordId: parseInt(id),
          newValues: { status: 'COMPLETED', ...stats },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Campaign executed successfully',
        data: stats,
      });
    } catch (error) {
      console.error('Error starting campaign:', error);
      const message = error instanceof Error ? error.message : 'Failed to start campaign';
      return res.status(500).json({ success: false, message });
    }
  },

  async cancelCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const campaign = await smsService.cancelCampaign(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'sms_campaigns',
          recordId: parseInt(id),
          newValues: { status: 'CANCELLED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Campaign cancelled successfully',
        data: campaign,
      });
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      const message = error instanceof Error ? error.message : 'Failed to cancel campaign';
      return res.status(500).json({ success: false, message });
    }
  },

  async deleteCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await smsService.deleteCampaign(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'sms_campaigns',
          recordId: parseInt(id),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete campaign';
      return res.status(500).json({ success: false, message });
    }
  },


  // ============================================
  // Templates
  // ============================================

  async createTemplate(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createTemplateSchema.parse(req.body);
      const template = await smsService.createTemplate(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'sms_templates',
          recordId: template.id,
          newValues: template,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating template:', error);
      const message = error instanceof Error ? error.message : 'Failed to create template';
      return res.status(500).json({ success: false, message });
    }
  },

  async getTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const template = await smsService.getTemplate(associationId, parseInt(id));

      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      return res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch template' });
    }
  },

  async listTemplates(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = listTemplatesQuerySchema.parse(req.query);
      const result = await smsService.listTemplates(associationId, {
        page: queryParams.page,
        limit: queryParams.limit,
        category: queryParams.category,
        isActive: queryParams.isActive,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing templates:', error);
      return res.status(500).json({ success: false, message: 'Failed to list templates' });
    }
  },

  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updateTemplateSchema.parse(req.body);
      const template = await smsService.updateTemplate(associationId, parseInt(id), validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'sms_templates',
          recordId: parseInt(id),
          newValues: template,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: template,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating template:', error);
      const message = error instanceof Error ? error.message : 'Failed to update template';
      return res.status(500).json({ success: false, message });
    }
  },

  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await smsService.deleteTemplate(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'sms_templates',
          recordId: parseInt(id),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete template';
      return res.status(500).json({ success: false, message });
    }
  },

  // ============================================
  // Messages
  // ============================================

  async listMessages(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = listMessagesQuerySchema.parse(req.query);
      const result = await smsService.listMessages(associationId, {
        page: queryParams.page,
        limit: queryParams.limit,
        status: queryParams.status,
        campaignId: queryParams.campaignId,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing messages:', error);
      return res.status(500).json({ success: false, message: 'Failed to list messages' });
    }
  },

  async getMessage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const message = await smsService.getMessage(associationId, parseInt(id));

      return res.status(200).json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error('Error fetching message:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch message';
      return res.status(500).json({ success: false, message });
    }
  },

  // ============================================
  // Credits
  // ============================================

  async getCreditBalance(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const balance = await smsService.getCreditBalance(associationId);

      return res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch credit balance' });
    }
  },

  async topUpCredits(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = topUpCreditsSchema.parse(req.body);
      const balance = await smsService.topUpCredits(
        associationId,
        validatedData.amount,
        validatedData.reference,
        validatedData.description
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'sms_credit_transactions',
          recordId: 0,
          newValues: { type: 'PURCHASE', amount: validatedData.amount },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Credits topped up successfully',
        data: balance,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error topping up credits:', error);
      const message = error instanceof Error ? error.message : 'Failed to top up credits';
      return res.status(500).json({ success: false, message });
    }
  },

  async getCreditHistory(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await smsService.getCreditHistory(associationId, { page, limit });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error fetching credit history:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch credit history' });
    }
  },

  // ============================================
  // Paystack Purchase Integration
  // ============================================

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

      const { credits, packageId } = req.body;

      if (!credits || credits < 100) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 100 credits required',
        });
      }

      // Calculate amount (₦7 per credit - flat rate, no discounts)
      const pricePerCredit = 7;
      const amount = credits * pricePerCredit;

      // Import PaystackService dynamically
      const { PaystackService } = await import('../payments/paystack/paystack.service');

      // Generate unique reference
      const reference = PaystackService.generateReference('SMS');

      // Convert amount to kobo
      const amountInKobo = PaystackService.nairaToKobo(amount);

      // Get user email and name (firstName/lastName are on Member model)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          email: true, 
          member: {
            select: {
              firstName: true,
              lastName: true,
            }
          }
        },
      });

      if (!user || !user.email) {
        return res.status(400).json({
          success: false,
          message: 'User email is required for payment',
        });
      }

      // Get user name from member or fallback to email
      const userName = user.member 
        ? `${user.member.firstName} ${user.member.lastName}` 
        : user.email;

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
          userName,
          associationName: association?.name,
          credits,
          packageId,
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
          credits,
          amount,
          reference,
          status: 'pending',
          provider: 'paystack',
          metadata: {
            packageId,
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
            credits,
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
          credits,
          amount,
          amountInKobo,
        },
      });
    } catch (error) {
      console.error('Error initializing SMS credits purchase:', error);
      const message = error instanceof Error ? error.message : 'Failed to initialize payment';
      return res.status(500).json({ success: false, message });
    }
  },

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

      // Import PaystackService dynamically
      const { PaystackService } = await import('../payments/paystack/paystack.service');

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
    } catch (error) {
      console.error('Error verifying SMS credits purchase:', error);
      const message = error instanceof Error ? error.message : 'Failed to verify payment';
      return res.status(500).json({ success: false, message });
    }
  },
};
