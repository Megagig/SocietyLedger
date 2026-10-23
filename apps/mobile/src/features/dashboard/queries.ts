import { useQuery } from '@tanstack/react-query';

import { attentionApi, dashboardApi, type AttentionItemDTO, type AttentionKey } from '@/api/endpoints/dashboard';
import { useTenantKey } from '@/hooks/useTenantKey';

export const dashboardKeys = {
  all: (tenant: string) => [tenant, 'dashboard'] as const,
  overview: (tenant: string) => [...dashboardKeys.all(tenant), 'overview'] as const,
  attention: (tenant: string) => [...dashboardKeys.all(tenant), 'attention'] as const,
};

/** Officer-only. Call only when `useCan('FINANCE_VIEW')` is true. */
export function useAssociationDashboard(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: dashboardKeys.overview(tenant),
    queryFn: dashboardApi.getOverview,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** What is waiting on this officer. Kept fresh: the counts drive badges that should drop once the work is done. */
export function useAttention(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: dashboardKeys.attention(tenant),
    queryFn: attentionApi.getAttention,
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** The waiting count for one kind of queue (0 when it is absent from the list). */
export function attentionCount(items: AttentionItemDTO[] | undefined, key: AttentionKey): number {
  return items?.find((item) => item.key === key)?.count ?? 0;
}
