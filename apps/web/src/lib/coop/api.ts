/**
 * The cooperative API as functions. Every call goes through the shared axios instance (sign-in and tenant headers). A receipt is uploaded
 * with the request that needs it and nothing here keeps a bank detail or a receipt in a cache.
 */
import api from '@/lib/axios';
import type {
  AccountType,
  AccountTypeInput,
  BankAccount,
  Cashbook,
  CoopDashboard,
  CoopSettings,
  CoopTransactions,
  LoanCategory,
  LoanCategoryInput,
  Pagination,
  PaymentLineInput,
  PaymentRequest,
  PendingPayments,
  RequestStatus,
  Withdrawal,
  WithdrawalStatus,
  WithdrawalSummary,
} from './types';

type Envelope<T> = { success: boolean; message?: string; data: T };
const unwrap = async <T>(request: Promise<{ data: Envelope<T> }>): Promise<T> => (await request).data.data;

/** The plain-words reason for a failed call (the API writes its messages for the person reading them), or a fallback. */
export function coopErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return body?.message || fallback;
}

export function coopErrorCode(error: unknown): string | undefined {
  const body = (error as { response?: { data?: { code?: string } } })?.response?.data;
  return body?.code;
}

export function coopErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

const BASE = '/cooperatives';
const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const coopApi = {
  // ----- Member pages -----
  dashboard: (year?: number) => unwrap<CoopDashboard>(api.get(`${BASE}/my-dashboard`, { params: clean({ year }) })),
  transactions: (range: { from?: string; to?: string }) => unwrap<CoopTransactions>(api.get(`${BASE}/my-transactions`, { params: clean(range) })),
  cashbook: (range: { from?: string; to?: string }) => unwrap<Cashbook>(api.get(`${BASE}/my-cashbook`, { params: clean(range) })),
  pendingPayments: (params: { from?: string; to?: string; type?: string; status?: string; sort?: string }) =>
    unwrap<PendingPayments>(api.get(`${BASE}/my-pending-payments`, { params: clean(params) })),
  bankAccounts: async (search?: string) =>
    (await unwrap<{ bankAccounts: BankAccount[] }>(api.get(`${BASE}/bank-accounts`, { params: clean({ search }) }))).bankAccounts,

  // ----- Types and categories -----
  accountTypes: (includeInactive = false) => unwrap<AccountType[]>(api.get(`${BASE}/account-types`, { params: includeInactive ? { includeInactive: 'true' } : {} })),
  createAccountType: (body: AccountTypeInput & { name: string }) => unwrap<AccountType>(api.post(`${BASE}/account-types`, body)),
  updateAccountType: (id: number, body: AccountTypeInput) => unwrap<AccountType>(api.put(`${BASE}/account-types/${id}`, body)),
  loanCategories: (includeInactive = false) => unwrap<LoanCategory[]>(api.get(`${BASE}/loan-categories`, { params: includeInactive ? { includeInactive: 'true' } : {} })),
  createLoanCategory: (body: LoanCategoryInput & { name: string }) => unwrap<LoanCategory>(api.post(`${BASE}/loan-categories`, body)),
  updateLoanCategory: (id: number, body: LoanCategoryInput) => unwrap<LoanCategory>(api.put(`${BASE}/loan-categories/${id}`, body)),

  // ----- Payment requests (one transfer, one proof, one or more lines) -----
  submitPayment: (input: { lines: PaymentLineInput[]; paymentDate: string; bankAccountId?: number; reference?: string; memberNote?: string; file: File }) => {
    const form = new FormData();
    form.append('lines', JSON.stringify(input.lines));
    form.append('paymentDate', input.paymentDate);
    if (input.bankAccountId) form.append('bankAccountId', String(input.bankAccountId));
    if (input.reference) form.append('reference', input.reference);
    if (input.memberNote) form.append('memberNote', input.memberNote);
    form.append('file', input.file);
    return unwrap<PaymentRequest>(api.post(`${BASE}/payment-requests`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  paymentRequests: (params: { page?: number; limit?: number; status?: RequestStatus; memberId?: number }) =>
    unwrap<{ requests: PaymentRequest[]; pagination: Pagination }>(api.get(`${BASE}/payment-requests`, { params: clean(params) })),
  paymentReceiptUrl: (id: number) => unwrap<{ url: string; filename: string; mimeType: string }>(api.get(`${BASE}/payment-requests/${id}/receipt`, { params: { format: 'json' } })),
  approvePayment: (id: number) => unwrap<PaymentRequest>(api.post(`${BASE}/payment-requests/${id}/approve`, {})),
  rejectPayment: (id: number, reason: string) => unwrap<PaymentRequest>(api.post(`${BASE}/payment-requests/${id}/reject`, { reason })),

  // ----- Withdrawals -----
  withdrawalSummary: () => unwrap<WithdrawalSummary>(api.get(`${BASE}/withdrawal-summary`)),
  withdrawals: (params: { page?: number; limit?: number; status?: WithdrawalStatus; memberId?: number }) =>
    unwrap<{ requests: Withdrawal[]; pagination: Pagination }>(api.get(`${BASE}/withdrawal-requests`, { params: clean(params) })),
  requestWithdrawal: (body: { savingsAccountId: number; amount: number; reason?: string }) => unwrap<Withdrawal>(api.post(`${BASE}/withdrawal-requests`, body)),
  cancelWithdrawal: (id: number) => unwrap<Withdrawal>(api.post(`${BASE}/withdrawal-requests/${id}/cancel`, {})),
  reviewWithdrawal: (id: number, body: { decision: 'FORWARD'; comment?: string } | { decision: 'REJECT'; reason: string }) =>
    unwrap<Withdrawal>(api.post(`${BASE}/withdrawal-requests/${id}/review`, body)),
  approveWithdrawal: (id: number, body: { payoutMethod: string; payoutReference?: string; comment?: string }) =>
    unwrap<Withdrawal>(api.post(`${BASE}/withdrawal-requests/${id}/approve`, body)),
  rejectWithdrawal: (id: number, reason: string) => unwrap<Withdrawal>(api.post(`${BASE}/withdrawal-requests/${id}/reject`, { reason })),

  // ----- Settings -----
  settings: () => unwrap<CoopSettings>(api.get(`${BASE}/settings`)),
  saveSettings: (body: CoopSettings) => unwrap<CoopSettings>(api.put(`${BASE}/settings`, body)),

  // ----- Officer view of one member -----
  memberDashboard: (memberId: number, year?: number) => unwrap<CoopDashboard>(api.get(`${BASE}/members/${memberId}/dashboard`, { params: clean({ year }) })),
  memberCashbook: (memberId: number, range: { from?: string; to?: string }) => unwrap<Cashbook>(api.get(`${BASE}/members/${memberId}/cashbook`, { params: clean(range) })),
};
