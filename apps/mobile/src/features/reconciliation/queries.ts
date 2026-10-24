import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { reconciliationApi } from '@/api/endpoints/reconciliation';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { ReconciliationStatus } from '@/types/api/reconciliation';
import { RECON_DECIDE_ACCESS, RECON_VIEW_ACCESS } from './labels';

export const reconKeys = {
  all: (tenant: string) => [tenant, 'reconciliation'] as const,
  suggestions: (tenant: string) => [...reconKeys.all(tenant), 'suggestions'] as const,
  imports: (tenant: string) => [...reconKeys.all(tenant), 'imports'] as const,
  lines: (tenant: string) => [...reconKeys.all(tenant), 'lines'] as const,
  matches: (tenant: string, status: string) => [...reconKeys.all(tenant), 'matches', status] as const,
  waiting: (tenant: string) => [...reconKeys.all(tenant), 'waiting'] as const,
};

const PAGE = 20;

/** Each unmatched bank line with the charge it most likely paid. */
export function useSuggestions() {
  const tenant = useTenantKey();
  const enabled = useCan(RECON_DECIDE_ACCESS);
  return useQuery({ queryKey: reconKeys.suggestions(tenant), queryFn: () => reconciliationApi.getSuggestions(), enabled });
}

export function useImports() {
  const tenant = useTenantKey();
  const enabled = useCan(RECON_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: reconKeys.imports(tenant),
    queryFn: ({ pageParam }) => reconciliationApi.listImports({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useUnmatchedLines() {
  const tenant = useTenantKey();
  const enabled = useCan(RECON_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: reconKeys.lines(tenant),
    queryFn: ({ pageParam }) => reconciliationApi.listUnmatchedLines({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

export function useMatches(status: ReconciliationStatus) {
  const tenant = useTenantKey();
  const enabled = useCan(RECON_VIEW_ACCESS);
  return useInfiniteQuery({
    queryKey: reconKeys.matches(tenant, status),
    queryFn: ({ pageParam }) => reconciliationApi.listMatches({ status, page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled,
  });
}

/** How many matches are waiting for someone to confirm: the badge on the Payments hub. */
export function useWaitingMatchCount() {
  const tenant = useTenantKey();
  const enabled = useCan(RECON_VIEW_ACCESS);
  return useQuery({
    queryKey: reconKeys.waiting(tenant),
    queryFn: async () => (await reconciliationApi.listMatches({ status: 'PENDING', page: 1, limit: 1 })).pagination.totalCount,
    enabled,
  });
}
