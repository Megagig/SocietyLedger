import type { MoneyValue } from './common';

/**
 * Cash collections and lodgments — officers collect cash from members at meetings and later lodge it into a bank account
 * (`/api/cash/*`). Amounts here are plain numbers in naira (the API rounds to kobo); show them through `Money`.
 */

export type CashCollectionStatus = 'OPEN' | 'CLOSED';
export type CashReceiptStatus = 'ACTIVE' | 'VOIDED';
export type CashLodgmentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CashItemKind = 'DUES' | 'LEVY' | 'SAVINGS' | 'WELFARE' | 'DONATION' | 'LOAN_REPAYMENT';

export type CashOfficerRef = { id: number; name: string };

export type CashCollectionDTO = {
  id: number;
  title: string;
  meetingId: number | null;
  status: CashCollectionStatus;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  collectedBy: CashOfficerRef;
  receiptCount: number;
  /** Total of the receipts that are not voided. */
  collected: number;
  /** Already in a lodgment that is waiting or verified. */
  lodged: number;
  /** Still to be lodged. */
  toLodge: number;
};

export type CashReceiptItemDTO = { id: number; kind: CashItemKind; label: string; amount: number };

export type CashReceiptDTO = {
  id: number;
  receiptNumber: string;
  collectionId: number;
  status: CashReceiptStatus;
  total: number;
  createdAt: string;
  createdBy: CashOfficerRef;
  voidedAt: string | null;
  voidReason: string | null;
  member: { id: number; memberId: string | null; name: string };
  items: CashReceiptItemDTO[];
};

export type CashCollectionDetailDTO = CashCollectionDTO & { receipts: CashReceiptDTO[] };

export type CashCollectionListDTO = {
  collections: CashCollectionDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type CashPositionDTO = {
  officer: CashOfficerRef;
  inOpenCollections: number;
  readyToLodge: number;
  awaitingCheck: number;
  inHand: number;
  oldestUnlodgedSince: string | null;
  daysUnlodged: number;
  overdue: boolean;
};

export type CashOverviewDTO = {
  dueDays: number;
  mine: CashPositionDTO | null;
  /** Every officer holding or awaiting cash — empty unless the caller can view all cash. */
  officers: CashPositionDTO[];
  totals: { inHand: number; awaitingCheck: number; overdueOfficers: number } | null;
  lodgmentsToVerify: number;
};

export type CashLodgmentDTO = {
  id: number;
  status: CashLodgmentStatus;
  amount: number;
  expectedAmount: number;
  shortfall: number;
  shortfallReason: string | null;
  depositDate: string;
  bankReference: string | null;
  hasSlip: boolean;
  bankAccount: { id: number; bankName: string; accountName: string; accountNumber: string };
  lodgedBy: CashOfficerRef;
  verifiedBy: CashOfficerRef | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  collections: { id: number; title: string; amount: number }[];
};

export type CashLodgmentListDTO = {
  lodgments: CashLodgmentDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type CashLodgableDTO = {
  collections: { id: number; title: string; closedAt: string | null; remaining: number }[];
  total: number;
};

/** What a member could pay today, grouped by kind. */
export type CashPayablesDTO = {
  member: { id: number; memberId: string | null; name: string };
  charges: { kind: 'DUES' | 'LEVY'; targetId: number; label: string; dueDate: string | null; amount: number; balance: number }[];
  savings: { kind: 'SAVINGS'; targetId: number; label: string; accountType: string; balance: number; suggested: number | null }[];
  welfare: { kind: 'WELFARE'; targetId: number; label: string; minimum: number | null; suggested: number | null }[];
  loans: { kind: 'LOAN_REPAYMENT'; targetId: number; label: string; status: string; outstanding: number; suggested: number | null; nextPaymentDate: string | null }[];
  donations: { categories: { id: number; name: string }[]; allocations: { id: number; name: string }[] };
};

export type CashReceiptItemPayload = { kind: CashItemKind; targetId: number; amount: number; allocationId?: number };

export type RecordCashReceiptPayload = { memberId: number; idempotencyKey: string; items: CashReceiptItemPayload[] };

/** A short-lived signed link to the deposit slip photo or PDF. */
export type CashSlipLinkDTO = { url: string; mimeType: string; filename: string };

export type CreateCashCollectionPayload = { title: string; meetingId?: number | null; notes?: string | null };

export type RecordLodgmentPayload = {
  bankAccountId: number;
  amount: MoneyValue;
  depositDate: string;
  bankReference?: string;
  shortfallReason?: string;
  collectionIds?: number[];
  slip: { uri: string; name: string; type: string };
};

export type CashLodgmentDecisionPayload = { status: 'VERIFIED' | 'REJECTED'; reason?: string };
