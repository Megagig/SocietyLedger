import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { expensesApi } from '@/api/endpoints/expenses';
import { accountingKeys, useAccountingAccess } from '@/features/accounting/queries';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { ExpenseStatus } from '@/types/api/expenses';

// Everything lives under the accounting group, so anything that moves the books also refreshes the expenses.
export const expenseKeys = {
  all: (tenant: string) => [...accountingKeys.all(tenant), 'expenses'] as const,
  list: (tenant: string, status: string, search: string, mine: boolean) => [...expenseKeys.all(tenant), 'list', status, search, mine] as const,
  one: (tenant: string, id: number) => [...expenseKeys.all(tenant), 'one', id] as const,
  options: (tenant: string) => [...expenseKeys.all(tenant), 'options'] as const,
  budget: (tenant: string, category: number, amount: number, date: string) => [...expenseKeys.all(tenant), 'budget', category, amount, date] as const,
  receipt: (tenant: string, id: number) => [...expenseKeys.all(tenant), 'receipt', id] as const,
};

const PAGE = 20;

export function useExpensesInfinite(status: ExpenseStatus | 'ALL', search: string, mine = false) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useInfiniteQuery({
    queryKey: expenseKeys.list(tenant, status, search, mine),
    queryFn: ({ pageParam }) => expensesApi.list({ page: pageParam, limit: PAGE, status: status === 'ALL' ? undefined : status, search: search || undefined, mine: mine ? 'true' : undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useExpense(id: number | undefined) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: expenseKeys.one(tenant, id ?? 0), queryFn: () => expensesApi.get(id as number), enabled: enabled && id !== undefined });
}

export function useExpenseOptions() {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: expenseKeys.options(tenant), queryFn: () => expensesApi.getOptions(), enabled, staleTime: 60 * 1000 });
}

/** Where the chosen category stands against its budget for this amount and day; asked only once all three are known. */
export function useBudgetCheck(categoryAccountId: number | undefined, amount: number | undefined, date: string | undefined) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  const ready = !!categoryAccountId && !!amount && amount > 0 && !!date;
  return useQuery({
    queryKey: expenseKeys.budget(tenant, categoryAccountId ?? 0, amount ?? 0, date ?? ''),
    queryFn: () => expensesApi.checkBudget({ categoryAccountId: categoryAccountId as number, amount: amount as number, date: date as string }),
    enabled: enabled && ready,
  });
}

/** A signed link to the receipt, fetched only when the voucher has one. */
export function useReceiptLink(id: number, hasReceipt: boolean) {
  const tenant = useTenantKey();
  const enabled = useAccountingAccess();
  return useQuery({ queryKey: expenseKeys.receipt(tenant, id), queryFn: () => expensesApi.receiptLink(id), enabled: enabled && hasReceipt, staleTime: 30 * 60 * 1000 });
}
