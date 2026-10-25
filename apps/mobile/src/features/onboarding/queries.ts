import { useQuery } from '@tanstack/react-query';

import { onboardingApi } from '@/api/endpoints/onboarding';
import { useTenantKey } from '@/hooks/useTenantKey';

export const onboardingKeys = {
  all: (tenant: string) => [tenant, 'onboarding'] as const,
  status: (tenant: string) => [...onboardingKeys.all(tenant), 'status'] as const,
};

export function useOnboardingStatus() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: onboardingKeys.status(tenant), queryFn: () => onboardingApi.getStatus() });
}
