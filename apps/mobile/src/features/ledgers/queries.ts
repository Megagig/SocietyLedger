import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ledgerManageApi } from '@/api/endpoints/ledgerManage';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';

export const ledgerKeys = {
  all: (tenant: string) => [tenant, 'memberLedger', 'officer'] as const,
  members: (tenant: string, search: string) => [...ledgerKeys.all(tenant), 'members', search] as const,
  summary: (tenant: string, memberId: number) => [...ledgerKeys.all(tenant), 'summary', memberId] as const,
  entries: (tenant: string, memberId: number) => [...ledgerKeys.all(tenant), 'entries', memberId] as const,
};

/** Seeing member ledgers (the API checks `ledger.view`). */
export const LEDGERS_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
/** Resyncing a ledger — the API checks `payments.approve`. */
export const LEDGERS_RESYNC_ACCESS: PermissionAlias = 'FINANCE_APPROVE';

export const LEDGERS_PAGE_SIZE = 30;

export function useLedgerMembers(search: string) {
  const tenant = useTenantKey();
  const enabled = useCan(LEDGERS_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: ledgerKeys.members(tenant, search),
    queryFn: ({ pageParam }) => ledgerManageApi.listMembers({ page: pageParam, limit: LEDGERS_PAGE_SIZE, search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useLedgerSummary(memberId: number) {
  const tenant = useTenantKey();
  const enabled = useCan(LEDGERS_VIEW_ACCESS) && Number.isFinite(memberId);
  return useQuery({ queryKey: ledgerKeys.summary(tenant, memberId), queryFn: () => ledgerManageApi.getSummary(memberId), enabled });
}

export function useLedgerEntries(memberId: number) {
  const tenant = useTenantKey();
  const enabled = useCan(LEDGERS_VIEW_ACCESS) && Number.isFinite(memberId);
  return useInfiniteQuery({
    queryKey: ledgerKeys.entries(tenant, memberId),
    queryFn: ({ pageParam }) => ledgerManageApi.getEntries(memberId, { page: pageParam, limit: 50 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled,
  });
}
