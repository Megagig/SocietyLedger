import { useQuery } from '@tanstack/react-query';

import { associationsApi } from '@/api/endpoints/associations';

/** No tenant prefix (code-standards.md §6's usual rule) — this key factory exists to *find* the
 * tenant, so there's nothing to prefix with yet. */
export const tenantKeys = {
  checkSubdomain: (subdomain: string) => ['tenant', 'check-subdomain', subdomain] as const,
};

export function useCheckSubdomain(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: tenantKeys.checkSubdomain(subdomain),
    queryFn: () => associationsApi.checkSubdomain(subdomain),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
