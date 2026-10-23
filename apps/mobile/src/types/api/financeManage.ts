import type { MoneyValue } from './common';

/**
 * Officer side of finance (`/api/finance`): the overview, charges ("transactions"), and manual payments. Amounts arrive as decimal
 * strings — show them through `Money`. Rule failures come back as 400/403/404/409 with a plain-words `message` and sometimes a `code`.
 */

export type ChargeStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type ChargeKind = 'due' | 'levy' | 'penalty' | 'donation';
export type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'mobile_money' | 'cheque' | 'other';

export type FinanceDashboardDTO = {
  overview: { totalMembers: number; activeCategories: number; overdueTransactions: number };
  thisMonth: { transactionsCreated: number; transactionsAmount: MoneyValue; paymentsReceived: number; paymentsAmount: MoneyValue };
  totals: { totalOutstanding: MoneyValue; totalCollected: MoneyValue };
  recentPayments: {
    id: number;
    amountPaid: MoneyValue;
    paymentDate: string;
    paymentMethod: string | null;
    receiptNumber: string | null;
    transaction: { member: { firstName: string; lastName: string } | null; category: { name: string; type: string } | null };
  }[];
};

export type ChargeStatsDTO = {
  totalTransactions: number;
  totalAmount: MoneyValue;
  totalPaid: MoneyValue;
  totalOutstanding: MoneyValue;
  byStatus: Record<string, { count: number; amount: MoneyValue }>;
  byType: Record<string, { count: number; amount: MoneyValue }>;
};

export type ChargePaymentDTO = { id: number; amountPaid: MoneyValue; paymentDate: string; paymentMethod: string | null };

export type ChargeListItemDTO = {
  id: number;
  memberId: number;
  categoryId: number;
  amount: MoneyValue;
  referenceNumber: string | null;
  status: string;
  dueDate: string | null;
  paymentDate: string | null;
  notes: string | null;
  isVoided: boolean;
  voidReason: string | null;
  createdAt: string;
  member: { id: number; memberId: string | null; firstName: string; lastName: string; email: string | null };
  category: { id: number; name: string; type: string };
  payments: ChargePaymentDTO[];
  totalPaid: MoneyValue;
  balance: MoneyValue;
};

export type ChargeListDTO = {
  transactions: ChargeListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type ChargeListParams = {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  categoryId?: number;
  memberId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
};

export type ChargeDetailDTO = Omit<ChargeListItemDTO, 'payments'> & {
  replaces: number | null;
  replacedBy: number | null;
  voidedAt: string | null;
  accountingSynced?: boolean;
  member: ChargeListItemDTO['member'] & { phone: string | null };
  category: { id: number; name: string; type: string; description?: string | null };
  payments: (ChargePaymentDTO & { receiptNumber: string | null; confirmedAt: string | null; confirmer: { id: number; email: string } | null })[];
  creator: { id: number; email: string } | null;
};

export type FinanceCategoryDTO = { id: number; name: string; type: string; amount: MoneyValue | null; frequency: string | null; isActive: boolean };

export type CreateChargePayload = { memberId: number; categoryId: number; amount: number; dueDate?: string | null; notes?: string | null };
export type BulkChargePayload = { categoryId: number; memberIds: number[]; amount: number; dueDate?: string | null; notes?: string | null };
export type EditChargePayload = Partial<CreateChargePayload> & { editReason: string };
export type VoidReplacePayload = { voidReason: string; password: string; newTransaction: CreateChargePayload };

export type RecordPaymentPayload = { transactionId: number; amountPaid: number; paymentMethod?: ManualPaymentMethod; paymentDate?: string; notes?: string | null };
export type RecordPaymentResultDTO = { payment: { id: number; receiptNumber: string | null }; transactionStatus: string; remainingBalance: MoneyValue };
