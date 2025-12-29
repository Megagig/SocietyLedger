// ============================================
// PHASE 5.5: WELFARE & SOCIAL FUNDS CONTROLLER
// ============================================

import { Request, Response } from 'express';
import { z } from 'zod';
import { welfareService } from './welfare.service';
import {
  createWelfareFundSchema,
  updateWelfareFundSchema,
  welfareFundQuerySchema,
  recordContributionSchema,
  bulkContributionSchema,
  confirmContributionSchema,
  contributionQuerySchema,
  createPayoutRequestSchema,
  reviewPayoutSchema,
  disbursePayoutSchema,
  payoutQuerySchema,
} from './welfare.validation';
import { prisma } from '../../lib/prisma';

export const welfareController = {
  // ==========================================
  // WELFARE FUND ENDPOINTS
  // ==========================================

  async createFund(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = createWelfareFundSchema.parse(req.body);
      const fund = await welfareService.createFund(associationId, userId, validatedData);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'welfare_funds',
          recordId: fund.id,
          newValues: fund,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Welfare fund created successfully',
        data: fund,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating welfare fund:', error);
      const message = error instanceof Error ? error.message : 'Failed to create welfare fund';
      return res.status(500).json({ success: false, message });
    }
  },

  async updateFund(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = updateWelfareFundSchema.parse(req.body);
      const fund = await welfareService.updateFund(associationId, parseInt(id), validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'welfare_funds',
          recordId: fund.id,
          newValues: fund,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Welfare fund updated successfully',
        data: fund,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating welfare fund:', error);
      const message = error instanceof Error ? error.message : 'Failed to update welfare fund';
      return res.status(500).json({ success: false, message });
    }
  },

  async getFund(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const fund = await welfareService.getFund(associationId, parseInt(id));

      return res.status(200).json({
        success: true,
        data: fund,
      });
    } catch (error) {
      console.error('Error fetching welfare fund:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch welfare fund';
      return res.status(500).json({ success: false, message });
    }
  },

  async listFunds(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = welfareFundQuerySchema.parse(req.query);
      const result = await welfareService.listFunds(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        fundType: queryParams.fundType,
        status: queryParams.status,
        search: queryParams.search,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing welfare funds:', error);
      return res.status(500).json({ success: false, message: 'Failed to list welfare funds' });
    }
  },

  async deleteFund(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      await welfareService.deleteFund(associationId, parseInt(id));

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'DELETE',
          tableName: 'welfare_funds',
          recordId: parseInt(id),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Welfare fund deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting welfare fund:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete welfare fund';
      return res.status(500).json({ success: false, message });
    }
  },

  // ==========================================
  // CONTRIBUTION ENDPOINTS
  // ==========================================

  async recordContribution(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = recordContributionSchema.parse(req.body);
      const contribution = await welfareService.recordContribution(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'welfare_contributions',
          recordId: contribution.id,
          newValues: contribution,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Contribution recorded successfully',
        data: contribution,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error recording contribution:', error);
      const message = error instanceof Error ? error.message : 'Failed to record contribution';
      return res.status(500).json({ success: false, message });
    }
  },

  async bulkRecordContributions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = bulkContributionSchema.parse(req.body);
      const result = await welfareService.bulkRecordContributions(associationId, userId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'CREATE',
          tableName: 'welfare_contributions',
          recordId: 0,
          newValues: { count: result.count, fundId: validatedData.fundId },
        },
      });

      return res.status(201).json({
        success: true,
        message: `${result.count} contributions recorded successfully`,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error recording bulk contributions:', error);
      const message = error instanceof Error ? error.message : 'Failed to record contributions';
      return res.status(500).json({ success: false, message });
    }
  },

  async confirmContribution(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = confirmContributionSchema.parse(req.body);
      const contribution = await welfareService.confirmContribution(
        associationId,
        parseInt(id),
        userId,
        validatedData.status,
        validatedData.notes ?? undefined
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'welfare_contributions',
          recordId: parseInt(id),
          newValues: { status: validatedData.status },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Contribution ${validatedData.status.toLowerCase()} successfully`,
        data: contribution,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error confirming contribution:', error);
      const message = error instanceof Error ? error.message : 'Failed to confirm contribution';
      return res.status(500).json({ success: false, message });
    }
  },

  async listContributions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = contributionQuerySchema.parse(req.query);
      const result = await welfareService.listContributions(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        fundId: queryParams.fundId ? parseInt(queryParams.fundId) : undefined,
        memberId: queryParams.memberId ? parseInt(queryParams.memberId) : undefined,
        status: queryParams.status,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing contributions:', error);
      return res.status(500).json({ success: false, message: 'Failed to list contributions' });
    }
  },

  // ==========================================
  // PAYOUT REQUEST ENDPOINTS
  // ==========================================

  async createPayoutRequest(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const validatedData = createPayoutRequestSchema.parse(req.body);
      const request = await welfareService.createPayoutRequest(associationId, memberId, validatedData);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user?.id || 0,
          action: 'CREATE',
          tableName: 'welfare_payout_requests',
          recordId: request.id,
          newValues: request,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Payout request created successfully',
        data: request,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating payout request:', error);
      const message = error instanceof Error ? error.message : 'Failed to create payout request';
      return res.status(500).json({ success: false, message });
    }
  },

  async reviewPayoutRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = reviewPayoutSchema.parse(req.body);
      const request = await welfareService.reviewPayoutRequest(
        associationId,
        parseInt(id),
        userId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'welfare_payout_requests',
          recordId: parseInt(id),
          newValues: { status: validatedData.status },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Payout request ${validatedData.status.toLowerCase()} successfully`,
        data: request,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error reviewing payout request:', error);
      const message = error instanceof Error ? error.message : 'Failed to review payout request';
      return res.status(500).json({ success: false, message });
    }
  },

  async disbursePayoutRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const validatedData = disbursePayoutSchema.parse(req.body);
      const request = await welfareService.disbursePayoutRequest(
        associationId,
        parseInt(id),
        userId,
        validatedData
      );

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'UPDATE',
          tableName: 'welfare_payout_requests',
          recordId: parseInt(id),
          newValues: { status: 'DISBURSED', ...validatedData },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Payout disbursed successfully',
        data: request,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error disbursing payout:', error);
      const message = error instanceof Error ? error.message : 'Failed to disburse payout';
      return res.status(500).json({ success: false, message });
    }
  },

  async cancelPayoutRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const request = await welfareService.cancelPayoutRequest(associationId, parseInt(id), memberId);

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user?.id || 0,
          action: 'UPDATE',
          tableName: 'welfare_payout_requests',
          recordId: parseInt(id),
          newValues: { status: 'CANCELLED' },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Payout request cancelled successfully',
        data: request,
      });
    } catch (error) {
      console.error('Error cancelling payout request:', error);
      const message = error instanceof Error ? error.message : 'Failed to cancel payout request';
      return res.status(500).json({ success: false, message });
    }
  },

  async listPayoutRequests(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const queryParams = payoutQuerySchema.parse(req.query);
      const result = await welfareService.listPayoutRequests(associationId, {
        page: parseInt(queryParams.page),
        limit: parseInt(queryParams.limit),
        fundId: queryParams.fundId ? parseInt(queryParams.fundId) : undefined,
        memberId: queryParams.memberId ? parseInt(queryParams.memberId) : undefined,
        status: queryParams.status,
        payoutType: queryParams.payoutType,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error listing payout requests:', error);
      return res.status(500).json({ success: false, message: 'Failed to list payout requests' });
    }
  },

  // ==========================================
  // DASHBOARD & ANALYTICS ENDPOINTS
  // ==========================================

  async getDashboard(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const dashboard = await welfareService.getDashboard(associationId);

      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error fetching welfare dashboard:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },

  async getMemberWelfareProfile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.params.memberId 
        ? parseInt(req.params.memberId) 
        : req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const profile = await welfareService.getMemberWelfareProfile(associationId, memberId);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('Error fetching member welfare profile:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch profile';
      return res.status(500).json({ success: false, message });
    }
  },

  async getFundSummaries(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const summaries = await welfareService.getFundSummaries(associationId);

      return res.status(200).json({
        success: true,
        data: summaries,
      });
    } catch (error) {
      console.error('Error fetching fund summaries:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch fund summaries' });
    }
  },

  async checkEligibility(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const { fundId, memberId } = req.query;

      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const targetMemberId = memberId 
        ? parseInt(memberId as string) 
        : req.user?.memberId;

      if (!targetMemberId || !fundId) {
        return res.status(400).json({ success: false, message: 'Fund ID and member ID required' });
      }

      const eligibility = await welfareService.checkMemberEligibility(
        associationId,
        targetMemberId,
        parseInt(fundId as string)
      );

      return res.status(200).json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return res.status(500).json({ success: false, message: 'Failed to check eligibility' });
    }
  },

  // ==========================================
  // BEREAVEMENT SUPPORT ENDPOINT
  // ==========================================

  async createBereavementRequest(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const memberId = req.user?.memberId;

      if (!associationId || !memberId) {
        return res.status(400).json({ success: false, message: 'Association and member ID required' });
      }

      const { fundId, amount, deceasedName, relationship, dateOfDeath, supportingDocuments } = req.body;

      if (!fundId || !amount || !deceasedName || !relationship || !dateOfDeath) {
        return res.status(400).json({ 
          success: false, 
          message: 'Fund ID, amount, deceased name, relationship, and date of death are required' 
        });
      }

      const request = await welfareService.createBereavementRequest(associationId, memberId, {
        fundId,
        amount,
        deceasedName,
        relationship,
        dateOfDeath,
        supportingDocuments,
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId: req.user?.id || 0,
          action: 'CREATE',
          tableName: 'welfare_payout_requests',
          recordId: request.id,
          newValues: { type: 'BEREAVEMENT', ...request },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Bereavement support request created successfully',
        data: request,
      });
    } catch (error) {
      console.error('Error creating bereavement request:', error);
      const message = error instanceof Error ? error.message : 'Failed to create bereavement request';
      return res.status(500).json({ success: false, message });
    }
  },
};
