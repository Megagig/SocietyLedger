import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { reportsApi } from '@/api/endpoints/reports';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { useTenantKey } from '@/hooks/useTenantKey';
import type {
  ChargeCategoryType,
  ChargeListParams,
  GroupBy,
  MemberBalancesParams,
  PaymentListParams,
  RangeParams,
} from '@/types/api/reports';
import { EXPORT_ANY_ACCESS, REPORTS_MODULE, REPORTS_VIEW_ACCESS } from './labels';

export const reportKeys = {
  all: (tenant: string) => [tenant, 'reports'] as const,
  summary: (tenant: string, range: object) => [...reportKeys.all(tenant), 'summary', range] as const,
  balances: (tenant: string, params: object) => [...reportKeys.all(tenant), 'balances', params] as const,
  aging: (tenant: string) => [...reportKeys.all(tenant), 'aging'] as const,
  collection: (tenant: string, range: object, groupBy: string) => [...reportKeys.all(tenant), 'collection', range, groupBy] as const,
  category: (tenant: string, range: object, type: string) => [...reportKeys.all(tenant), 'category', range, type] as const,
  charges: (tenant: string, params: object) => [...reportKeys.all(tenant), 'charges', params] as const,
  payments: (tenant: string, params: object) => [...reportKeys.all(tenant), 'payments', params] as const,
  exports: (tenant: string) => [...reportKeys.all(tenant), 'exports'] as const,
};

const PAGE = 25;

/** Reading a report: the officer permission, and the reports module on the plan. */
export function useReportsAccess(): boolean {
  return useModuleAccess(REPORTS_VIEW_ACCESS, REPORTS_MODULE);
}

export function useFinancialSummary(range: RangeParams | null) {
  const tenant = useTenantKey();
  const enabled = useReportsAccess() && range !== null;
  return useQuery({ queryKey: reportKeys.summary(tenant, range ?? {}), queryFn: () => reportsApi.getFinancialSummary(range as RangeParams), enabled, placeholderData: keepPreviousData });
}

export function useMemberBalances(params: Omit<MemberBalancesParams, 'page' | 'limit'>) {
  const tenant = useTenantKey();
  const enabled = useReportsAccess();
  return useInfiniteQuery({
    queryKey: reportKeys.balances(tenant, params),
    queryFn: ({ pageParam }) => reportsApi.getMemberBalances({ ...params, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useAging() {
  const tenant = useTenantKey();
  const enabled = useReportsAccess();
  return useQuery({ queryKey: reportKeys.aging(tenant), queryFn: () => reportsApi.getAging(), enabled });
}

export function useCollectionRate(range: RangeParams | null, groupBy: GroupBy) {
  const tenant = useTenantKey();
  const enabled = useReportsAccess() && range !== null;
  return useQuery({ queryKey: reportKeys.collection(tenant, range ?? {}, groupBy), queryFn: () => reportsApi.getCollectionRate(range as RangeParams, groupBy), enabled, placeholderData: keepPreviousData });
}

export function useCategoryReport(range: RangeParams | null, type: ChargeCategoryType | '') {
  const tenant = useTenantKey();
  const enabled = useReportsAccess() && range !== null;
  // The by-category report takes dates only, so a named period is turned into dates by the server's financial summary range
  return useQuery({
    queryKey: reportKeys.category(tenant, range ?? {}, type),
    queryFn: async () => {
      const summary = await reportsApi.getFinancialSummary(range as RangeParams, false);
      return {
        period: summary.period,
        categories: await reportsApi.getByCategory({ startDate: summary.period.startDate, endDate: summary.period.endDate }, type || undefined),
      };
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** The charges behind a figure, a page at a time. Totals come with every page and cover the whole list. */
export function useChargeList(params: ChargeListParams) {
  const tenant = useTenantKey();
  const enabled = useReportsAccess();
  return useInfiniteQuery({
    queryKey: reportKeys.charges(tenant, params),
    queryFn: ({ pageParam }) => reportsApi.listCharges(params, pageParam, PAGE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** The payments behind "money received", a page at a time. */
export function usePaymentList(params: PaymentListParams) {
  const tenant = useTenantKey();
  const enabled = useReportsAccess();
  return useInfiniteQuery({
    queryKey: reportKeys.payments(tenant, params),
    queryFn: ({ pageParam }) => reportsApi.listPayments(params, pageParam, PAGE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useExportHistory() {
  const tenant = useTenantKey();
  const enabled = useCan(EXPORT_ANY_ACCESS);
  return useInfiniteQuery({
    queryKey: reportKeys.exports(tenant),
    queryFn: ({ pageParam }) => reportsApi.listExports({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}
