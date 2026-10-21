import { useQuery } from '@tanstack/react-query';

import { meetingsApi } from '@/api/endpoints/meetings';
import { useCan } from '@/hooks/useCan';
import { useTenantKey } from '@/hooks/useTenantKey';

export const meetingsKeys = {
  all: (tenant: string) => [tenant, 'meetings'] as const,
  upcoming: (tenant: string, limit: number) => [...meetingsKeys.all(tenant), 'upcoming', limit] as const,
};

/** `/meetings/upcoming` is gated server-side on `MEETING_VIEW` — this hook checks the same
 * permission client-side (architecture.md §7.4's rule: permission-gated controls hidden for
 * users without it) rather than firing a request bound to 403. */
export function useUpcomingMeetings(limit = 3) {
  const tenant = useTenantKey();
  const canView = useCan('MEETING_VIEW');

  return useQuery({
    queryKey: meetingsKeys.upcoming(tenant, limit),
    queryFn: () => meetingsApi.getUpcoming(limit),
    enabled: canView,
  });
}
