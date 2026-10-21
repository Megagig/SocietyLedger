import { useQuery } from '@tanstack/react-query';

import { dashboardApi } from '@/api/endpoints/dashboard';
import { useTenantKey } from '@/hooks/useTenantKey';

export const dashboardKeys = {
  all: (tenant: string) => [tenant, 'dashboard'] as const,
  overview: (tenant: string) => [...dashboardKeys.all(tenant), 'overview'] as const,
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
