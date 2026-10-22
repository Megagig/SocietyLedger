import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Bell, Check, CheckCheck, Settings, Trash2 } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';

import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { NotificationRow } from '@/components/ui/NotificationRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import {
  applyNotificationFilters,
  DEFAULT_FILTERS,
  hasActiveFilters,
  hasClientFilters,
  type NotificationFilters,
} from '@/features/notifications/filters';
import { NotificationFilterBar } from '@/features/notifications/NotificationFilterBar';
import {
  useDeleteNotifications,
  useMarkAllRead,
  useMarkManyRead,
  useMarkRead,
  useNotificationsInbox,
} from '@/features/notifications/queries';
import { pushTypeForKind, routePushNotification } from '@/lib/push';
import { useTenantStore } from '@/stores/tenant';
import type { NotificationDTO } from '@/types/api/notifications';

/** Below this many matches, keep pulling pages while client-side filters are active. */
const MIN_FILTERED_RESULTS = 10;

/** project-overview.md §6.6 N1 — Notifications inbox (web parity: filters, search, bulk actions, pagination). */
export default function NotificationsScreen() {
  const router = useRouter();
  const tenantId = useTenantStore((s) => s.current?.id);
  const deleteSheetRef = useRef<BottomSheetModal>(null);

  const [filters, setFilters] = useState<NotificationFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<number[]>([]);

  const query = useNotificationsInbox(filters.status === 'unread');
  const markRead = useMarkRead();
  const markManyRead = useMarkManyRead();
  const markAllRead = useMarkAllRead();
  const deleteMany = useDeleteNotifications();

  const loaded = useMemo(() => query.data?.pages.flatMap((p) => p.notifications) ?? [], [query.data]);
  const visible = useMemo(() => applyNotificationFilters(loaded, filters), [loaded, filters]);
  const unreadCount = query.data?.pages[0]?.unreadCount ?? 0;

  const selectionMode = selected.length > 0;
  const selectedUnread = useMemo(
    () => visible.filter((n) => selected.includes(n.id) && !n.isRead).map((n) => n.id),
    [visible, selected],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Client-side filters can leave a short list even though more pages exist — keep loading (bounded by totalPages).
  useEffect(() => {
    if (hasClientFilters(filters) && hasNextPage && !isFetchingNextPage && visible.length < MIN_FILTERED_RESULTS) {
      fetchNextPage();
    }
  }, [filters, hasNextPage, isFetchingNextPage, visible.length, fetchNextPage]);

  const clearSelection = useCallback(() => setSelected([]), []);

  const toggle = useCallback(
    (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );

  function handlePress(notif: NotificationDTO) {
    if (selectionMode) {
      toggle(notif.id);
      return;
    }
    if (!notif.isRead) markRead.mutate(notif.id);
    const type = notif.pushType ?? pushTypeForKind(notif.type);
    if (type) routePushNotification({ type, entityId: notif.entityId ?? undefined }, tenantId);
  }

  function confirmDelete() {
    deleteMany.mutate(selected, { onSuccess: clearSelection });
    deleteSheetRef.current?.dismiss();
  }

  const filtersActive = hasActiveFilters(filters);

  const headerActions = selectionMode ? (
    <View className="flex-row items-center">
      {selectedUnread.length > 0 && (
        <IconButton
          icon={Check}
          accessibilityLabel="Mark selected as read"
          onPress={() => markManyRead.mutate(selectedUnread, { onSuccess: clearSelection })}
        />
      )}
      <IconButton icon={Trash2} accessibilityLabel="Delete selected" onPress={() => deleteSheetRef.current?.present()} />
    </View>
  ) : (
    <View className="flex-row items-center">
      {unreadCount > 0 && (
        <IconButton icon={CheckCheck} accessibilityLabel="Mark all as read" onPress={() => markAllRead.mutate()} />
      )}
      <IconButton
        icon={Settings}
        accessibilityLabel="Notification preferences"
        onPress={() => router.push('/(app)/notifications/preferences' as never)}
      />
    </View>
  );

  const header = (
    <View className="gap-3 pb-1">
      {query.isSuccess ? (
        <Text variant="caption" tone="secondary" className="px-4">
          {selectionMode
            ? `${selected.length} selected`
            : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
        </Text>
      ) : null}
      {selectionMode ? (
        <Pressable
          onPress={() => setSelected(visible.map((n) => n.id))}
          accessibilityRole="button"
          className="px-4 py-1"
        >
          <Text variant="label" tone="default">
            {`Select all (${visible.length})`}
          </Text>
        </Pressable>
      ) : (
        <NotificationFilterBar filters={filters} onChange={setFilters} />
      )}
    </View>
  );

  let empty: React.ReactElement;
  if (query.isPending) {
    empty = (
      <View>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} className="flex-row gap-3 px-4 py-3">
            <Skeleton width={40} height={40} radius="lg" />
            <View className="flex-1 gap-1.5">
              <Skeleton width="75%" height={16} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="33%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (query.isError) {
    empty = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  } else if (hasNextPage && hasClientFilters(filters)) {
    empty = (
      <View className="items-center py-12">
        <Spinner />
      </View>
    );
  } else if (filtersActive) {
    empty = (
      <EmptyState
        icon={Bell}
        title="No matching notifications"
        description="Try adjusting your filters."
        actionLabel="Clear filters"
        onAction={() => setFilters(DEFAULT_FILTERS)}
      />
    );
  } else {
    empty = (
      <EmptyState
        icon={Bell}
        title="No notifications yet"
        description="You'll see payments, meetings, and other updates here."
      />
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title={selectionMode ? 'Select' : 'Notifications'}
        onBack={selectionMode ? clearSelection : () => router.back()}
        backLabel={selectionMode ? 'Cancel selection' : undefined}
        rightActions={headerActions}
      />

      <FlatList
        data={query.isSuccess ? visible : []}
        extraData={selected}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => (
          <NotificationRow
            title={item.title}
            message={item.message}
            createdAt={item.createdAt}
            isRead={item.isRead}
            type={item.type}
            selectionMode={selectionMode}
            selected={selected.includes(item.id)}
            onPress={() => handlePress(item)}
            onLongPress={() => toggle(item.id)}
          />
        )}
        ItemSeparatorComponent={() => (
          <View className="px-4">
            <Divider />
          </View>
        )}
        style={{ marginHorizontal: -16 }}
        ListFooterComponent={isFetchingNextPage ? <Spinner /> : undefined}
        refreshing={query.isRefetching && !isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <ConfirmSheet
        ref={deleteSheetRef}
        title={`Delete ${selected.length} notification${selected.length === 1 ? '' : 's'}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      />
    </Screen>
  );
}
