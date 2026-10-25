import api from '@/lib/axios';

/**
 * Cash collections and lodgments (`/api/cash`). Officers with `cash.collect` open collections and record receipts; `cash.lodge`
 * pays collected cash into the bank; `cash.verify` checks a lodgment against the bank statement (never their own) and voids
 * receipts; `cash.view` sees every officer's cash. Rule failures come back with a plain-words `message` and a `code`.
 */

export type CashCollectionStatus = 'OPEN' | 'CLOSED';
export type CashLodgmentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type CashItemKind = 'DUES' | 'LEVY' | 'SAVINGS' | 'WELFARE' | 'DONATION' | 'LOAN_REPAYMENT';

export interface CashOfficerRef {
  id: number;
  name: string;
}

export interface CashCollection {
  id: number;
  title: string;
  meetingId: number | null;
  status: CashCollectionStatus;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
  collectedBy: CashOfficerRef;
  receiptCount: number;
  collected: number;
  lodged: number;
  toLodge: number;
}

export interface CashReceipt {
  id: number;
  receiptNumber: string;
  collectionId: number;
  status: 'ACTIVE' | 'VOIDED';
  total: number;
  createdAt: string;
  createdBy: CashOfficerRef;
  voidedAt: string | null;
  voidReason: string | null;
  member: { id: number; memberId: string | null; name: string };
  items: { id: number; kind: CashItemKind; label: string; amount: number }[];
}

export interface CashCollectionDetail extends CashCollection {
  receipts: CashReceipt[];
}

export interface CashPosition {
  officer: CashOfficerRef;
  inOpenCollections: number;
  readyToLodge: number;
  awaitingCheck: number;
  inHand: number;
  oldestUnlodgedSince: string | null;
  daysUnlodged: number;
  overdue: boolean;
}

export interface CashOverview {
  dueDays: number;
  mine: CashPosition | null;
  officers: CashPosition[];
  totals: { inHand: number; awaitingCheck: number; overdueOfficers: number } | null;
  lodgmentsToVerify: number;
}

export interface CashLodgment {
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
}

export interface CashLodgable {
  collections: { id: number; title: string; closedAt: string | null; remaining: number }[];
  total: number;
}

export interface CashPayables {
  member: { id: number; memberId: string | null; name: string };
  charges: { kind: 'DUES' | 'LEVY'; targetId: number; label: string; dueDate: string | null; amount: number; balance: number }[];
  savings: { kind: 'SAVINGS'; targetId: number; label: string; accountType: string; balance: number; suggested: number | null }[];
  welfare: { kind: 'WELFARE'; targetId: number; label: string; minimum: number | null; suggested: number | null }[];
  loans: { kind: 'LOAN_REPAYMENT'; targetId: number; label: string; status: string; outstanding: number; suggested: number | null; nextPaymentDate: string | null }[];
  donations: { categories: { id: number; name: string }[]; allocations: { id: number; name: string }[] };
}

export interface CashReceiptItemPayload {
  kind: CashItemKind;
  targetId: number;
  amount: number;
  allocationId?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export const cashApi = {
  async getOverview(): Promise<CashOverview> {
    return (await api.get('/cash/overview')).data.data;
  },

  async listCollections(params: { status?: CashCollectionStatus; page?: number; limit?: number }): Promise<Paginated<CashCollection>> {
    const data = (await api.get('/cash/collections', { params })).data.data;
    return { items: data.collections, total: data.pagination.total, totalPages: data.pagination.totalPages };
  },

  async getCollection(id: number): Promise<CashCollectionDetail> {
    return (await api.get(`/cash/collections/${id}`)).data.data;
  },

  async createCollection(payload: { title: string; meetingId?: number | null; notes?: string | null }): Promise<CashCollection> {
    return (await api.post('/cash/collections', payload)).data.data;
  },

  async closeCollection(id: number): Promise<CashCollectionDetail> {
    return (await api.post(`/cash/collections/${id}/close`)).data.data;
  },

  async getPayables(memberId: number): Promise<CashPayables> {
    return (await api.get('/cash/payables', { params: { memberId } })).data.data;
  },

  /** Safe to retry: the same idempotency key returns the receipt already made instead of crediting the member twice. */
  async recordReceipt(collectionId: number, payload: { memberId: number; idempotencyKey: string; items: CashReceiptItemPayload[] }): Promise<CashReceipt> {
    return (await api.post(`/cash/collections/${collectionId}/receipts`, payload)).data.data;
  },

  async voidReceipt(id: number, reason: string): Promise<void> {
    await api.post(`/cash/receipts/${id}/void`, { reason });
  },

  async getLodgable(): Promise<CashLodgable> {
    return (await api.get('/cash/lodgable')).data.data;
  },

  async recordLodgment(payload: {
    bankAccountId: number;
    amount: number;
    depositDate: string;
    bankReference?: string;
    shortfallReason?: string;
    collectionIds?: number[];
    slip: File;
  }): Promise<CashLodgment> {
    const form = new FormData();
    form.append('bankAccountId', String(payload.bankAccountId));
    form.append('amount', String(payload.amount));
    form.append('depositDate', payload.depositDate);
    if (payload.bankReference) form.append('bankReference', payload.bankReference);
    if (payload.shortfallReason) form.append('shortfallReason', payload.shortfallReason);
    if (payload.collectionIds?.length) form.append('collectionIds', payload.collectionIds.join(','));
    form.append('slip', payload.slip);
    return (await api.post('/cash/lodgments', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
  },

  async listLodgments(params: { status?: CashLodgmentStatus; page?: number; limit?: number }): Promise<Paginated<CashLodgment>> {
    const data = (await api.get('/cash/lodgments', { params })).data.data;
    return { items: data.lodgments, total: data.pagination.total, totalPages: data.pagination.totalPages };
  },

  async getLodgment(id: number): Promise<CashLodgment> {
    return (await api.get(`/cash/lodgments/${id}`)).data.data;
  },

  async getSlipLink(id: number): Promise<{ url: string; mimeType: string; filename: string }> {
    return (await api.get(`/cash/lodgments/${id}/slip-url`)).data.data;
  },

  async decideLodgment(id: number, payload: { status: 'VERIFIED' | 'REJECTED'; reason?: string }): Promise<CashLodgment> {
    return (await api.post(`/cash/lodgments/${id}/decision`, payload)).data.data;
  },
};

export const LODGMENT_STATUS_LABEL: Record<CashLodgmentStatus, string> = { PENDING: 'Waiting', VERIFIED: 'Verified', REJECTED: 'Rejected' };
export const LODGMENT_STATUS_COLOR: Record<CashLodgmentStatus, string> = { PENDING: 'yellow', VERIFIED: 'green', REJECTED: 'red' };

/** ₦1,234.50 — naira with kobo only when there are any. */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
}

/** The server's plain-words message for a refused action, or a fallback. */
export function cashErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

export function cashErrorCode(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}
