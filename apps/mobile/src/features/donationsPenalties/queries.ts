import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { donationsPenaltiesApi } from '@/api/endpoints/donationsPenalties';
import { financeKeys } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';

export { FINANCE_VIEW_ACCESS } from '@/features/finance/queries';

/** Keys sit under the finance root, so a charge, payment or waiver that refreshes finance refreshes these too. */
export const donationKeys = {
  stats: (tenant: string) => [...financeKeys.all(tenant), 'donations', 'stats'] as const,
  list: (tenant: string) => [...financeKeys.all(tenant), 'donations', 'list'] as const,
  receipt: (tenant: string, id: number) => [...financeKeys.all(tenant), 'donations', 'receipt', id] as const,
  allocations: (tenant: string, filters: object) => [...financeKeys.all(tenant), 'donations', 'allocations', filters] as const,
};

export const penaltyKeys = {
  stats: (tenant: string) => [...financeKeys.all(tenant), 'penalties', 'stats'] as const,
  rules: (tenant: string) => [...financeKeys.all(tenant), 'penalties', 'rules'] as const,
  waivers: (tenant: string) => [...financeKeys.all(tenant), 'penalties', 'waivers'] as const,
  preview: (tenant: string) => [...financeKeys.all(tenant), 'penalties', 'late-fee-preview'] as const,
};

/** Recording a donation (`ledger.create` on transactions), creating a fund or a rule (`ledger.create`). */
export const DONATION_RECORD_ACCESS: PermissionAlias = 'TRANSACTION_CREATE';
export const FUND_CREATE_ACCESS: PermissionAlias = 'FINANCE_CREATE';
/** Editing a fund or a rule (`ledger.edit`). */
export const FUND_EDIT_ACCESS: PermissionAlias = 'FINANCE_EDIT';
/** Deleting a late-fee rule (`ledger.reverse`). */
export const RULE_DELETE_ACCESS: PermissionAlias = 'FINANCE_DELETE';
/** Applying late fees and waiving a penalty (`payments.approve`). */
export const PENALTY_APPROVE_ACCESS: PermissionAlias = 'FINANCE_APPROVE';

const PAGE = 20;

export function useDonationStats() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useQuery({ queryKey: donationKeys.stats(tenant), queryFn: () => donationsPenaltiesApi.getDonationStats(), enabled });
}

export function useDonations() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: donationKeys.list(tenant),
    queryFn: ({ pageParam }) => donationsPenaltiesApi.listDonations({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useDonationReceipt(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW') && Number.isFinite(id);
  return useQuery({ queryKey: donationKeys.receipt(tenant, id), queryFn: () => donationsPenaltiesApi.getReceipt(id), enabled });
}

export function useAllocations(filters: { isActive?: boolean } = {}) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: donationKeys.allocations(tenant, filters),
    queryFn: ({ pageParam }) => donationsPenaltiesApi.listAllocations({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** Funds that can still take a donation, for the record form's picker. */
export function useActiveAllocations() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useQuery({
    queryKey: donationKeys.allocations(tenant, { isActive: true, all: true }),
    queryFn: () => donationsPenaltiesApi.listAllocations({ isActive: true, limit: 100 }),
    select: (data) => data.allocations,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function usePenaltyStats() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useQuery({ queryKey: penaltyKeys.stats(tenant), queryFn: () => donationsPenaltiesApi.getPenaltyStats(), enabled });
}

export function usePenaltyRules() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: penaltyKeys.rules(tenant),
    queryFn: ({ pageParam }) => donationsPenaltiesApi.listRules({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useWaivers() {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: penaltyKeys.waivers(tenant),
    queryFn: ({ pageParam }) => donationsPenaltiesApi.listWaivers({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** What applying late fees now would do. Always fresh: it is read on the preview screen, never cached for later. */
export function useLateFeePreview() {
  const tenant = useTenantKey();
  const enabled = useCan(PENALTY_APPROVE_ACCESS);
  return useQuery({ queryKey: penaltyKeys.preview(tenant), queryFn: () => donationsPenaltiesApi.previewLateFees(), enabled, staleTime: 0, gcTime: 0 });
}
