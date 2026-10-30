import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { ajoReportsApi } from '@/api/endpoints/ajoReports';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { ReportFilters, ReportName } from '@/types/api/ajoReports';
import { ajoKeys } from './queries';

export const REPORT_PAGE_SIZE = 25;

const reportKey = (tenant: string, ...rest: (string | number | ReportFilters)[]) => [...ajoKeys.all(tenant), 'reports', ...rest] as const;

/** The eight reports, with what is locked and why. */
export function useReportList() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: reportKey(tenant, 'list'), queryFn: () => ajoReportsApi.list(), staleTime: 60_000 });
}

/**
 * One report a page of rows at a time. The figures come with every page and are the same on each; `first` is the first page's result,
 * `rows` is everything loaded so far, `total` is how many rows there are, and `hasMore` says whether to offer "Show more".
 */
export function useReportPages(name: ReportName, filters: ReportFilters, enabled = true) {
  const tenant = useTenantKey();
  const query = useInfiniteQuery({
    queryKey: reportKey(tenant, name, filters),
    queryFn: ({ pageParam }) => ajoReportsApi.page(name, filters, pageParam, REPORT_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.rows.length, 0) < last.page.total ? all.length + 1 : undefined),
    enabled,
    staleTime: 30_000,
  });
  const first = query.data?.pages[0];
  return { ...query, first, rows: query.data?.pages.flatMap((p) => p.rows) ?? [], total: first?.page.total ?? 0, hasMore: !!query.hasNextPage };
}
