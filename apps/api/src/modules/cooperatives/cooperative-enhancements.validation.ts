import { z } from 'zod';

// Validation for the cooperative enhancements: officer-defined account types and loan categories, batched payment requests, and
// two-stage withdrawals. (The older savings/loan schemas stay in cooperatives.validation.ts.)

const money = z.coerce.number().positive('Enter an amount above zero').max(1_000_000_000);
const text = (max: number) => z.string().trim().max(max);

// ---- Account types ----

export const accountClassEnum = z.enum(['CONTRIBUTION', 'SHARES', 'SPECIAL']);

export const createAccountTypeSchema = z.object({
  name: text(80).min(2, 'Give the account type a name'),
  description: text(300).nullable().optional(),
  accountClass: accountClassEnum.default('CONTRIBUTION'),
  defaultMonthlyAmount: z.coerce.number().positive().max(1_000_000_000).nullable().optional(),
  monthlyWithdrawalLimit: z.coerce.number().positive().max(1_000_000_000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateAccountTypeSchema = createAccountTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---- Loan categories ----

export const createLoanCategorySchema = z.object({
  name: text(80).min(2, 'Give the category a name'),
  description: text(300).nullable().optional(),
  isGoods: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const updateLoanCategorySchema = createLoanCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---- Payment requests (one transfer, one proof, one or more lines) ----

export const paymentLineSchema = z.object({
  accountTypeId: z.coerce.number().int().positive(),
  amount: money,
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
});

/**
 * The request arrives as multipart (the proof is a file), so `lines` is a JSON string in the form data. Parsed here so the controller
 * gets real objects, and a malformed string is a validation error rather than a crash.
 */
export const createPaymentRequestSchema = z.object({
  lines: z
    .preprocess((value) => {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }, z.array(paymentLineSchema).min(1, 'Add at least one payment line').max(20))
    .superRefine((lines, ctx) => {
      const seen = new Set<string>();
      for (const line of lines) {
        const key = `${line.accountTypeId}-${line.periodYear}-${line.periodMonth}`;
        if (seen.has(key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The same savings type is listed twice for the same month. Add the amounts together.' });
          return;
        }
        seen.add(key);
      }
    }),
  paymentDate: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, { message: 'Payment date cannot be in the future' }),
  bankAccountId: z.coerce.number().int().positive().optional(),
  reference: text(100).optional(),
  memberNote: text(500).optional(),
});

export const paymentRequestQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  memberId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const rejectRequestSchema = z.object({
  reason: text(500).min(3, 'Say why, so the member knows what to fix'),
});

// ---- Withdrawals ----

export const createWithdrawalSchema = z.object({
  savingsAccountId: z.coerce.number().int().positive(),
  amount: money,
  reason: text(500).optional(),
});

export const reviewWithdrawalSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('FORWARD'), comment: text(500).optional() }),
  z.object({ decision: z.literal('REJECT'), reason: text(500).min(3, 'Say why, so the member knows what to fix') }),
]);

export const approveWithdrawalSchema = z.object({
  payoutMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER']),
  payoutReference: text(100).optional(),
  comment: text(500).optional(),
});

export const withdrawalQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  status: z.enum(['PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  memberId: z.string().optional(),
});

export const cooperativeSettingsSchema = z.object({
  requireTwoStageWithdrawal: z.boolean(),
});

// ---- Member read models ----

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Use a date like 2026-10-31')
  .transform((value) => new Date(value));

export const dashboardQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const rangeQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const myPendingPaymentsQuerySchema = rangeQuerySchema.extend({
  type: z.enum(['SAVINGS', 'LOAN_REPAYMENT']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const bankAccountsQuerySchema = z.object({ search: z.string().trim().max(100).optional() });
