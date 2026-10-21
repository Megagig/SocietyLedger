import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { notificationsApi, type ListNotificationsParams } from '@/api/endpoints/notifications';
import { useTenantKey } from '@/hooks/useTenantKey';
import { setBadgeCount } from '@/lib/push';

const INBOX_PAGE_SIZE = 20;

/** Refreshes every notifications query and re-syncs the OS badge to the server's real unread count. */
function refreshAfterChange(queryClient: QueryClient, tenant: string) {
  queryClient.invalidateQueries({ queryKey: notificationsKeys.all(tenant) });
  notificationsApi
    .getUnreadCount()
    .then((res) => setBadgeCount(res.unreadCount))
    .catch(() => {});
}

export const notificationsKeys = {
  all: (tenant: string) => [tenant, 'notifications'] as const,
  list: (tenant: string, params: ListNotificationsParams) => [...notificationsKeys.all(tenant), 'list', params] as const,
  unreadCount: (tenant: string) => [...notificationsKeys.all(tenant), 'unreadCount'] as const,
  preferences: (tenant: string) => [...notificationsKeys.all(tenant), 'preferences'] as const,
  announcements: (tenant: string) => [...notificationsKeys.all(tenant), 'announcements'] as const,
};

/** Home screen announcements (fetches page of 20, filters client-side — no server type filter). */
export function useAnnouncements(limit = 3) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: notificationsKeys.announcements(tenant),
    queryFn: () => notificationsApi.list({ limit: 20 }),
    select: (data) => data.notifications.filter((n) => n.type === 'announcement').slice(0, limit),
  });
}

/** Full paginated notifications list for the inbox (N1). */
export function useNotificationsList(params: ListNotificationsParams = {}) {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: notificationsKeys.list(tenant, params),
    queryFn: () => notificationsApi.list(params),
  });
}

/** Paginated inbox (N1): `unread` is server-side, everything else is filtered client-side (the API only reads page/limit/unread). */
export function useNotificationsInbox(unreadOnly: boolean) {
  const tenant = useTenantKey();

  return useInfiniteQuery({
    queryKey: [...notificationsKeys.all(tenant), 'inbox', { unreadOnly }] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      notificationsApi.list({ page: pageParam, limit: INBOX_PAGE_SIZE, unread: unreadOnly ? true : undefined }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

/** Unread count — drives the bell badge. Refetches on app foreground via `useAppState`. */
export function useUnreadCount() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: notificationsKeys.unreadCount(tenant),
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
  });
}

/** Notification preferences (N2). */
export function useNotificationPreferences() {
  const tenant = useTenantKey();

  return useQuery({
    queryKey: notificationsKeys.preferences(tenant),
    queryFn: notificationsApi.getPreferences,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => refreshAfterChange(queryClient, tenant),
    onError: () => toast.error("Couldn't mark the notification as read. Try again."),
  });
}

/** Bulk mark-read for the inbox selection bar (no batch endpoint — one PUT per id). */
export function useMarkManyRead() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => notificationsApi.markRead(id))),
    onSuccess: () => refreshAfterChange(queryClient, tenant),
    onError: () => {
      refreshAfterChange(queryClient, tenant);
      toast.error("Some notifications couldn't be marked as read. Try again.");
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => refreshAfterChange(queryClient, tenant),
    onError: () => toast.error("Couldn't mark all as read. Try again."),
  });
}

/** Bulk delete for the inbox selection bar (no batch endpoint — one DELETE per id). */
export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => notificationsApi.deleteOne(id))),
    onSuccess: () => refreshAfterChange(queryClient, tenant),
    onError: () => {
      refreshAfterChange(queryClient, tenant);
      toast.error("Some notifications couldn't be deleted. Try again.");
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();

  return useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.preferences(tenant) });
    },
  });
}
