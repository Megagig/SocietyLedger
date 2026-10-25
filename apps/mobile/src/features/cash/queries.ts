import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { cashApi } from '@/api/endpoints/cash';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { CashCollectionStatus, CashLodgmentStatus } from '@/types/api/cash';

export const cashKeys = {
  all: (tenant: string) => [tenant, 'cash'] as const,
  overview: (tenant: string) => [...cashKeys.all(tenant), 'overview'] as const,
  collections: (tenant: string, status: CashCollectionStatus) => [...cashKeys.all(tenant), 'collections', status] as const,
  collection: (tenant: string, id: number) => [...cashKeys.all(tenant), 'collection', id] as const,
  payables: (tenant: string, memberId: number) => [...cashKeys.all(tenant), 'payables', memberId] as const,
  lodgable: (tenant: string) => [...cashKeys.all(tenant), 'lodgable'] as const,
  lodgments: (tenant: string, status: CashLodgmentStatus) => [...cashKeys.all(tenant), 'lodgments', status] as const,
  lodgment: (tenant: string, id: number) => [...cashKeys.all(tenant), 'lodgment', id] as const,
};

/** Taking cash: opening a collection, recording receipts, closing it (the API checks `cash.collect`). */
export const CASH_COLLECT_ACCESS: PermissionAlias = 'CASH_COLLECT';
/** Lodging collected cash into the bank (`cash.lodge`). */
export const CASH_LODGE_ACCESS: PermissionAlias = 'CASH_LODGE';
/** Checking a lodgment against the bank statement, and voiding a receipt (`cash.verify`). */
export const CASH_VERIFY_ACCESS: PermissionAlias = 'CASH_VERIFY';
/** Seeing every officer's cash (`cash.view`). */
export const CASH_VIEW_ACCESS: PermissionAlias = 'CASH_VIEW';
/** Any cash permission opens the Cash screens; what each one shows depends on the others. */
export const CASH_ANY_ACCESS: PermissionAlias[] = ['CASH_COLLECT', 'CASH_LODGE', 'CASH_VERIFY', 'CASH_VIEW'];

export const CASH_PAGE_SIZE = 20;

/** Where the cash is: the caller's own position, and every officer's for those who can view all. */
export function useCashOverview() {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_ANY_ACCESS);
  return useQuery({ queryKey: cashKeys.overview(tenant), queryFn: () => cashApi.getOverview(), enabled, refetchInterval: 60_000 });
}

/** One status of the collections list, newest first, loaded a page at a time. */
export function useCashCollections(status: CashCollectionStatus) {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_ANY_ACCESS);
  return useInfiniteQuery({
    queryKey: cashKeys.collections(tenant, status),
    queryFn: ({ pageParam }) => cashApi.listCollections({ status, page: pageParam, limit: CASH_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useCashCollection(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_ANY_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: cashKeys.collection(tenant, id), queryFn: () => cashApi.getCollection(id), enabled });
}

/** What the chosen member could pay today. Fresh each time — balances change as receipts are recorded. */
export function useCashPayables(memberId: number | null) {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_COLLECT_ACCESS) && memberId !== null;
  return useQuery({ queryKey: cashKeys.payables(tenant, memberId ?? 0), queryFn: () => cashApi.getPayables(memberId as number), enabled, staleTime: 0 });
}

/** The officer's closed collections that still hold cash to lodge. */
export function useCashLodgable() {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_LODGE_ACCESS);
  return useQuery({ queryKey: cashKeys.lodgable(tenant), queryFn: () => cashApi.getLodgable(), enabled, staleTime: 0 });
}

/** One status of the lodgments list, newest first. */
export function useCashLodgments(status: CashLodgmentStatus) {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_ANY_ACCESS);
  return useInfiniteQuery({
    queryKey: cashKeys.lodgments(tenant, status),
    queryFn: ({ pageParam }) => cashApi.listLodgments({ status, page: pageParam, limit: CASH_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useCashLodgment(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(CASH_ANY_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: cashKeys.lodgment(tenant, id), queryFn: () => cashApi.getLodgment(id), enabled });
}

/** A signed link to the deposit slip, fetched when a lodgment opens (links last an hour; the cache a little less). */
export function useCashSlipLink(id: number, enabled: boolean) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: [...cashKeys.all(tenant), 'slip-link', id] as const,
    queryFn: () => cashApi.getSlipLink(id),
    enabled: enabled && Number.isFinite(id),
    staleTime: 50 * 60 * 1000,
    gcTime: 50 * 60 * 1000,
  });
}
