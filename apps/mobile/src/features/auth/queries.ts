import { useQuery } from '@tanstack/react-query';

import { memberInvitesApi } from '@/api/endpoints/memberInvites';

/** No tenant prefix (same exception as `features/tenant/queries.ts`'s `tenantKeys`) — this finds
 * the tenant (via the invite), so there's nothing to prefix with yet. */
export const authKeys = {
  verifyInvite: (token: string) => ['auth', 'verify-invite', token] as const,
};

export function useVerifyInvite(token: string) {
  return useQuery({
    queryKey: authKeys.verifyInvite(token),
    queryFn: () => memberInvitesApi.verifyInvite(token),
    enabled: token.length > 0,
    retry: false,
  });
}
