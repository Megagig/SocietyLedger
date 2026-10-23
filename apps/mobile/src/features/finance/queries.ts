import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { financeManageApi } from '@/api/endpoints/financeManage';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { PermissionAlias } from '@/lib/permissions';
import type { ChargeListParams, ReminderScope } from '@/types/api/financeManage';

export const financeKeys = {
  all: (tenant: string) => [tenant, 'finance'] as const,
  dashboard: (tenant: string) => [...financeKeys.all(tenant), 'dashboard'] as const,
  stats: (tenant: string) => [...financeKeys.all(tenant), 'stats'] as const,
  charges: (tenant: string, filters: ChargeListParams) => [...financeKeys.all(tenant), 'charges', filters] as const,
  charge: (tenant: string, id: number) => [...financeKeys.all(tenant), 'charge', id] as const,
  categories: (tenant: string) => [...financeKeys.all(tenant), 'categories'] as const,
};

/** Seeing the overview, the charges list and a charge (the API checks `ledger.view`). */
export const FINANCE_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
/** Creating charges, single or bulk (`ledger.create`). */
export const CHARGE_CREATE_ACCESS: PermissionAlias = 'TRANSACTION_CREATE';
/** Editing a charge, and void-and-replace (`ledger.edit`). */
export const CHARGE_EDIT_ACCESS: PermissionAlias = 'TRANSACTION_EDIT';
/** Deleting a charge (`ledger.reverse` — the administrator). */
export const CHARGE_DELETE_ACCESS: PermissionAlias = 'TRANSACTION_DELETE';
/** Recording a payment by hand (`payments.manual_create`). */
export const PAYMENT_RECORD_ACCESS: PermissionAlias = 'PAYMENT_CREATE';

export const CHARGES_PAGE_SIZE = 20;

export function useFinanceDashboard() {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS);
  return useQuery({ queryKey: financeKeys.dashboard(tenant), queryFn: () => financeManageApi.getDashboard(), enabled });
}

export function useChargeStats() {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS);
  return useQuery({ queryKey: financeKeys.stats(tenant), queryFn: () => financeManageApi.getStats(), enabled });
}

/** The charges list under the given filters, newest first, a page at a time. */
export function useCharges(filters: Omit<ChargeListParams, 'page' | 'limit'>) {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: financeKeys.charges(tenant, filters),
    queryFn: ({ pageParam }) => financeManageApi.listCharges({ ...filters, page: pageParam, limit: CHARGES_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useCharge(id: number) {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS) && Number.isFinite(id);
  return useQuery({ queryKey: financeKeys.charge(tenant, id), queryFn: () => financeManageApi.getCharge(id), enabled });
}

export function useFinanceCategories() {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS);
  return useQuery({ queryKey: financeKeys.categories(tenant), queryFn: () => financeManageApi.listCategories(), enabled, staleTime: 5 * 60 * 1000 });
}

/** The charges a member could still pay on (something owed, not voided) — what "Record a payment" offers after choosing a member. */
export function useMemberOpenCharges(memberId: number | null) {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS) && memberId !== null;
  return useQuery({
    queryKey: [...financeKeys.all(tenant), 'open-charges', memberId] as const,
    queryFn: () => financeManageApi.listCharges({ memberId: memberId as number, limit: 100 }),
    select: (data) => data.transactions.filter((c) => !c.isVoided && Number(c.balance) > 0),
    enabled,
    staleTime: 0,
  });
}

/** Members who still owe — only the overdue ones, or everyone with an unpaid charge. */
export function useReminderMembers(scope: ReminderScope) {
  const tenant = useTenantKey();
  const enabled = useCan(FINANCE_VIEW_ACCESS);
  return useQuery({
    queryKey: [...financeKeys.all(tenant), 'reminder-members', scope] as const,
    queryFn: () => financeManageApi.listReminderMembers(scope),
    enabled,
  });
}

/** Sending reminders (the API checks `ledger.edit`). */
export const REMINDERS_SEND_ACCESS: PermissionAlias = 'TRANSACTION_EDIT';
