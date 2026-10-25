import { FlashList } from '@shopify/flash-list';
import type { UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';

/**
 * A page-at-a-time list for an infinite query: skeletons while it loads, an error with retry, pull to refresh, and more rows as the
 * list is scrolled. The officer setup screens (donations, penalties) each show several of these under tabs.
 */
export function PagedList<T>({
  query,
  items,
  keyOf,
  renderItem,
  empty,
  header,
  skeletonHeight = 72,
}: {
  query: Pick<UseInfiniteQueryResult, 'isPending' | 'isError' | 'error' | 'refetch' | 'isRefetching' | 'isFetchingNextPage' | 'hasNextPage' | 'fetchNextPage'>;
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, index: number, count: number) => ReactElement;
  empty: ReactNode;
  /** Shown above the first row and scrolls with the list (a summary, or filters). */
  header?: ReactElement;
  skeletonHeight?: number;
}) {
  if (query.isPending) {
    return (
      <View className="gap-3">
        <Skeleton width="100%" height={skeletonHeight} radius="md" />
        <Skeleton width="100%" height={skeletonHeight} radius="md" />
        <Skeleton width="100%" height={skeletonHeight} radius="md" />
      </View>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <FlashList
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item, index }) => renderItem(item, index, items.length)}
      ListHeaderComponent={header}
      ListEmptyComponent={<>{empty}</>}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <View className="items-center py-4">
            <Spinner />
          </View>
        ) : (
          <View className="h-6" />
        )
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      showsVerticalScrollIndicator={false}
    />
  );
}
