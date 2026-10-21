import { useQuery } from '@tanstack/react-query';

import { votingApi } from '@/api/endpoints/voting';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';

export const votingKeys = {
  all: (tenant: string) => [tenant, 'voting'] as const,
  active: (tenant: string) => [...votingKeys.all(tenant), 'active'] as const,
};

/** `/voting/active` is gated server-side on `ELECTION_VIEW` — checked client-side first, same
 * reasoning as `features/meetings/queries.ts`'s `useUpcomingMeetings`. */
export function useActiveVoting() {
  const tenant = useTenantKey();
  const canView = useCan('ELECTION_VIEW');

  return useQuery({
    queryKey: votingKeys.active(tenant),
    queryFn: votingApi.getActive,
    enabled: canView,
  });
}
