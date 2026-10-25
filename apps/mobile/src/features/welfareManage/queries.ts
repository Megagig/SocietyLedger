import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { welfareManageApi } from '@/api/endpoints/welfareManage';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { ContributionStatus, OfficerPayoutDTO, OfficerPayoutsDTO, PayoutStatus } from '@/types/api/welfareManage';

export const WELFARE_MODULE = 'welfare';

/** Every welfare officer query sits under one root so a decision refreshes the whole section. */
export const welfareAdminKeys = {
  all: (tenant: string) => [tenant, 'welfare', 'admin'] as const,
  dashboard: (tenant: string) => [...welfareAdminKeys.all(tenant), 'dashboard'] as const,
  funds: (tenant: string, filters: object) => [...welfareAdminKeys.all(tenant), 'funds', filters] as const,
  contributions: (tenant: string, filters: object) => [...welfareAdminKeys.all(tenant), 'contributions', filters] as const,
  payouts: (tenant: string, filters: object) => [...welfareAdminKeys.all(tenant), 'payouts', filters] as const,
};

/** Seeing the welfare section, and managing funds and recording contributions (`ledger.create`). */
export const WELFARE_MANAGE_ACCESS: PermissionAlias = 'WELFARE_MANAGE';
/** Confirming contributions (`payments.approve`). */
export const WELFARE_CONFIRM_ACCESS: PermissionAlias = 'WELFARE_CONTRIBUTION_CONFIRM';
/** Reviewing and disbursing payout requests (`payments.approve`). */
export const WELFARE_PAYOUT_ACCESS: PermissionAlias = 'WELFARE_PAYOUT_APPROVE';
/** Any officer welfare permission: what makes Welfare appear in Manage. */
export const WELFARE_ADMIN_ACCESS: PermissionAlias[] = ['WELFARE_MANAGE', 'WELFARE_CONTRIBUTION_CONFIRM', 'WELFARE_PAYOUT_APPROVE'];

const PAGE = 20;

function useAdminAccess() {
  return useModuleAccess(WELFARE_ADMIN_ACCESS, WELFARE_MODULE);
}

export function useWelfareDashboard() {
  const tenant = useTenantKey();
  const enabled = useAdminAccess();
  return useQuery({ queryKey: welfareAdminKeys.dashboard(tenant), queryFn: () => welfareManageApi.getDashboard(), enabled });
}

export function useAdminFunds(filters: { status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' } = {}) {
  const tenant = useTenantKey();
  const enabled = useAdminAccess();
  return useInfiniteQuery({
    queryKey: welfareAdminKeys.funds(tenant, filters),
    queryFn: ({ pageParam }) => welfareManageApi.listFunds({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** Active funds, for the pickers. */
export function useActiveFunds() {
  const tenant = useTenantKey();
  const enabled = useAdminAccess();
  return useQuery({
    queryKey: welfareAdminKeys.funds(tenant, { status: 'ACTIVE', all: true }),
    queryFn: () => welfareManageApi.listFunds({ status: 'ACTIVE', limit: 100 }),
    select: (data) => data.funds,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useAdminContributions(filters: { status?: ContributionStatus; fundId?: number }) {
  const tenant = useTenantKey();
  const enabled = useAdminAccess();
  return useInfiniteQuery({
    queryKey: welfareAdminKeys.contributions(tenant, filters),
    queryFn: ({ pageParam }) => welfareManageApi.listContributions({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/**
 * One payout request by id. There is no single-request call, so it is found in the lists already loaded (the queue the officer opened
 * it from, whatever its filter) or, failing that, the first page of all requests. It refreshes whenever those lists do.
 */
export function usePayoutById(id: number) {
  const tenant = useTenantKey();
  const queryClient = useQueryClient();
  const all = useAdminPayouts({});
  const fromAll = all.data?.pages.flatMap((p) => p.requests).find((r) => r.id === id);
  let request: OfficerPayoutDTO | undefined = fromAll;
  if (!request) {
    const cached = queryClient.getQueriesData<InfiniteData<OfficerPayoutsDTO>>({ queryKey: welfareAdminKeys.payouts(tenant, {}).slice(0, 4) });
    for (const [, data] of cached) {
      request = data?.pages.flatMap((p) => p.requests).find((r) => r.id === id);
      if (request) break;
    }
  }
  return { request, isPending: all.isPending && !request, isError: all.isError && !request, error: all.error, refetch: all.refetch, isRefetching: all.isRefetching };
}

export function useAdminPayouts(filters: { status?: PayoutStatus; fundId?: number }) {
  const tenant = useTenantKey();
  const enabled = useAdminAccess();
  return useInfiniteQuery({
    queryKey: welfareAdminKeys.payouts(tenant, filters),
    queryFn: ({ pageParam }) => welfareManageApi.listPayouts({ ...filters, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}
