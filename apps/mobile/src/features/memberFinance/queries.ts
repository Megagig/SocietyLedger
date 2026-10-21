import { useQuery } from '@tanstack/react-query';

import { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { useTenantKey } from '@/hooks/useTenantKey';

export const memberFinanceKeys = {
  all: (tenant: string) => [tenant, 'memberFinance'] as const,
  summary: (tenant: string) => [...memberFinanceKeys.all(tenant), 'summary'] as const,
  payments: (tenant: string) => [...memberFinanceKeys.all(tenant), 'payments'] as const,
};

export function useMemberFinanceSummary() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.summary(tenant),
    queryFn: memberFinanceApi.getFinanceSummary,
  });
}

/** Returns the full newest-first history (the API has no server-side limit); callers slice
 * to whatever preview size they need (H1 shows 3). */
export function useMemberPayments() {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: memberFinanceKeys.payments(tenant),
    queryFn: memberFinanceApi.getPayments,
  });
}
