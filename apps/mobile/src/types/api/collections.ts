/**
 * Recording payments an officer has received, and the filtered "who has paid" lists (`/api/finance/payments/batch`,
 * `/api/finance/collections/*`). Checked against finance.controller.ts and collections.controller.ts (2026-11-02).
 */
export type SettlementFilter = 'all' | 'paid' | 'part' | 'unpaid' | 'owing';
export type Settlement = 'paid' | 'part' | 'unpaid';
export type CollectionScreen = 'levy-campaign' | 'donations' | 'penalties' | 'member-ledger';
export type PaymentSource = CollectionScreen;

export type OpenChargeDTO = {
  transactionId: number;
  kind: 'levy' | 'pledge' | 'penalty' | 'charge';
  label: string;
  category: string;
  /** The campaign, cause or penalty this is for, when more specific than the category. */
  purpose: string | null;
  amount: number;
  paid: number;
  balance: number;
  status: Settlement;
  dueDate: string | null;
};

export type OpenChargesDTO = {
  member: { id: number; memberNumber: string; name: string };
  /** False when this officer is looking at their own debts and the association has not allowed recording them. */
  canRecord: boolean;
  reason: string | null;
  charges: OpenChargeDTO[];
  totalOwed: number;
};

export type RecordPaymentsPayload = {
  items: Array<{ transactionId: number; amountPaid: number }>;
  paymentMethod: string;
  paymentDate?: string;
  notes?: string;
  source: PaymentSource;
};

export type RecordedPaymentDTO = {
  paymentId: number;
  transactionId: number;
  label: string;
  amountPaid: string | number;
  receiptNumber: string;
  transactionStatus: 'paid' | 'partial';
  remainingBalance: string | number;
};

export type CollectionExportParams = {
  screen: CollectionScreen;
  format: 'xlsx' | 'pdf';
  status: SettlementFilter;
  search?: string;
  id?: number;
  allocationId?: number;
};
