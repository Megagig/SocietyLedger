import { z } from 'zod';

// ============================================
// PHASE 8.5: COOPERATIVES & LOANS VALIDATION
// ============================================

// ==========================================
// SAVINGS ACCOUNT VALIDATION
// ==========================================

export const savingsAccountTypeEnum = z.enum(['REGULAR', 'THRIFT', 'TARGET', 'FIXED_DEPOSIT']);
export const savingsAccountStatusEnum = z.enum(['ACTIVE', 'DORMANT', 'CLOSED', 'MATURED']);

export const createSavingsAccountSchema = z.object({
  memberId: z.number().int().positive('Member ID is required'),
  accountType: savingsAccountTypeEnum.default('REGULAR'),
  targetAmount: z.number().positive().optional(),
  monthlyContribution: z.number().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  maturityDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const updateSavingsAccountSchema = z.object({
  targetAmount: z.number().positive().optional(),
  monthlyContribution: z.number().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  maturityDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  status: savingsAccountStatusEnum.optional(),
});

export const savingsAccountQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  memberId: z.string().optional(),
  accountType: savingsAccountTypeEnum.optional(),
  status: savingsAccountStatusEnum.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['balance', 'openedAt', 'accountNumber']).default('openedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==========================================
// SAVINGS TRANSACTION VALIDATION
// ==========================================

export const savingsTransactionTypeEnum = z.enum([
  'DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE'
]);

export const createSavingsTransactionSchema = z.object({
  savingsAccountId: z.number().int().positive('Savings account ID is required'),
  type: savingsTransactionTypeEnum,
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().max(50).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const savingsTransactionQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  savingsAccountId: z.string().optional(),
  type: savingsTransactionTypeEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ==========================================
// LOAN PRODUCT VALIDATION
// ==========================================

export const interestTypeEnum = z.enum(['FLAT', 'REDUCING_BALANCE', 'COMPOUND']);

export const createLoanProductSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  minAmount: z.number().positive('Minimum amount must be positive'),
  maxAmount: z.number().positive('Maximum amount must be positive'),
  interestRate: z.number().min(0).max(100, 'Interest rate must be between 0 and 100'),
  interestType: interestTypeEnum.default('REDUCING_BALANCE'),
  minTenureMonths: z.number().int().min(1).max(360),
  maxTenureMonths: z.number().int().min(1).max(360),
  processingFeePercent: z.number().min(0).max(100).default(0),
  processingFeeFixed: z.number().min(0).default(0),
  requiresGuarantor: z.boolean().default(true),
  minGuarantors: z.number().int().min(0).max(10).default(1),
  maxLoanToSavingsRatio: z.number().min(0).optional(),
  lockSavings: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).default(0),
  lateFeePercent: z.number().min(0).max(100).default(0),
  lateFeeFixed: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
}).refine(data => data.maxAmount >= data.minAmount, {
  message: 'Maximum amount must be greater than or equal to minimum amount',
  path: ['maxAmount'],
}).refine(data => data.maxTenureMonths >= data.minTenureMonths, {
  message: 'Maximum tenure must be greater than or equal to minimum tenure',
  path: ['maxTenureMonths'],
});

export const updateLoanProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  interestType: interestTypeEnum.optional(),
  minTenureMonths: z.number().int().min(1).max(360).optional(),
  maxTenureMonths: z.number().int().min(1).max(360).optional(),
  processingFeePercent: z.number().min(0).max(100).optional(),
  processingFeeFixed: z.number().min(0).optional(),
  requiresGuarantor: z.boolean().optional(),
  minGuarantors: z.number().int().min(0).max(10).optional(),
  maxLoanToSavingsRatio: z.number().min(0).optional(),
  lockSavings: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(90).optional(),
  lateFeePercent: z.number().min(0).max(100).optional(),
  lateFeeFixed: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const loanProductQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  isActive: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional(),
});

// ==========================================
// LOAN APPLICATION VALIDATION
// ==========================================

export const loanApplicationStatusEnum = z.enum([
  'DRAFT', 'PENDING_GUARANTORS', 'PENDING_REVIEW', 'UNDER_REVIEW',
  'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED'
]);

export const createLoanApplicationSchema = z.object({
  loanProductId: z.number().int().positive('Loan product is required'),
  amount: z.number().positive('Loan amount must be positive'),
  tenureMonths: z.number().int().min(1).max(360, 'Tenure must be between 1 and 360 months'),
  purpose: z.string().min(10).max(500, 'Purpose must be between 10 and 500 characters'),
  guarantorIds: z.array(z.number().int().positive()).optional(),
  collateralDescription: z.string().max(500).optional(),
  collateralValue: z.number().positive().optional(),
});

export const updateLoanApplicationSchema = z.object({
  amount: z.number().positive().optional(),
  tenureMonths: z.number().int().min(1).max(360).optional(),
  purpose: z.string().min(10).max(500).optional(),
  collateralDescription: z.string().max(500).optional(),
  collateralValue: z.number().positive().optional(),
});

export const loanApplicationQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  memberId: z.string().optional(),
  status: loanApplicationStatusEnum.optional(),
  loanProductId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['appliedAt', 'amount', 'status']).default('appliedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const reviewLoanApplicationSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_info']),
  comments: z.string().max(500).optional(),
  rejectionReason: z.string().max(500).optional(),
}).refine(data => {
  if (data.action === 'reject' && !data.rejectionReason) {
    return false;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting an application',
  path: ['rejectionReason'],
});

// ==========================================
// LOAN GUARANTOR VALIDATION
// ==========================================

export const guarantorStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'RELEASED']);

export const addGuarantorSchema = z.object({
  loanApplicationId: z.number().int().positive('Loan application ID is required'),
  guarantorMemberId: z.number().int().positive('Guarantor member ID is required'),
  guaranteeAmount: z.number().positive('Guarantee amount must be positive'),
});

export const respondToGuarantorRequestSchema = z.object({
  action: z.enum(['accept', 'decline']),
  declineReason: z.string().max(500).optional(),
}).refine(data => {
  if (data.action === 'decline' && !data.declineReason) {
    return false;
  }
  return true;
}, {
  message: 'Decline reason is required when declining a guarantor request',
  path: ['declineReason'],
});

// ==========================================
// LOAN REPAYMENT VALIDATION
// ==========================================

export const loanStatusEnum = z.enum(['ACTIVE', 'OVERDUE', 'DEFAULTED', 'PAID_OFF', 'WRITTEN_OFF']);
export const repaymentStatusEnum = z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED']);

export const createLoanRepaymentSchema = z.object({
  loanId: z.number().int().positive('Loan ID is required'),
  amount: z.number().positive('Repayment amount must be positive'),
  paymentMethod: z.string().min(1).max(50),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const loanRepaymentQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  loanId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const loanQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  memberId: z.string().optional(),
  status: loanStatusEnum.optional(),
  loanProductId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['disbursedAt', 'outstandingBalance', 'loanNumber']).default('disbursedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==========================================
// DISBURSEMENT VALIDATION
// ==========================================

export const disburseLoanSchema = z.object({
  disbursementMethod: z.enum(['bank_transfer', 'cash', 'cheque', 'savings_credit']),
  bankAccountId: z.number().int().positive().optional(),
  savingsAccountId: z.number().int().positive().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// ==========================================
// SAVINGS DEPOSIT REQUESTS (member declares a deposit, officer approves)
// ==========================================

// Multipart form fields all arrive as strings, so numbers/dates are coerced, and an empty optional field
// (a blank input) is treated as absent.
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const createSavingsDepositSchema = z.object({
  savingsAccountId: z.coerce.number().int().positive('Savings account is required'),
  amount: z.coerce.number().positive('Amount must be positive').max(1_000_000_000, 'Amount is too large'),
  paymentDate: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: 'Payment date cannot be in the future',
  }),
  bankAccountId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  reference: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  memberNote: z.preprocess(blankToUndefined, z.string().max(500).optional()),
});

export const savingsDepositQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  memberId: z.string().optional(),
  savingsAccountId: z.string().optional(),
});

export const rejectSavingsDepositSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a reason').max(500),
});

// ==========================================
// LOAN REPAYMENT REQUESTS (member declares a repayment, officer confirms)
// ==========================================

export const createLoanRepaymentRequestSchema = z.object({
  loanId: z.coerce.number().int().positive('Loan is required'),
  amount: z.coerce.number().positive('Amount must be positive').max(1_000_000_000, 'Amount is too large'),
  paymentDate: z.coerce.date().refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    message: 'Payment date cannot be in the future',
  }),
  bankAccountId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  reference: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  memberNote: z.preprocess(blankToUndefined, z.string().max(500).optional()),
});

export const loanRepaymentRequestQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('20'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  memberId: z.string().optional(),
  loanId: z.string().optional(),
});
