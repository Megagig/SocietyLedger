import { useQuery } from '@tanstack/react-query';

import { notificationsApi } from '@/api/endpoints/notifications';
import { useTenantKey } from '@/hooks/useTenantKey';

export const notificationsKeys = {
  all: (tenant: string) => [tenant, 'notifications'] as const,
  announcements: (tenant: string) => [...notificationsKeys.all(tenant), 'announcements'] as const,
};

/** `api/endpoints/notifications.ts`'s own finding: `GET /notifications` has no `type` filter at
 * all. Fetches a page (20 — large enough that 3 real announcements are almost always in it) and
 * filters to `type === 'announcement'` client-side, capped to `limit`. */
export function useAnnouncements(limit = 3) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: notificationsKeys.announcements(tenant),
    queryFn: () => notificationsApi.list({ limit: 20 }),
    select: (data) => data.notifications.filter((notification) => notification.type === 'announcement').slice(0, limit),
  });
}
