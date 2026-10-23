import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { financeSetupApi } from '@/api/endpoints/financeSetup';
import { financeKeys } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { CampaignStatus, CategoryListParams } from '@/types/api/financeSetup';

export { FINANCE_VIEW_ACCESS } from '@/features/finance/queries';

/** Query keys sit under the finance root, so any charge or payment change that refreshes finance refreshes these too. */
export const financeSetupKeys = {
  categories: (tenant: string, filters: object) => [...financeKeys.all(tenant), 'setup', 'categories', filters] as const,
  category: (tenant: string, id: number) => [...financeKeys.all(tenant), 'setup', 'category', id] as const,
  campaigns: (tenant: string, filters: object) => [...financeKeys.all(tenant), 'setup', 'campaigns', filters] as const,
  campaign: (tenant: string, id: number) => [...financeKeys.all(tenant), 'setup', 'campaign', id] as const,
};

/** Creating a category or a campaign (`ledger.create`). */
export const SETUP_CREATE_ACCESS: PermissionAlias = 'FINANCE_CREATE';
/** Editing a category, editing or closing a campaign (`ledger.edit`). */
export const SETUP_EDIT_ACCESS: PermissionAlias = 'FINANCE_EDIT';
/** Putting members on a levy creates their charges (`ledger.create` on transactions). */
export const ASSIGN_ACCESS: PermissionAlias = 'TRANSACTION_CREATE';
/** Removing a wrong assignment voids the charge (`ledger.reverse`). */
export const ASSIGN_REMOVE_ACCESS: PermissionAlias = 'TRANSACTION_DELETE';

export const SETUP_PAGE_SIZE = 20;

export function useCategories(filters: Omit<CategoryListParams, 'page' | 'limit'>) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: financeSetupKeys.categories(tenant, filters),
    queryFn: ({ pageParam }) => financeSetupApi.listCategories({ ...filters, page: pageParam, limit: SETUP_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useCategory(id: number | null) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW') && id !== null && Number.isFinite(id);
  return useQuery({ queryKey: financeSetupKeys.category(tenant, id ?? 0), queryFn: () => financeSetupApi.getCategory(id as number), enabled });
}

/** Active categories of one kind, for pickers (a campaign's levy category, the dues generator's due category). */
export function useActiveCategoriesOfKind(type: CategoryListParams['type']) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useQuery({
    queryKey: financeSetupKeys.categories(tenant, { type, isActive: true, all: true }),
    queryFn: () => financeSetupApi.listCategories({ type, isActive: true, limit: 100 }),
    select: (data) => data.categories,
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useCampaigns(filters: { status?: CampaignStatus }) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW');
  return useInfiniteQuery({
    queryKey: financeSetupKeys.campaigns(tenant, filters),
    queryFn: ({ pageParam }) => financeSetupApi.listCampaigns({ ...filters, page: pageParam, limit: SETUP_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useCampaign(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan('FINANCE_VIEW') && Number.isFinite(id);
  return useQuery({ queryKey: financeSetupKeys.campaign(tenant, id), queryFn: () => financeSetupApi.getCampaign(id), enabled });
}
