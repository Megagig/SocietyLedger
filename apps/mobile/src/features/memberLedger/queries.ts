import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { memberLedgerApi, type LedgerEntriesParams } from '@/api/endpoints/memberLedger';
import { useTenantKey } from '@/hooks/useTenantKey';

export const memberLedgerKeys = {
  all: (tenant: string) => [tenant, 'memberLedger'] as const,
  summary: (tenant: string) => [...memberLedgerKeys.all(tenant), 'summary'] as const,
  entries: (tenant: string, filters: LedgerEntriesParams) =>
    [...memberLedgerKeys.all(tenant), 'entries', filters] as const,
  statement: (tenant: string, startDate: string, endDate: string) =>
    [...memberLedgerKeys.all(tenant), 'statement', startDate, endDate] as const,
};

export function useMyLedgerSummary() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberLedgerKeys.summary(tenant),
    queryFn: memberLedgerApi.getLedgerSummary,
  });
}

export function useMyLedgerEntries(filters: Omit<LedgerEntriesParams, 'page'> = {}) {
  const tenant = useTenantKey();
  const LIMIT = 50;

  return useInfiniteQuery({
    queryKey: memberLedgerKeys.entries(tenant, filters),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      memberLedgerApi.getLedgerEntries({ ...filters, page: pageParam as number, limit: LIMIT }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });
}

export function useMyStatement(startDate: string, endDate: string) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberLedgerKeys.statement(tenant, startDate, endDate),
    queryFn: () => memberLedgerApi.getStatement(startDate, endDate),
    enabled: Boolean(startDate && endDate),
  });
}
