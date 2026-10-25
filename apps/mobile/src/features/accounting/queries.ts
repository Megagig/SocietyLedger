import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { accountingApi } from '@/api/endpoints/accounting';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { BudgetStatus, JournalStatus, LedgerParams, StatementParams } from '@/types/api/accounting';
import { ACCOUNTING_MODULE, ACCOUNTING_VIEW_ACCESS } from './labels';

export const accountingKeys = {
  all: (tenant: string) => [tenant, 'accounting'] as const,
  dashboard: (tenant: string) => [...accountingKeys.all(tenant), 'dashboard'] as const,
  sync: (tenant: string) => [...accountingKeys.all(tenant), 'sync'] as const,
  syncErrors: (tenant: string) => [...accountingKeys.all(tenant), 'sync-errors'] as const,
  accounts: (tenant: string, balances: boolean) => [...accountingKeys.all(tenant), 'accounts', balances] as const,
  entries: (tenant: string, status: string, search: string) => [...accountingKeys.all(tenant), 'entries', status, search] as const,
  entry: (tenant: string, id: number) => [...accountingKeys.all(tenant), 'entry', id] as const,
  income: (tenant: string, params: StatementParams) => [...accountingKeys.all(tenant), 'income', params] as const,
  balance: (tenant: string, asOf: string) => [...accountingKeys.all(tenant), 'balance', asOf] as const,
  cashFlow: (tenant: string, params: StatementParams) => [...accountingKeys.all(tenant), 'cash-flow', params] as const,
  budgets: (tenant: string, status: string, year: number | undefined) => [...accountingKeys.all(tenant), 'budgets', status, year ?? 0] as const,
  budget: (tenant: string, id: number) => [...accountingKeys.all(tenant), 'budget', id] as const,
  variance: (tenant: string, id: number) => [...accountingKeys.all(tenant), 'variance', id] as const,
  periods: (tenant: string) => [...accountingKeys.all(tenant), 'periods'] as const,
  ledger: (tenant: string, filters: object) => [...accountingKeys.all(tenant), 'ledger', filters] as const,
};

const PAGE = 20;

/** Reading the books: the permission, and the accounting module on the plan. */
export function useAccountingAccess(): boolean {
  return useModuleAccess(ACCOUNTING_VIEW_ACCESS, ACCOUNTING_MODULE);
}

export function useAccountingDashboard() {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.dashboard(tenant), queryFn: () => accountingApi.getDashboard(), enabled });
}

export function useSyncStatus() {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.sync(tenant), queryFn: () => accountingApi.getSyncStatus(), enabled });
}

export function useSyncErrors() {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.syncErrors(tenant), queryFn: () => accountingApi.getSyncErrors(), enabled });
}

export function useAccounts(withBalances = false) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.accounts(tenant, withBalances), queryFn: () => accountingApi.listAccounts({ includeBalances: withBalances }), enabled });
}

export function useEntriesInfinite(status: JournalStatus | 'ALL', search: string) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useInfiniteQuery({
    queryKey: accountingKeys.entries(tenant, status, search),
    queryFn: ({ pageParam }) => accountingApi.listEntries({ page: pageParam, limit: PAGE, status: status === 'ALL' ? undefined : status, search: search || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEntry(id: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.entry(tenant, id ?? 0), queryFn: () => accountingApi.getEntry(id as number), enabled: enabled && id !== undefined });
}

export function useIncomeStatement(params: StatementParams | null, compare = false) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.income(tenant, { ...(params ?? { period: '' }), ...(compare ? { includeComparison: 'true' as const } : {}) }), queryFn: () => accountingApi.getIncomeStatement({ ...(params as StatementParams), ...(compare ? { includeComparison: 'true' as const } : {}) }), enabled: enabled && params !== null });
}

export function useBalanceSheet(asOf: string | null) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.balance(tenant, asOf ?? ''), queryFn: () => accountingApi.getBalanceSheet(asOf as string), enabled: enabled && asOf !== null });
}

export function useCashFlow(params: StatementParams | null) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.cashFlow(tenant, params ?? { period: '' }), queryFn: () => accountingApi.getCashFlow(params as StatementParams), enabled: enabled && params !== null });
}

export function useBudgetsInfinite(status: BudgetStatus | 'ALL', fiscalYear?: number) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useInfiniteQuery({
    queryKey: accountingKeys.budgets(tenant, status, fiscalYear),
    queryFn: ({ pageParam }) => accountingApi.listBudgets({ page: pageParam, limit: PAGE, status: status === 'ALL' ? undefined : status, fiscalYear }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useBudget(id: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.budget(tenant, id ?? 0), queryFn: () => accountingApi.getBudget(id as number), enabled: enabled && id !== undefined });
}

export function useBudgetVariance(id: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.variance(tenant, id ?? 0), queryFn: () => accountingApi.getVariance(id as number), enabled: enabled && id !== undefined });
}

export function usePeriods() {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: accountingKeys.periods(tenant), queryFn: () => accountingApi.listPeriods(), enabled });
}

/** The lines of an account's ledger, a page at a time. The totals come with every page and are the same on each. */
export function useLedgerInfinite(filters: Omit<LedgerParams, 'page' | 'limit'>, enabled = true) {
  const tenant = useTenantKey();
  const allowed = useAccountingAccess();
  return useInfiniteQuery({
    queryKey: accountingKeys.ledger(tenant, filters),
    queryFn: ({ pageParam }) => accountingApi.getLedger({ ...filters, page: pageParam, limit: 30 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: allowed && enabled,
  });
}
