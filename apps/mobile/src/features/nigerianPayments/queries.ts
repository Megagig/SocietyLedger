import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { bankManageApi } from '@/api/endpoints/bankManage';
import { paymentProofsManageApi } from '@/api/endpoints/paymentProofsManage';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { BankTransferStatus } from '@/types/api/enums';
import type { ProofStatus } from '@/types/api/paymentProofsManage';

export const proofKeys = {
  all: (tenant: string) => [tenant, 'payment-proofs'] as const,
  list: (tenant: string, status: ProofStatus) => [...proofKeys.all(tenant), 'list', status] as const,
  pendingCount: (tenant: string) => [...proofKeys.all(tenant), 'pending-count'] as const,
  detail: (tenant: string, id: number) => [...proofKeys.all(tenant), 'detail', id] as const,
};

/** Seeing the proofs queue and opening a proof (the API checks `payments.view`). */
export const PROOFS_VIEW_ACCESS: PermissionAlias = 'PAYMENT_VIEW';
/** Verifying or rejecting a proof (the API checks `payments.approve`, not the spec's `payments.nigerian.verify`). */
export const PROOFS_DECIDE_ACCESS: PermissionAlias = 'PAYMENT_CONFIRM';

export const PROOFS_PAGE_SIZE = 20;

/** One status of the queue, newest first, loaded a page at a time. */
export function useProofs(status: ProofStatus) {
  const tenant = useTenantKey();
  const enabled = useCan(PROOFS_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: proofKeys.list(tenant, status),
    queryFn: ({ pageParam }) => paymentProofsManageApi.listProofs({ status, page: pageParam, limit: PROOFS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** How many proofs are waiting — the badge on the Manage hub and the Payments hub. */
export function usePendingProofCount() {
  const tenant = useTenantKey();
  const enabled = useCan(PROOFS_VIEW_ACCESS);
  return useQuery({
    queryKey: proofKeys.pendingCount(tenant),
    queryFn: () => paymentProofsManageApi.listProofs({ status: 'PENDING', page: 1, limit: 1 }),
    select: (data) => data.pagination.totalCount,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useProof(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(PROOFS_VIEW_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: proofKeys.detail(tenant, id), queryFn: () => paymentProofsManageApi.getProof(id), enabled });
}

/**
 * A signed link to the receipt, fetched when the proof opens (only if it has a file). Links last an hour; the cache is kept for
 * 50 minutes so reopening a proof doesn't refetch but a stale link is never reused.
 */
export function useProofFileLink(id: number, enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: [...proofKeys.all(tenant), 'file-link', id] as const,
    queryFn: () => paymentProofsManageApi.getFileLink(id),
    enabled: enabled && Number.isFinite(id),
    staleTime: 50 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
  });
}

// ---------------------------------------------------------------- bank transfers and bank accounts (F5.5)

export const bankKeys = {
  all: (tenant: string) => [tenant, 'bank-payments'] as const,
  transfers: (tenant: string, status: BankTransferStatus, search: string) => [...bankKeys.all(tenant), 'transfers', status, search] as const,
  pendingTransfers: (tenant: string) => [...bankKeys.all(tenant), 'pending-transfers'] as const,
  transfer: (tenant: string, id: number) => [...bankKeys.all(tenant), 'transfer', id] as const,
  accounts: (tenant: string, scope: 'active' | 'inactive') => [...bankKeys.all(tenant), 'accounts', scope] as const,
  banks: (tenant: string) => [...bankKeys.all(tenant), 'banks'] as const,
};

/** Seeing transfers (the API checks `payments.view`). */
export const TRANSFERS_VIEW_ACCESS: PermissionAlias = 'PAYMENT_VIEW';
/** Recording and editing a waiting transfer (`payments.manual_create`). */
export const TRANSFERS_RECORD_ACCESS: PermissionAlias = 'PAYMENT_CREATE';
/** Verifying or rejecting a transfer (`payments.approve`). */
export const TRANSFERS_DECIDE_ACCESS: PermissionAlias = 'PAYMENT_CONFIRM';
/** Seeing the association's bank accounts, and changing them — the administrator (`settings.edit`) or an officer who records payments (treasurer, financial secretary). */
export const BANK_ACCOUNTS_VIEW_ACCESS: PermissionAlias[] = ['SETTINGS_VIEW', 'PAYMENT_RECORD', 'PAYMENT_VIEW'];
export const BANK_ACCOUNTS_EDIT_ACCESS: PermissionAlias[] = ['SETTINGS_EDIT', 'PAYMENT_RECORD'];

/** One status of the transfers list, newest first, optionally narrowed by a search over reference, sender and narration. */
export function useTransfers(status: BankTransferStatus, search: string) {
  const tenant = useTenantKey();
  const enabled = useCan(TRANSFERS_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: bankKeys.transfers(tenant, status, search),
    queryFn: ({ pageParam }) => bankManageApi.listTransfers({ status, search: search || undefined, page: pageParam, limit: PROOFS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** How many transfers are waiting to be verified — the badge on the Payments hub. */
export function usePendingTransferCount() {
  const tenant = useTenantKey();
  const enabled = useCan(TRANSFERS_VIEW_ACCESS);
  return useQuery({
    queryKey: bankKeys.pendingTransfers(tenant),
    queryFn: () => bankManageApi.listTransfers({ status: 'PENDING', page: 1, limit: 1 }),
    select: (data) => data.pagination.totalCount,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useTransfer(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(TRANSFERS_VIEW_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: bankKeys.transfer(tenant, id), queryFn: () => bankManageApi.getTransfer(id), enabled });
}

/** The association's bank accounts as officers see them — the active ones are exactly what members are shown to pay into. */
export function useBankAccounts(scope: 'active' | 'inactive' = 'active', enabledExtra = true) {
  const tenant = useTenantKey();
  const enabled = useCan([...BANK_ACCOUNTS_VIEW_ACCESS, TRANSFERS_RECORD_ACCESS]) && enabledExtra;
  return useQuery({ queryKey: bankKeys.accounts(tenant, scope), queryFn: () => bankManageApi.listAccounts(scope === 'active'), enabled });
}

/** The static list of Nigerian banks (name + CBN code) for the bank pickers. It never changes, so it's cached for the session. */
export function useNigerianBanks() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: bankKeys.banks(tenant), queryFn: bankManageApi.listBanks, staleTime: Infinity, gcTime: Infinity });
}

export function useBankAccount(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(BANK_ACCOUNTS_VIEW_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: [...bankKeys.all(tenant), 'account', id] as const, queryFn: () => bankManageApi.getAccount(id), enabled });
}
