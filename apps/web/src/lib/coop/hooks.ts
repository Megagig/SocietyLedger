'use client';

/**
 * Cooperative queries and mutations. Every read sits in the `cooperatives` money domain (refetched whenever a screen opens, never shown from
 * a saved copy), and every write names the `cooperative.changed` event so the member's pages, the officers' queues and the totals all refresh
 * together once the server has answered. Money is never confirmed optimistically.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateFor } from '@societyledger/query';
import { useQueryScope, useScopedQuery } from '@/lib/query';
import { coopApi } from './api';
import type { RequestStatus, WithdrawalStatus } from './types';

const DOMAIN = 'cooperatives';

export const useCoopDashboard = (year?: number) =>
  useScopedQuery({ domain: DOMAIN, personal: true, parts: ['dashboard', year ?? 'current'], queryFn: () => coopApi.dashboard(year) });

export const useCoopTransactions = (range: { from?: string; to?: string }) =>
  useScopedQuery({ domain: DOMAIN, personal: true, parts: ['transactions', range.from ?? '', range.to ?? ''], queryFn: () => coopApi.transactions(range) });

export const useCoopCashbook = (range: { from?: string; to?: string }, enabled = true) =>
  useScopedQuery({ domain: DOMAIN, personal: true, parts: ['cashbook', range.from ?? '', range.to ?? ''], queryFn: () => coopApi.cashbook(range), enabled });

export const useMyPendingPayments = (params: { from?: string; to?: string; type?: string; status?: string; sort?: string }) =>
  useScopedQuery({
    domain: DOMAIN,
    personal: true,
    parts: ['pending-payments', params.from ?? '', params.to ?? '', params.type ?? '', params.status ?? '', params.sort ?? ''],
    queryFn: () => coopApi.pendingPayments(params),
  });

export const useCoopBankAccounts = (search?: string) =>
  useScopedQuery({ domain: DOMAIN, parts: ['bank-accounts', search ?? ''], queryFn: () => coopApi.bankAccounts(search) });

export const useAccountTypes = (includeInactive = false) =>
  useScopedQuery({ domain: DOMAIN, parts: ['account-types', String(includeInactive)], queryFn: () => coopApi.accountTypes(includeInactive) });

export const useLoanCategories = (includeInactive = false) =>
  useScopedQuery({ domain: DOMAIN, parts: ['loan-categories', String(includeInactive)], queryFn: () => coopApi.loanCategories(includeInactive) });

export const useWithdrawalSummary = () =>
  useScopedQuery({ domain: DOMAIN, personal: true, parts: ['withdrawal-summary'], queryFn: coopApi.withdrawalSummary });

export const useMyWithdrawals = (page = 1) =>
  useScopedQuery({ domain: DOMAIN, personal: true, parts: ['withdrawals', 'mine', page], queryFn: () => coopApi.withdrawals({ page, limit: 20 }) });

export const useCoopSettings = () => useScopedQuery({ domain: DOMAIN, parts: ['settings'], queryFn: coopApi.settings });

// ----- Officer queues -----

export const usePaymentRequests = (params: { page?: number; status?: RequestStatus; memberId?: number }) =>
  useScopedQuery({
    domain: DOMAIN,
    parts: ['payment-requests', params.page ?? 1, params.status ?? 'all', params.memberId ?? 'all'],
    queryFn: () => coopApi.paymentRequests({ limit: 20, ...params }),
  });

export const useWithdrawalQueue = (params: { page?: number; status?: WithdrawalStatus; memberId?: number }) =>
  useScopedQuery({
    domain: DOMAIN,
    parts: ['withdrawals', 'queue', params.page ?? 1, params.status ?? 'all', params.memberId ?? 'all'],
    queryFn: () => coopApi.withdrawals({ limit: 20, ...params }),
  });

export const useMemberDashboard = (memberId: number, year?: number) =>
  useScopedQuery({ domain: DOMAIN, parts: ['member-dashboard', memberId, year ?? 'current'], queryFn: () => coopApi.memberDashboard(memberId, year), enabled: memberId > 0 });

export const useMemberCashbook = (memberId: number, range: { from?: string; to?: string }) =>
  useScopedQuery({
    domain: DOMAIN,
    parts: ['member-cashbook', memberId, range.from ?? '', range.to ?? ''],
    queryFn: () => coopApi.memberCashbook(memberId, range),
    enabled: memberId > 0,
  });

// ----- Writes -----

/** Refreshes everything a cooperative change can touch, once the server has answered. */
function useRefreshCoop() {
  const queryClient = useQueryClient();
  const { tenant } = useQueryScope();
  return () => invalidateFor(queryClient, tenant, 'cooperative.changed');
}

export function useSubmitPayment() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: coopApi.submitPayment, onSuccess: refresh });
}

export function useDecidePayment() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id: number; decision: 'approve' } | { id: number; decision: 'reject'; reason: string }) =>
      input.decision === 'approve' ? coopApi.approvePayment(input.id) : coopApi.rejectPayment(input.id, input.reason),
    onSuccess: refresh,
  });
}

export function useRequestWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: coopApi.requestWithdrawal, onSuccess: refresh });
}

export function useCancelWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (id: number) => coopApi.cancelWithdrawal(id), onSuccess: refresh });
}

export function useReviewWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id: number; body: Parameters<typeof coopApi.reviewWithdrawal>[1] }) => coopApi.reviewWithdrawal(input.id, input.body),
    onSuccess: refresh,
  });
}

export function useApproveWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id: number; body: Parameters<typeof coopApi.approveWithdrawal>[1] }) => coopApi.approveWithdrawal(input.id, input.body),
    onSuccess: refresh,
  });
}

export function useRejectWithdrawal() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: (input: { id: number; reason: string }) => coopApi.rejectWithdrawal(input.id, input.reason), onSuccess: refresh });
}

export function useSaveAccountType() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id?: number; body: Parameters<typeof coopApi.createAccountType>[0] }) =>
      input.id ? coopApi.updateAccountType(input.id, input.body) : coopApi.createAccountType(input.body),
    onSuccess: refresh,
  });
}

export function useSaveLoanCategory() {
  const refresh = useRefreshCoop();
  return useMutation({
    mutationFn: (input: { id?: number; body: Parameters<typeof coopApi.createLoanCategory>[0] }) =>
      input.id ? coopApi.updateLoanCategory(input.id, input.body) : coopApi.createLoanCategory(input.body),
    onSuccess: refresh,
  });
}

export function useSaveCoopSettings() {
  const refresh = useRefreshCoop();
  return useMutation({ mutationFn: coopApi.saveSettings, onSuccess: refresh });
}

