import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const period = z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']);
const isoDate = z.string().datetime();
const wholeNumber = z.string().regex(/^\d+$/, 'Must be a whole number');
const flag = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((val) => (val === undefined ? fallback : val === 'true'));

export const dateRangeSchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  period: period.optional(),
});

// No default period here: a range with both dates and no period is a custom range, and the controller picks the default otherwise.
export const financialSummaryQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  period: period.optional(),
  includeComparison: flag(false),
});

export const memberBalancesQuerySchema = z.object({
  page: wholeNumber.optional().default('1'),
  limit: wholeNumber.optional().default('50'),
  status: z.enum(['all', 'with_balance', 'overdue']).optional().default('all'),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'balance', 'lastPayment']).optional().default('balance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const agingAnalysisQuerySchema = z.object({
  asOfDate: isoDate.optional(),
  includeDetails: flag(true),
});

export const collectionRateQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  period: period.optional(),
  groupBy: z.enum(['month', 'quarter', 'year']).optional().default('month'),
});

export const categoryReportQuerySchema = z.object({
  categoryId: wholeNumber.optional(),
  type: z.enum(['due', 'levy', 'donation', 'penalty']).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  includeTransactions: flag(true),
  transactionLimit: wholeNumber.optional().default('10'),
});

// The lists behind the figures: the same filters the reports use
export const chargesListQuerySchema = z.object({
  scope: z.enum(['raised', 'owing', 'overdue', 'aging']),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  categoryId: wholeNumber.optional(),
  categoryType: z.enum(['due', 'levy', 'donation', 'penalty']).optional(),
  memberId: wholeNumber.optional(),
  bucket: z.enum(['notYetDue', 'current', 'days31to60', 'days61to90', 'over90']).optional(),
  asOfDate: isoDate.optional(),
  owingOnly: flag(false),
  status: z.enum(['paid', 'partial', 'pending', 'overdue', 'waived']).optional(),
  page: wholeNumber.optional().default('1'),
  limit: wholeNumber.optional().default('25'),
});

export const paymentsListQuerySchema = z.object({
  paymentMethod: z.string().max(50).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  categoryId: wholeNumber.optional(),
  categoryType: z.enum(['due', 'levy', 'donation', 'penalty']).optional(),
  memberId: wholeNumber.optional(),
  page: wholeNumber.optional().default('1'),
  limit: wholeNumber.optional().default('25'),
});
