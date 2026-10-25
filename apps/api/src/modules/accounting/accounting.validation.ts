import { z } from 'zod';

// ============================================
// ACCOUNTING VALIDATION SCHEMAS - Phase 9
// ============================================

// Account Types
export const accountTypeSchema = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
export const normalBalanceSchema = z.enum(['DEBIT', 'CREDIT']);
export const journalEntryStatusSchema = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'VOIDED']);
export const budgetStatusSchema = z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'CLOSED']);

// Chart of Accounts
export const createAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: accountTypeSchema,
  subType: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  parentId: z.number().int().positive().optional(),
  // No default here: the service gives the account the normal balance of its type unless one is chosen on purpose
  normalBalance: normalBalanceSchema.optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  // null clears the group or the description; leaving it out keeps it
  subType: z.string().max(50).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  // null takes the account out from under its parent
  parentId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const accountQuerySchema = z.object({
  type: accountTypeSchema.optional(),
  isActive: z.string().optional().transform(val => val === undefined ? undefined : val === 'true'),
  includeBalances: z.string().optional().transform(val => val === 'true'),
  hierarchical: z.string().optional().transform(val => val === 'true'),
});

// Journal Entry
export const journalEntryLineSchema = z.object({
  accountId: z.number().int().positive(),
  debitAmount: z.number().min(0).optional().default(0),
  creditAmount: z.number().min(0).optional().default(0),
  description: z.string().max(200).optional(),
}).refine(
  data => (data.debitAmount > 0 && data.creditAmount === 0) || (data.creditAmount > 0 && data.debitAmount === 0),
  { message: 'Each line must have either a debit or credit amount, not both' }
);

export const createJournalEntrySchema = z.object({
  entryDate: z.string().datetime().or(z.date()),
  description: z.string().min(1).max(500),
  reference: z.string().max(100).optional(),
  lines: z.array(journalEntryLineSchema).min(2),
}).refine(
  data => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01; // Allow for floating point precision
  },
  { message: 'Total debits must equal total credits' }
);

export const updateJournalEntrySchema = z.object({
  entryDate: z.string().datetime().or(z.date()).optional(),
  description: z.string().min(1).max(500).optional(),
  reference: z.string().max(100).optional().nullable().transform(val => val ?? undefined),
  lines: z.array(journalEntryLineSchema).min(2).optional(),
}).refine(
  data => {
    if (!data.lines) return true;
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debits must equal total credits' }
);

export const journalEntryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: journalEntryStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['entryDate', 'entryNumber', 'createdAt']).optional().default('entryDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

// Financial Statements
export const financialStatementQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  period: z.enum(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year', 'custom']).optional().default('this_month'),
  includeComparison: z.string().optional().transform(val => val === 'true'),
  asOfDate: z.string().datetime().optional(),
});

// Budget
export const budgetItemSchema = z.object({
  accountId: z.number().int().positive(),
  monthlyAmount: z.number().min(0).optional(),
  q1Amount: z.number().min(0).optional(),
  q2Amount: z.number().min(0).optional(),
  q3Amount: z.number().min(0).optional(),
  q4Amount: z.number().min(0).optional(),
  annualAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export const createBudgetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  fiscalYear: z.number().int().min(2000).max(2100),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
  items: z.array(budgetItemSchema).min(1),
});

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable().transform(val => val ?? undefined),
  items: z.array(budgetItemSchema).optional(),
});

export const budgetQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  fiscalYear: z.string().optional(),
  status: budgetStatusSchema.optional(),
});

export const budgetVarianceQuerySchema = z.object({
  budgetId: z.string(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Accounting Periods
export const periodTypeSchema = z.enum(['month', 'quarter', 'year']);

export const createPeriodSchema = z.object({
  name: z.string().min(1).max(100),
  periodType: periodTypeSchema,
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  { message: 'endDate must be after startDate' }
);
