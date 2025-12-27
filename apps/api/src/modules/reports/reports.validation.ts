import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']).optional(),
});

export const financialSummaryQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']).optional().default('this_month'),
  includeComparison: z.string().optional().transform(val => val === 'true'),
});

export const memberBalancesQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  status: z.enum(['all', 'with_balance', 'overdue']).optional().default('all'),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'balance', 'lastPayment']).optional().default('balance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const agingAnalysisQuerySchema = z.object({
  asOfDate: z.string().datetime().optional(),
  includeDetails: z.string().optional().transform(val => val === 'true').default('true'),
});

export const collectionRateQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']).optional().default('this_year'),
  groupBy: z.enum(['month', 'quarter', 'year']).optional().default('month'),
});

export const categoryReportQuerySchema = z.object({
  categoryId: z.string().optional(),
  type: z.enum(['due', 'levy', 'donation', 'penalty']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeTransactions: z.string().optional().transform(val => val === 'true').default('true'),
  transactionLimit: z.string().optional().default('10'),
});
