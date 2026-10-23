import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { paymentProofsManageApi } from '@/api/endpoints/paymentProofsManage';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
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
