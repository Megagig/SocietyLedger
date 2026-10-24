/**
 * SMS Controller
 * Phase 6.5: SMS & Bulk Communication
 */

import { creditVerifiedPurchase } from './sms-engine';
import { Request, Response } from 'express';
import { z } from 'zod';
import { SMSService } from './sms.service';
import {
  quickSMSSchema,
  createCampaignSchema,
  updateCampaignSchema,
  createTemplateSchema,
  updateTemplateSchema,
  listMessagesQuerySchema,
  listCampaignsQuerySchema,
  listTemplatesQuerySchema,
  previewAudienceSchema,
} from './sms.validation';
import { prisma } from '../../lib/prisma';
import { SettingsService } from '../settings/settings.service';

const smsService = new SMSService();

import { RuleError } from '../finance/rule-error';

/** A rule an officer broke (not enough credits, a campaign already started…) keeps its status and code; a missing record is a 404. */
function smsFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
  }
  if (error instanceof RuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (/not found$/i.test(message)) return res.status(404).json({ success: false, message });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message });
}

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

  /** What a send to this audience would do, before it is sent: who is texted, who is missed and why, and the cost. */
  async previewAudience(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const body = previewAudienceSchema.parse(req.body);
      const data = await smsService.previewAudience(associationId, body.recipientType, body.recipientFilter, body.message);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return smsFailure(res, error, 'Failed to preview the audience');
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

      // R4.6/G53 review fix: check here (not just inside the service) so a
      // disabled provider surfaces as a real 400, not a 500 from the
      // generic catch block below — same pattern as the Paystack/Nomba
      // enabled-channel checks.
      const smsProvider = await SettingsService.getSetting(associationId, 'integrations', 'smsProvider');
      if (smsProvider === 'none') {
        return res.status(400).json({ success: false, message: 'SMS sending is disabled for this association' });
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
        message: result.inProgress ? `Sending to ${result.accepted} recipients` : `SMS sent to ${result.totalSent} recipients`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return smsFailure(res, error, 'Failed to send SMS');
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
      return smsFailure(res, error, 'Failed to create campaign');
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

      // R4.6/G53 review fix: same 400-not-500 reasoning as sendQuickSMS above
      const smsProvider = await SettingsService.getSetting(associationId, 'integrations', 'smsProvider');
      if (smsProvider === 'none') {
        return res.status(400).json({ success: false, message: 'SMS sending is disabled for this association' });
      }

      const stats = await smsService.startCampaign(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'sms_campaigns',
          recordId: parseInt(id),
          newValues: { status: 'IN_PROGRESS', ...stats },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Campaign is sending to ${stats.totalRecipients} people`,
        data: stats,
      });
    } catch (error) {
      return smsFailure(res, error, 'Failed to start campaign');
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
      return smsFailure(res, error, 'Failed to cancel campaign');
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
      return smsFailure(res, error, 'Failed to delete campaign');
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
      return smsFailure(res, error, 'Failed to create template');
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
      return smsFailure(res, error, 'Failed to update template');
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
      return smsFailure(res, error, 'Failed to delete template');
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
      return smsFailure(res, error, 'Failed to fetch message');
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

  // topUpCredits removed (G41) — see sms.routes.ts; the real manual-grant
  // path is now PlatformAdminController.topUpSmsCredits (platform-only).

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
        callback_url: `${process.env.FRONTEND_URL}/dashboard/communications/credits/verify?reference=${reference}`,
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
      return smsFailure(res, error, 'Failed to initialize payment');
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

      // Add the credits once, whoever verifies first: the purchase is claimed and credited together
      await creditVerifiedPurchase(purchase, verificationResponse.data.paid_at, verificationResponse);

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
      return smsFailure(res, error, 'Failed to verify payment');
    }
  },
};
