import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Megaphone } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useMarkRead, useNotificationsInbox } from '@/features/notifications/queries';
import type { NotificationDTO } from '@/types/api/notifications';

/** Below this many announcements, keep pulling pages (the API can't filter by type, so announcements are sparse among all notifications). */
const MIN_RESULTS = 10;

function AnnouncementCard({ item, onOpen }: { item: NotificationDTO; onOpen: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => {
        setExpanded((v) => !v);
        if (!item.isRead) onOpen();
      }}
    >
      <Card className={item.isRead ? 'gap-2' : 'gap-2 border-primary'}>
        <View className="flex-row items-start gap-3">
          <IconCircle icon={Megaphone} tone="accent" />
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Text variant={item.isRead ? 'body' : 'body-strong'} className="flex-1" numberOfLines={expanded ? undefined : 2}>
                {item.title}
              </Text>
              {!item.isRead && <View className="size-2 rounded-full bg-primary" />}
            </View>
            <Text variant="caption" tone="tertiary">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Text>
          </View>
        </View>
        <Text variant="body" tone="secondary" numberOfLines={expanded ? undefined : 3}>
          {item.message}
        </Text>
      </Card>
    </Pressable>
  );
}

/** project-overview.md §6.5 C13 — Announcements feed: paginated, expandable, marks read on open. */
export default function AnnouncementsScreen() {
  const router = useRouter();
  const query = useNotificationsInbox(false);
  const markRead = useMarkRead();

  const announcements = useMemo(
    () => (query.data?.pages.flatMap((p) => p.notifications) ?? []).filter((n) => n.type === 'announcement'),
    [query.data],
  );
  const unread = announcements.filter((n) => !n.isRead).length;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && announcements.length < MIN_RESULTS) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, announcements.length, fetchNextPage]);

  const header = query.isSuccess ? (
    <Text variant="caption" tone="secondary" className="pb-3">
      {`${unread} unread announcement${unread === 1 ? '' : 's'}`}
    </Text>
  ) : undefined;

  let empty: React.ReactElement;
  if (query.isPending) {
    empty = (
      <View className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={112} radius="lg" />
        ))}
      </View>
    );
  } else if (query.isError) {
    empty = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  } else if (hasNextPage) {
    empty = (
      <View className="items-center py-12">
        <Spinner />
      </View>
    );
  } else {
    empty = (
      <EmptyState icon={Megaphone} title="No announcements" description="Announcements from your association will appear here." />
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Announcements" onBack={() => router.back()} />

      <FlatList
        data={query.isSuccess ? announcements : []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={isFetchingNextPage ? <Spinner /> : undefined}
        renderItem={({ item }) => (
          <View className="pb-3">
            <AnnouncementCard item={item} onOpen={() => markRead.mutate(item.id)} />
          </View>
        )}
        refreshing={query.isRefetching && !isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
