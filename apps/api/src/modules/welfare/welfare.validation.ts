// ============================================
// PHASE 5.5: WELFARE & SOCIAL FUNDS VALIDATION
// ============================================

import { z } from 'zod';

// Enums - Must match Prisma schema exactly
const welfareFundTypes = ['GENERAL', 'BEREAVEMENT', 'MEDICAL', 'EDUCATION', 'EMERGENCY', 'MATERNITY', 'WEDDING'] as const;
const welfareFundStatuses = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
const contributionStatuses = ['PENDING', 'CONFIRMED', 'REJECTED'] as const;
const payoutRequestStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'] as const;
const payoutTypes = ['BEREAVEMENT', 'MEDICAL', 'EDUCATION', 'EMERGENCY', 'MATERNITY', 'WEDDING', 'OTHER'] as const;
const paymentMethods = ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other'] as const;

// ==========================================
// WELFARE FUND SCHEMAS
// ==========================================

export const createWelfareFundSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  fundType: z.enum(welfareFundTypes),
  targetBalance: z.number().positive('Target balance must be positive').optional().nullable(),
  monthlyContribution: z.number().positive('Monthly contribution must be positive').optional().nullable(),
  isContributionMandatory: z.boolean().default(false),
  minContribution: z.number().positive('Minimum contribution must be positive').optional().nullable(),
  maxPayout: z.number().positive('Maximum payout must be positive').optional().nullable(),
  waitingPeriodDays: z.number().int().min(0).default(0),
  minContributionMonths: z.number().int().min(0).default(0),
});

export const updateWelfareFundSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  fundType: z.enum(welfareFundTypes).optional(),
  targetBalance: z.number().positive().optional().nullable(),
  monthlyContribution: z.number().positive().optional().nullable(),
  isContributionMandatory: z.boolean().optional(),
  minContribution: z.number().positive().optional().nullable(),
  maxPayout: z.number().positive().optional().nullable(),
  waitingPeriodDays: z.number().int().min(0).optional(),
  minContributionMonths: z.number().int().min(0).optional(),
  status: z.enum(welfareFundStatuses).optional(),
});

export const welfareFundQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  fundType: z.enum(welfareFundTypes).optional(),
  status: z.enum(welfareFundStatuses).optional(),
  search: z.string().optional(),
});

// ==========================================
// CONTRIBUTION SCHEMAS
// ==========================================

export const recordContributionSchema = z.object({
  fundId: z.number().int().positive('Fund ID is required'),
  memberId: z.number().int().positive('Member ID is required'),
  amount: z.number().positive('Amount must be positive'),
  contributionDate: z.string().datetime().optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const bulkContributionSchema = z.object({
  fundId: z.number().int().positive('Fund ID is required'),
  memberIds: z.array(z.number().int().positive()).min(1, 'At least one member is required'),
  amount: z.number().positive('Amount must be positive'),
  contributionDate: z.string().datetime().optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const confirmContributionSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
  notes: z.string().max(500).optional().nullable(),
});

export const contributionQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  fundId: z.string().optional(),
  memberId: z.string().optional(),
  status: z.enum(contributionStatuses).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ==========================================
// PAYOUT REQUEST SCHEMAS
// ==========================================

export const createPayoutRequestSchema = z.object({
  fundId: z.number().int().positive('Fund ID is required'),
  payoutType: z.enum(payoutTypes),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(10, 'Please provide a detailed reason (at least 10 characters)').max(1000),
  supportingDocuments: z.string().optional().nullable(),
});

export const reviewPayoutSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedAmount: z.number().positive().optional(),
  comments: z.string().max(500).optional().nullable(),
  rejectionReason: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    if (data.status === 'REJECTED' && !data.rejectionReason) {
      return false;
    }
    return true;
  },
  { message: 'Rejection reason is required when rejecting a request', path: ['rejectionReason'] }
);

export const disbursePayoutSchema = z.object({
  disbursementMethod: z.enum(paymentMethods),
  disbursementReference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const payoutQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  fundId: z.string().optional(),
  memberId: z.string().optional(),
  status: z.enum(payoutRequestStatuses).optional(),
  payoutType: z.enum(payoutTypes).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Type exports
export type CreateWelfareFundInput = z.infer<typeof createWelfareFundSchema>;
export type UpdateWelfareFundInput = z.infer<typeof updateWelfareFundSchema>;
export type RecordContributionInput = z.infer<typeof recordContributionSchema>;
export type BulkContributionInput = z.infer<typeof bulkContributionSchema>;
export type CreatePayoutRequestInput = z.infer<typeof createPayoutRequestSchema>;
export type ReviewPayoutInput = z.infer<typeof reviewPayoutSchema>;
export type DisbursePayoutInput = z.infer<typeof disbursePayoutSchema>;
