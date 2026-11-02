import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { coopEnhancedApi } from '@/api/endpoints/coopEnhanced';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import { COOPERATIVE_OWN_PAGES_ACCESS, COOPERATIVE_WITHDRAW_ACCESS, COOPERATIVE_WITHDRAWAL_QUEUE_ACCESS } from '@/lib/permissions';
import type {
  CoopAccountTypePayload,
  CoopLoanCategoryPayload,
  CoopRequestStatus,
  CoopSettingsDTO,
  SubmitPaymentPayload,
  WithdrawalApprovePayload,
  WithdrawalReviewPayload,
  WithdrawalStatus,
} from '@/types/api/coopEnhanced';

export const COOP_MODULE = 'cooperatives';

/**
 * Everything here sits under `[tenant, 'cooperatives', 'v2']`, inside the older cooperative root `[tenant, 'cooperatives']`. A write refreshes
 * that whole root, so a payment, a withdrawal or a new account type updates every cooperative screen that could be showing the old figure.
 * These are money screens: they are refetched whenever they open and never saved on the phone.
 */
export const coopV2Keys = {
  root: (tenant: string) => [tenant, 'cooperatives'] as const,
  all: (tenant: string) => [tenant, 'cooperatives', 'v2'] as const,
  dashboard: (tenant: string, year: number | 'current') => [...coopV2Keys.all(tenant), 'dashboard', year] as const,
  transactions: (tenant: string, range: object) => [...coopV2Keys.all(tenant), 'transactions', range] as const,
  cashbook: (tenant: string, scope: number | 'me', range: object) => [...coopV2Keys.all(tenant), 'cashbook', scope, range] as const,
  pending: (tenant: string, filters: object) => [...coopV2Keys.all(tenant), 'pending', filters] as const,
  bankAccounts: (tenant: string, search: string) => [...coopV2Keys.all(tenant), 'bank-accounts', search] as const,
  accountTypes: (tenant: string, includeInactive: boolean) => [...coopV2Keys.all(tenant), 'account-types', includeInactive] as const,
  loanCategories: (tenant: string, includeInactive: boolean) => [...coopV2Keys.all(tenant), 'loan-categories', includeInactive] as const,
  paymentRequests: (tenant: string, status: string) => [...coopV2Keys.all(tenant), 'payment-requests', status] as const,
  withdrawalSummary: (tenant: string) => [...coopV2Keys.all(tenant), 'withdrawal-summary'] as const,
  withdrawals: (tenant: string, scope: string, status: string) => [...coopV2Keys.all(tenant), 'withdrawals', scope, status] as const,
  settings: (tenant: string) => [...coopV2Keys.all(tenant), 'settings'] as const,
};

/** The member's own pages: the module is on, they may see their own cooperative, and they have a member profile (the endpoints are keyed on it). */
export function useOwnPagesEnabled(): boolean {
  const access = useModuleAccess(COOPERATIVE_OWN_PAGES_ACCESS, COOP_MODULE);
  const memberId = useMemberId();
  return access && memberId !== undefined;
}

export function useCoopDashboardV2(year?: number) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: coopV2Keys.dashboard(tenant, year ?? 'current'), queryFn: () => coopEnhancedApi.getDashboard(year), enabled: useOwnPagesEnabled(), gcTime: 0 });
}

export function useCoopTransactions(range: { from?: string; to?: string }) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: coopV2Keys.transactions(tenant, range), queryFn: () => coopEnhancedApi.getTransactions(range), enabled: useOwnPagesEnabled(), gcTime: 0 });
}

/** The member's own cashbook, or one member's for an officer (`memberId`). */
export function useCoopCashbookV2(range: { from?: string; to?: string }, memberId?: number) {
  const tenant = useTenantKey();
  const own = useOwnPagesEnabled();
  const officer = useModuleAccess('COOPERATIVE_SAVINGS_MANAGE', COOP_MODULE);
  return useQuery({
    queryKey: coopV2Keys.cashbook(tenant, memberId ?? 'me', range),
    queryFn: () => (memberId ? coopEnhancedApi.getMemberCashbook(memberId, range) : coopEnhancedApi.getCashbook(range)),
    enabled: memberId ? officer : own,
    gcTime: 0,
  });
}

export function useMyPendingPayments(filters: { from?: string; to?: string; type?: 'SAVINGS' | 'LOAN_REPAYMENT'; status?: CoopRequestStatus; sort?: 'newest' | 'oldest' }) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: coopV2Keys.pending(tenant, filters), queryFn: () => coopEnhancedApi.getPendingPayments(filters), enabled: useOwnPagesEnabled(), gcTime: 0 });
}

export function useCoopBankAccounts(search = '') {
  const tenant = useTenantKey();
  return useQuery({ queryKey: coopV2Keys.bankAccounts(tenant, search), queryFn: () => coopEnhancedApi.getBankAccounts(search || undefined), enabled: useOwnPagesEnabled(), gcTime: 0 });
}

export function useAccountTypesV2(includeInactive = false, enabled = true) {
  const tenant = useTenantKey();
  const module = useModuleAccess([COOPERATIVE_OWN_PAGES_ACCESS, 'COOPERATIVE_MANAGE_TYPES', 'COOPERATIVE_SAVINGS_MANAGE'], COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.accountTypes(tenant, includeInactive), queryFn: () => coopEnhancedApi.listAccountTypes(includeInactive), enabled: enabled && module });
}

export function useLoanCategoriesV2(includeInactive = false, enabled = true) {
  const tenant = useTenantKey();
  const module = useModuleAccess([COOPERATIVE_OWN_PAGES_ACCESS, 'COOPERATIVE_MANAGE_TYPES', 'COOPERATIVE_LOANS_MANAGE'], COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.loanCategories(tenant, includeInactive), queryFn: () => coopEnhancedApi.listLoanCategories(includeInactive), enabled: enabled && module });
}

export function useWithdrawalSummary() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(COOPERATIVE_WITHDRAW_ACCESS, COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.withdrawalSummary(tenant), queryFn: coopEnhancedApi.getWithdrawalSummary, enabled, gcTime: 0 });
}

/** The member's own withdrawals. */
export function useMyWithdrawals() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(COOPERATIVE_WITHDRAW_ACCESS, COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.withdrawals(tenant, 'mine', 'all'), queryFn: () => coopEnhancedApi.listWithdrawals({ limit: 50 }), enabled, gcTime: 0 });
}

/** The officers' withdrawal queue for one status. */
export function useWithdrawalQueue(status: WithdrawalStatus) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(COOPERATIVE_WITHDRAWAL_QUEUE_ACCESS, COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.withdrawals(tenant, 'queue', status), queryFn: () => coopEnhancedApi.listWithdrawals({ status, limit: 50 }), enabled, gcTime: 0 });
}

/** The officers' payment-request queue for one status, a page at a time. */
export function usePaymentRequestQueue(status: CoopRequestStatus) {
  const tenant = useTenantKey();
  const enabled = useModuleAccess('COOPERATIVE_SAVINGS_MANAGE', COOP_MODULE);
  return useInfiniteQuery({
    queryKey: coopV2Keys.paymentRequests(tenant, status),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => coopEnhancedApi.listPaymentRequests({ status, page: pageParam, limit: 20 }),
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
    gcTime: 0,
  });
}

export function useCoopSettings() {
  const tenant = useTenantKey();
  const enabled = useModuleAccess(['COOPERATIVE_MANAGE_TYPES', COOPERATIVE_WITHDRAW_ACCESS], COOP_MODULE);
  return useQuery({ queryKey: coopV2Keys.settings(tenant), queryFn: coopEnhancedApi.getSettings, enabled });
}

// ----------------------------------------------------------------- writes
/** Refreshes the whole cooperative root once the server has answered: a payment, withdrawal or setup change is never confirmed optimistically. */
function useRefreshCoop() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => queryClient.invalidateQueries({ queryKey: coopV2Keys.root(tenant) });
}

export function useSubmitPayment() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (payload: SubmitPaymentPayload) => coopEnhancedApi.submitPayment(payload), onSuccess: refresh });
}

export function useApprovePaymentRequest() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (id: number) => coopEnhancedApi.approvePayment(id), onSuccess: refresh });
}

export function useRejectPaymentRequest() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (input: { id: number; reason: string }) => coopEnhancedApi.rejectPayment(input.id, input.reason), onSuccess: refresh });
}

export function useRequestWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (body: { savingsAccountId: number; amount: number; reason?: string }) => coopEnhancedApi.requestWithdrawal(body), onSuccess: refresh });
}

export function useCancelWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (id: number) => coopEnhancedApi.cancelWithdrawal(id), onSuccess: refresh });
}

export function useDecideWithdrawal() {
  const refresh = useRefreshCoop();
  return {
    review: useMutation({ mutationFn: (input: { id: number; body: WithdrawalReviewPayload }) => coopEnhancedApi.reviewWithdrawal(input.id, input.body), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (input: { id: number; body: WithdrawalApprovePayload }) => coopEnhancedApi.approveWithdrawal(input.id, input.body), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (input: { id: number; reason: string }) => coopEnhancedApi.rejectWithdrawal(input.id, input.reason), onSuccess: refresh }),
  };
}

export function useSaveAccountTypeV2() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id?: number; body: CoopAccountTypePayload }) => (input.id ? coopEnhancedApi.updateAccountType(input.id, input.body) : coopEnhancedApi.createAccountType(input.body)),
    onSuccess: refresh,
  });
}

export function useSaveLoanCategoryV2() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id?: number; body: CoopLoanCategoryPayload }) => (input.id ? coopEnhancedApi.updateLoanCategory(input.id, input.body) : coopEnhancedApi.createLoanCategory(input.body)),
    onSuccess: refresh,
  });
}

export function useSaveCoopSettings() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (body: CoopSettingsDTO) => coopEnhancedApi.saveSettings(body), onSuccess: refresh });
}
