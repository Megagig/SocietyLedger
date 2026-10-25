import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================
// EXPENSES API CLIENT
// Spending recorded after it is paid: approved by a second officer, then posted to the books.
// ============================================

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'VOIDED';

export interface ExpenseAccountRef {
  id: number;
  code: string;
  name: string;
}

/** Where a category stands against its budget line if this voucher is counted. `overBy` is zero unless it takes the line past its plan. */
export interface BudgetPosition {
  budgetId: number;
  budgetName: string;
  planned: string | number;
  spent: string | number;
  thisVoucher: string | number;
  left: string | number;
  overBy: string | number;
}

export interface Expense {
  id: number;
  voucherNumber: string;
  expenseDate: string;
  payee: string;
  description: string;
  amount: string | number;
  category: ExpenseAccountRef;
  paidFrom: ExpenseAccountRef;
  reference: string | null;
  noReceiptReason: string | null;
  hasReceipt: boolean;
  receiptType: string | null;
  status: ExpenseStatus;
  createdBy: number;
  createdByEmail: string | null;
  submittedAt: string | null;
  approvedBy: number | null;
  approvedByEmail: string | null;
  approvedAt: string | null;
  overBudget: boolean;
  rejectedByEmail: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  voidedByEmail: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  journalEntryId: number | null;
  reversalEntryId: number | null;
  createdAt: string;
}

export interface ExpenseDetail extends Expense {
  budget: BudgetPosition | null;
  /** While it waits: how many officers other than the one who recorded it can approve it. Zero means nobody can decide it yet. Null once it is no longer waiting. */
  otherApprovers: number | null;
}

export interface ExpenseOptions {
  categories: { id: number; code: string; name: string; parentId: number | null }[];
  paidFrom: ExpenseAccountRef[];
  receiptRequiredAbove: string | number;
}

export interface ExpenseInput {
  payee: string;
  description: string;
  amount: number;
  expenseDate: string;
  categoryAccountId: number;
  paidFromAccountId: number;
  reference?: string | null;
  noReceiptReason?: string | null;
}

const url = (path: string) => `${API_URL}/api/expenses${path}`;

export const expensesApi = {
  async getOptions() {
    return (await api.get(url('/options'))).data;
  },

  async checkBudget(params: { categoryAccountId: number; amount: number; date: string }) {
    return (await api.get(url('/budget-check'), { params })).data;
  },

  async list(params?: { status?: string; search?: string; mine?: boolean; page?: number; limit?: number }) {
    return (await api.get(url(''), { params: { ...params, mine: params?.mine ? 'true' : undefined } })).data;
  },

  async get(id: number) {
    return (await api.get(url(`/${id}`))).data;
  },

  async create(data: ExpenseInput) {
    return (await api.post(url(''), data)).data;
  },

  async update(id: number, data: ExpenseInput) {
    return (await api.put(url(`/${id}`), data)).data;
  },

  async remove(id: number) {
    return (await api.delete(url(`/${id}`))).data;
  },

  /** The receipt is a file: a JPEG, PNG, WebP or PDF up to 5MB, checked on the server by its real contents. */
  async uploadReceipt(id: number, file: File) {
    const form = new FormData();
    form.append('receipt', file);
    return (await api.post(url(`/${id}/receipt`), form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },

  async removeReceipt(id: number) {
    return (await api.delete(url(`/${id}/receipt`))).data;
  },

  /** A signed link to the receipt, valid for an hour. */
  async receiptUrl(id: number): Promise<{ data: { url: string; type: string | null } }> {
    return (await api.get(url(`/${id}/receipt-url`))).data;
  },

  async submit(id: number) {
    return (await api.post(url(`/${id}/submit`))).data;
  },

  /** The officer who sent it takes it back, to change it. */
  async withdraw(id: number) {
    return (await api.post(url(`/${id}/withdraw`))).data;
  },

  /** Approving posts it to the books, so the approver's password goes with it. */
  async approve(id: number, password: string) {
    return (await api.post(url(`/${id}/approve`), { password })).data;
  },

  async reject(id: number, reason: string) {
    return (await api.post(url(`/${id}/reject`), { reason })).data;
  },

  /** Cancels an approved expense with a reversing entry; needs a reason and the password. */
  async voidExpense(id: number, data: { reason: string; password: string }) {
    return (await api.post(url(`/${id}/void`), data)).data;
  },
};
