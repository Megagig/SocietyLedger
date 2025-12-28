import { z } from 'zod';

// ============================================
// EXPORT VALIDATION SCHEMAS
// ============================================

export const exportFinancialSummarySchema = z.object({
  format: z.enum(['pdf', 'excel']),
  period: z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeComparison: z.boolean().optional(),
});

export const exportMemberStatementSchema = z.object({
  format: z.enum(['pdf']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const exportAllMembersSchema = z.object({
  format: z.enum(['excel']),
  status: z.enum(['all', 'with_balance', 'overdue']).optional(),
});

export const getExportHistorySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  type: z.string().optional(),
  format: z.enum(['pdf', 'excel']).optional(),
});
