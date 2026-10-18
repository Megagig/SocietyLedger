// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES VALIDATION
// ============================================

import { z } from 'zod';

// Bank Account Validation
export const createBankAccountSchema = z.object({
  bankName: z.string().min(2, 'Bank name must be at least 2 characters'),
  accountName: z.string().min(2, 'Account name must be at least 2 characters'),
  accountNumber: z.string().min(10, 'Account number must be at least 10 digits').max(10, 'Account number must be 10 digits'),
  bankCode: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  description: z.string().optional(),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

// Bank Transfer Validation
export const createBankTransferSchema = z.object({
  transactionId: z.number().int().positive().optional(),
  bankAccountId: z.number().int().positive().optional(),
  memberId: z.number().int().positive().optional(),
  senderBankName: z.string().min(2, 'Sender bank name is required'),
  senderAccountNumber: z.string().optional(),
  senderAccountName: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  reference: z.string().min(1, 'Reference is required'),
  transferDate: z.string().datetime({ message: 'Invalid transfer date' }),
  narration: z.string().optional(),
  notes: z.string().optional(),
});

export const updateBankTransferSchema = createBankTransferSchema.partial().extend({
  status: z.enum(['PENDING', 'VERIFIED', 'MATCHED', 'REJECTED']).optional(),
});

export const verifyBankTransferSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().optional(),
});

// Bank Statement Import Validation
export const statementEntrySchema = z.object({
  transactionDate: z.string(),
  valueDate: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  debitAmount: z.number().optional(),
  creditAmount: z.number().optional(),
  balance: z.number().optional(),
});

export const importStatementSchema = z.object({
  bankAccountId: z.number().int().positive('Bank account ID is required'),
  filename: z.string().min(1, 'Filename is required'),
  entries: z.array(statementEntrySchema).min(1, 'At least one entry is required'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Reconciliation Validation
export const reconcilePaymentSchema = z.object({
  transactionId: z.number().int().positive('Transaction ID is required'),
  bankTransferId: z.number().int().positive().optional(),
  statementEntryId: z.number().int().positive().optional(),
  matchType: z.enum(['AUTO_REFERENCE', 'AUTO_AMOUNT', 'MANUAL']),
  matchedAmount: z.number().positive('Matched amount must be positive'),
  variance: z.number().optional().default(0),
  notes: z.string().optional(),
});

export const confirmReconciliationSchema = z.object({
  status: z.enum(['CONFIRMED', 'DISPUTED']),
  notes: z.string().optional(),
});

// Payment Proof Validation
// R7.2 (G17): extended for the member self-declare flow — multipart form fields arrive
// as strings, so numeric/array fields are coerced/parsed here rather than assumed typed.
export const uploadPaymentProofSchema = z.object({
  transactionId: z.coerce.number().int().positive().optional(),
  bankTransferId: z.coerce.number().int().positive().optional(),
  // JSON-encoded array of transaction IDs, e.g. '[12,13]' — a member can declare one
  // payment covering several outstanding items, same as the existing /me/pay UI.
  transactionIds: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map((n) => Number(n)) : undefined;
    } catch {
      return undefined;
    }
  }),
  paymentMethod: z.enum(['bank_transfer', 'cash', 'card', 'mobile_money', 'cheque', 'other']).optional(),
  // Required instead of a file for Cash/Card/POS/etc — who was paid, when, circumstances.
  declarationNote: z.string().min(20, 'Please describe the payment in more detail (at least 20 characters)').optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.transactionId || data.bankTransferId || (data.transactionIds && data.transactionIds.length > 0),
  { message: 'transactionId, transactionIds, or bankTransferId is required' }
);

export const verifyPaymentProofSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.status !== 'REJECTED' || data.rejectionReason,
  { message: 'Rejection reason is required when rejecting' }
);

// Query Schemas
export const bankAccountQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  isActive: z.string().optional(),
});

export const bankTransferQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  memberId: z.string().optional(),
  bankAccountId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export const statementEntryQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  importId: z.string().optional(),
  matchStatus: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const reconciliationQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  matchType: z.string().optional(),
});

export const paymentProofQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  memberId: z.string().optional(),
  transactionId: z.string().optional(),
});
