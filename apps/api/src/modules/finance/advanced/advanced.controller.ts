import { Request, Response } from 'express';
import { z } from 'zod';
import { leviesService } from './levies.service';
import { donationsService } from './donations.service';
import { penaltiesService } from './penalties.service';
import { LevyRuleError } from './levy-rules';

/** A rule the officer broke (wrong state, nothing to do) answers with its own status and code; anything else is a 500. */
function levyFailure(res: Response, error: any, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
  }
  if (error instanceof LevyRuleError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: error?.message || fallback });
}

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Levy Campaign Schemas
const createCampaignSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2),
  description: z.string().optional(),
  targetAmount: z.number().positive(),
  amountPerMember: z.number().positive().optional(),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
});

const updateCampaignSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  targetAmount: z.number().positive().optional(),
  amountPerMember: z.number().positive().optional(),
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  // Officers only start a draft or close an active campaign. Completed is worked out from payments.
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

const assignMembersSchema = z
  .object({
    memberIds: z.array(z.number().int().positive()).min(1).optional(),
    /** Every active member, instead of a chosen list. */
    allActive: z.boolean().optional(),
    amount: z.number().positive().optional(),
    createTransactions: z.boolean().optional().default(true),
  })
  .refine((v) => v.allActive === true || (v.memberIds && v.memberIds.length > 0), { message: 'Choose members, or all active members.' });

// Donation Schemas
const createAllocationSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  type: z.enum(['general', 'project', 'emergency', 'other']),
  targetAmount: z.number().positive().optional(),
});

const updateAllocationSchema = createAllocationSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const recordDonationSchema = z.object({
  memberId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  amount: z.number().positive(),
  allocationId: z.number().int().positive().optional(),
  donorMessage: z.string().optional(),
  isAnonymous: z.boolean().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  donationType: z.enum(['instant', 'pledge']).optional().default('instant'),
  pledgeDate: z.string().optional(),
});

// Penalty Schemas
const createRuleSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  triggerType: z.enum(['late_payment', 'missed_meeting', 'custom']),
  gracePeriodDays: z.number().int().min(0),
  feeType: z.enum(['fixed', 'percentage']),
  feeAmount: z.number().positive(),
  maxFeeAmount: z.number().positive().optional(),
  isCompounding: z.boolean().optional(),
  compoundingDays: z.number().int().positive().optional(),
});

const updateRuleSchema = createRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const waivePenaltySchema = z.object({
  waivedAmount: z.number().positive(),
  reason: z.string().min(5),
});

// ============================================
// ADVANCED FEATURES CONTROLLER
// ============================================

export const advancedController = {
  // ==========================================
  // LEVY CAMPAIGN ENDPOINTS (TASK-ADV-001, TASK-ADV-002)
  // ==========================================

  async createCampaign(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = createCampaignSchema.parse(req.body);
      const campaign = await leviesService.createCampaign(associationId, req.user!.id, {
        ...data,
        deadline: new Date(data.deadline),
      });

      return res.status(201).json({
        success: true,
        message: 'Levy campaign created successfully',
        data: campaign,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return levyFailure(res, error, 'Failed to create campaign');
    }
  },

  async listCampaigns(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await leviesService.listCampaigns(associationId, {
        status: req.query.status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error listing campaigns:', error);
      return res.status(500).json({ success: false, message: 'Failed to list campaigns' });
    }
  },

  async getCampaign(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const campaign = await leviesService.getCampaignById(
        parseInt(req.params.id),
        associationId
      );

      return res.status(200).json({ success: true, data: campaign });
    } catch (error: any) {
      if (error?.message === 'Campaign not found') return res.status(404).json({ success: false, message: error.message });
      return levyFailure(res, error, 'Failed to get campaign');
    }
  },

  async updateCampaign(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = updateCampaignSchema.parse(req.body);
      const campaign = await leviesService.updateCampaign(
        parseInt(req.params.id),
        associationId,
        req.user!.id,
        {
          ...data,
          deadline: data.deadline ? new Date(data.deadline) : undefined,
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Campaign updated successfully',
        data: campaign,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return levyFailure(res, error, 'Failed to update campaign');
    }
  },

  async getCampaignProgress(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const progress = await leviesService.getCampaignProgress(
        parseInt(req.params.id),
        associationId
      );

      return res.status(200).json({ success: true, data: progress });
    } catch (error: any) {
      console.error('Error getting campaign progress:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get progress' });
    }
  },

  async assignMembers(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = assignMembersSchema.parse(req.body);
      const result = await leviesService.assignToMembers(
        parseInt(req.params.id),
        associationId,
        req.user!.id,
        data
      );

      return res.status(200).json({
        success: true,
        message: `${result.assigned} member(s) assigned to campaign`,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      return levyFailure(res, error, 'Failed to assign members');
    }
  },

  async removeAssignment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      await leviesService.removeAssignment(
        parseInt(req.params.assignmentId),
        associationId,
        req.user!.id
      );

      return res.status(200).json({
        success: true,
        message: 'Assignment removed successfully',
      });
    } catch (error: any) {
      return levyFailure(res, error, 'Failed to remove assignment');
    }
  },

  // ==========================================
  // DONATION ENDPOINTS (TASK-ADV-003, TASK-ADV-004)
  // ==========================================

  async createAllocation(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = createAllocationSchema.parse(req.body);
      const allocation = await donationsService.createAllocation(
        associationId,
        req.user!.id,
        data
      );

      return res.status(201).json({
        success: true,
        message: 'Donation allocation created successfully',
        data: allocation,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating allocation:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create allocation' });
    }
  },

  async listAllocations(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await donationsService.listAllocations(associationId, {
        type: req.query.type as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error listing allocations:', error);
      return res.status(500).json({ success: false, message: 'Failed to list allocations' });
    }
  },

  async updateAllocation(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = updateAllocationSchema.parse(req.body);
      const allocation = await donationsService.updateAllocation(
        parseInt(req.params.id),
        associationId,
        req.user!.id,
        data
      );

      return res.status(200).json({
        success: true,
        message: 'Allocation updated successfully',
        data: allocation,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating allocation:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update allocation' });
    }
  },

  async recordDonation(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = recordDonationSchema.parse(req.body);
      const result = await donationsService.recordDonation(
        associationId,
        req.user!.id,
        data
      );

      return res.status(201).json({
        success: true,
        message: 'Donation recorded successfully',
        data: result,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error recording donation:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to record donation' });
    }
  },

  async getDonationReceipt(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const receipt = await donationsService.getDonationReceipt(
        parseInt(req.params.id),
        associationId
      );

      return res.status(200).json({ success: true, data: receipt });
    } catch (error: any) {
      console.error('Error getting receipt:', error);
      return res.status(error.message === 'Donation not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to get receipt',
      });
    }
  },

  async listDonations(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await donationsService.listDonations(associationId, {
        allocationId: req.query.allocationId ? parseInt(req.query.allocationId as string) : undefined,
        memberId: req.query.memberId ? parseInt(req.query.memberId as string) : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error listing donations:', error);
      return res.status(500).json({ success: false, message: 'Failed to list donations' });
    }
  },

  async getDonationStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const dateRange = req.query.startDate && req.query.endDate
        ? {
            start: new Date(req.query.startDate as string),
            end: new Date(req.query.endDate as string),
          }
        : undefined;

      const stats = await donationsService.getDonationStats(associationId, dateRange);

      return res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error getting donation stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
  },

  // ==========================================
  // PENALTY ENDPOINTS (TASK-ADV-005, TASK-ADV-006, TASK-ADV-007)
  // ==========================================

  async createRule(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = createRuleSchema.parse(req.body);
      const rule = await penaltiesService.createRule(associationId, req.user!.id, data);

      return res.status(201).json({
        success: true,
        message: 'Penalty rule created successfully',
        data: rule,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error creating rule:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create rule' });
    }
  },

  async listRules(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await penaltiesService.listRules(associationId, {
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        triggerType: req.query.triggerType as string,
        categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error listing rules:', error);
      return res.status(500).json({ success: false, message: 'Failed to list rules' });
    }
  },

  async getRule(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const rule = await penaltiesService.getRuleById(
        parseInt(req.params.id),
        associationId
      );

      return res.status(200).json({ success: true, data: rule });
    } catch (error: any) {
      console.error('Error getting rule:', error);
      return res.status(error.message === 'Rule not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to get rule',
      });
    }
  },

  async updateRule(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = updateRuleSchema.parse(req.body);
      const rule = await penaltiesService.updateRule(
        parseInt(req.params.id),
        associationId,
        req.user!.id,
        data
      );

      return res.status(200).json({
        success: true,
        message: 'Rule updated successfully',
        data: rule,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error updating rule:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to update rule' });
    }
  },

  async deleteRule(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      await penaltiesService.deleteRule(
        parseInt(req.params.id),
        associationId,
        req.user!.id
      );

      return res.status(200).json({
        success: true,
        message: 'Rule deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to delete rule' });
    }
  },

  async applyLateFees(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await penaltiesService.applyLateFees(associationId, req.user!.id);

      return res.status(200).json({
        success: true,
        message: `Applied ${result.applied} late fee(s)`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error applying late fees:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to apply late fees' });
    }
  },

  async waivePenalty(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const data = waivePenaltySchema.parse(req.body);
      const waiver = await penaltiesService.waivePenalty(
        parseInt(req.params.id),
        associationId,
        req.user!.id,
        data
      );

      return res.status(200).json({
        success: true,
        message: 'Penalty waived successfully',
        data: waiver,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error waiving penalty:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to waive penalty' });
    }
  },

  async listWaivers(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const result = await penaltiesService.listWaivers(associationId, {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error listing waivers:', error);
      return res.status(500).json({ success: false, message: 'Failed to list waivers' });
    }
  },

  async getPenaltyStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID required' });
      }

      const stats = await penaltiesService.getPenaltyStats(associationId);

      return res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      console.error('Error getting penalty stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to get stats' });
    }
  },
};
