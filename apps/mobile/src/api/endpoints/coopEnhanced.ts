import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CashbookDTO,
  CoopAccountTypeDTO,
  CoopAccountTypePayload,
  CoopBankAccountDTO,
  CoopDashboardDTO,
  CoopLoanCategoryDTO,
  CoopLoanCategoryPayload,
  CoopRequestStatus,
  CoopSettingsDTO,
  CoopTransactionsDTO,
  PaymentRequestDTO,
  PaymentRequestsDTO,
  PendingPaymentsDTO,
  SubmitPaymentPayload,
  WithdrawalApprovePayload,
  WithdrawalDTO,
  WithdrawalReviewPayload,
  WithdrawalStatus,
  WithdrawalSummaryDTO,
  WithdrawalsDTO,
} from '@/types/api/coopEnhanced';

type Range = { from?: string; to?: string };
const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null));

/**
 * `/cooperatives/*` additions — the officer-defined account types and loan categories, the member's own dashboard, transactions, cashbook
 * and pending payments, payment requests (one transfer, one proof, many lines), and two-stage withdrawals. Tenant + `cooperatives` module
 * required. Every path was checked against cooperative-enhancements.controller.ts (2026-11-02).
 */
export const coopEnhancedApi = {
  // ---------------------------------------------------------------- a member's own pages
  /** GET /cooperatives/my-dashboard */
  getDashboard: (year?: number) => unwrap<CoopDashboardDTO>(client.get('/cooperatives/my-dashboard', { params: clean({ year }) })),
  /** GET /cooperatives/my-transactions */
  getTransactions: (range: Range) => unwrap<CoopTransactionsDTO>(client.get('/cooperatives/my-transactions', { params: clean(range) })),
  /** GET /cooperatives/my-cashbook */
  getCashbook: (range: Range) => unwrap<CashbookDTO>(client.get('/cooperatives/my-cashbook', { params: clean(range) })),
  /** GET /cooperatives/my-pending-payments */
  getPendingPayments: (params: Range & { type?: 'SAVINGS' | 'LOAN_REPAYMENT'; status?: CoopRequestStatus; sort?: 'newest' | 'oldest' }) =>
    unwrap<PendingPaymentsDTO>(client.get('/cooperatives/my-pending-payments', { params: clean(params) })),
  /** GET /cooperatives/bank-accounts — read-only: the active accounts a member can pay into. */
  async getBankAccounts(search?: string): Promise<CoopBankAccountDTO[]> {
    return (await unwrap<{ bankAccounts: CoopBankAccountDTO[] }>(client.get('/cooperatives/bank-accounts', { params: clean({ search }) }))).bankAccounts;
  },

  // ---------------------------------------------------------------- account types and loan categories
  /** GET /cooperatives/account-types */
  listAccountTypes: (includeInactive = false) =>
    unwrap<CoopAccountTypeDTO[]>(client.get('/cooperatives/account-types', { params: includeInactive ? { includeInactive: 'true' } : {} })),
  /** POST /cooperatives/account-types (cooperatives.manage_types) */
  createAccountType: (body: CoopAccountTypePayload) => unwrap<CoopAccountTypeDTO>(client.post('/cooperatives/account-types', body)),
  /** PUT /cooperatives/account-types/:id */
  updateAccountType: (id: number, body: Partial<CoopAccountTypePayload>) => unwrap<CoopAccountTypeDTO>(client.put(`/cooperatives/account-types/${id}`, body)),
  /** GET /cooperatives/loan-categories */
  listLoanCategories: (includeInactive = false) =>
    unwrap<CoopLoanCategoryDTO[]>(client.get('/cooperatives/loan-categories', { params: includeInactive ? { includeInactive: 'true' } : {} })),
  createLoanCategory: (body: CoopLoanCategoryPayload) => unwrap<CoopLoanCategoryDTO>(client.post('/cooperatives/loan-categories', body)),
  updateLoanCategory: (id: number, body: Partial<CoopLoanCategoryPayload>) => unwrap<CoopLoanCategoryDTO>(client.put(`/cooperatives/loan-categories/${id}`, body)),

  // ---------------------------------------------------------------- payment requests
  /** POST /cooperatives/payment-requests (multipart): `lines` is a JSON string; one proof file; a PENDING request, nothing is credited yet. */
  submitPayment(payload: SubmitPaymentPayload): Promise<PaymentRequestDTO> {
    const formData = new FormData();
    formData.append('lines', JSON.stringify(payload.lines));
    formData.append('paymentDate', payload.paymentDate);
    if (payload.bankAccountId) formData.append('bankAccountId', String(payload.bankAccountId));
    if (payload.reference) formData.append('reference', payload.reference);
    if (payload.memberNote) formData.append('memberNote', payload.memberNote);
    formData.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as never);
    return unwrap<PaymentRequestDTO>(client.post('/cooperatives/payment-requests', formData, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  /** GET /cooperatives/payment-requests — a member gets their own; an officer everyone's. */
  listPaymentRequests: (params: { page?: number; limit?: number; status?: CoopRequestStatus; memberId?: number }) =>
    unwrap<PaymentRequestsDTO>(client.get('/cooperatives/payment-requests', { params: clean(params) })),
  /** GET /cooperatives/payment-requests/:id/receipt?format=json — a short-lived link, asked for only when a person opens it. */
  getPaymentReceiptUrl: (id: number) =>
    unwrap<{ url: string; filename: string; mimeType: string }>(client.get(`/cooperatives/payment-requests/${id}/receipt`, { params: { format: 'json' } })),
  /** POST /cooperatives/payment-requests/:id/approve — posts every line, or none. */
  approvePayment: (id: number) => unwrap<PaymentRequestDTO>(client.post(`/cooperatives/payment-requests/${id}/approve`, {})),
  rejectPayment: (id: number, reason: string) => unwrap<PaymentRequestDTO>(client.post(`/cooperatives/payment-requests/${id}/reject`, { reason })),

  // ---------------------------------------------------------------- withdrawals
  /** GET /cooperatives/withdrawal-summary */
  getWithdrawalSummary: () => unwrap<WithdrawalSummaryDTO>(client.get('/cooperatives/withdrawal-summary')),
  /** GET /cooperatives/withdrawal-requests — own for a member; every request for an officer. */
  listWithdrawals: (params: { page?: number; limit?: number; status?: WithdrawalStatus; memberId?: number }) =>
    unwrap<WithdrawalsDTO>(client.get('/cooperatives/withdrawal-requests', { params: clean(params) })),
  requestWithdrawal: (body: { savingsAccountId: number; amount: number; reason?: string }) => unwrap<WithdrawalDTO>(client.post('/cooperatives/withdrawal-requests', body)),
  cancelWithdrawal: (id: number) => unwrap<WithdrawalDTO>(client.post(`/cooperatives/withdrawal-requests/${id}/cancel`, {})),
  /** Stage one (cooperatives.withdrawals.review). */
  reviewWithdrawal: (id: number, body: WithdrawalReviewPayload) => unwrap<WithdrawalDTO>(client.post(`/cooperatives/withdrawal-requests/${id}/review`, body)),
  /** Stage two (cooperatives.withdrawals.approve): moves the money. */
  approveWithdrawal: (id: number, body: WithdrawalApprovePayload) => unwrap<WithdrawalDTO>(client.post(`/cooperatives/withdrawal-requests/${id}/approve`, body)),
  rejectWithdrawal: (id: number, reason: string) => unwrap<WithdrawalDTO>(client.post(`/cooperatives/withdrawal-requests/${id}/reject`, { reason })),

  // ---------------------------------------------------------------- settings
  getSettings: () => unwrap<CoopSettingsDTO>(client.get('/cooperatives/settings')),
  saveSettings: (body: CoopSettingsDTO) => unwrap<CoopSettingsDTO>(client.put('/cooperatives/settings', body)),

  // ---------------------------------------------------------------- an officer opening one member's pages
  /** GET /cooperatives/members/:id/cashbook (ledger.create) */
  getMemberCashbook: (memberId: number, range: Range) => unwrap<CashbookDTO>(client.get(`/cooperatives/members/${memberId}/cashbook`, { params: clean(range) })),
};
