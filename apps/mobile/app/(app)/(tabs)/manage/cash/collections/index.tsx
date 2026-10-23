import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { HandCoins, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { CollectionRow } from '@/features/cash/components/CollectionRow';
import { COLLECTION_STATUS_LABELS } from '@/features/cash/labels';
import { CASH_ANY_ACCESS, CASH_COLLECT_ACCESS, CASH_VIEW_ACCESS, useCashCollections } from '@/features/cash/queries';
import { useCan } from '@/hooks/useCan';
import type { CashCollectionDTO, CashCollectionStatus } from '@/types/api/cash';

const EMPTY_COPY: Record<CashCollectionStatus, { title: string; description: string }> = {
  OPEN: { title: 'No open collection', description: 'Open a collection when you start taking cash at a meeting.' },
  CLOSED: { title: 'No closed collections', description: 'Collections you have closed show up here, ready to lodge.' },
};

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 CA2 — cash collections, open or closed, newest first. */
export default function CollectionsScreen() {
  const router = useRouter();
  const canView = useCan(CASH_ANY_ACCESS);
  const canCollect = useCan(CASH_COLLECT_ACCESS);
  const canSeeAll = useCan(CASH_VIEW_ACCESS);
  const [status, setStatus] = useState<CashCollectionStatus>('OPEN');
  const query = useCashCollections(status);
  const collections = useMemo(() => query.data?.pages.flatMap((page) => page.collections) ?? [], [query.data]);
  const back = () => router.back();
  const open = (collection: CashCollectionDTO) => router.push(`/(app)/(tabs)/manage/cash/collections/${collection.id}` as never);
  const openNew = () => router.push('/(app)/(tabs)/manage/cash/collections/new' as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Collections" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const empty = EMPTY_COPY[status];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Collections"
        onBack={back}
        docsKey="CA2"
        rightActions={canCollect ? <IconButton icon={Plus} accessibilityLabel="Open a collection" onPress={openNew} testID="collections-new" /> : undefined}
      />

      <View className="pb-3">
        <SegmentedControl<CashCollectionStatus>
          options={[
            { label: COLLECTION_STATUS_LABELS.OPEN, value: 'OPEN' },
            { label: COLLECTION_STATUS_LABELS.CLOSED, value: 'CLOSED' },
          ]}
          value={status}
          onChange={setStatus}
          testID="collections-status"
        />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={collections}
          keyExtractor={(collection) => String(collection.id)}
          renderItem={({ item, index }) => <CollectionRow collection={item} position={positionOf(index, collections.length)} showCollector={canSeeAll} onPress={open} />}
          ListEmptyComponent={
            <EmptyState
              icon={HandCoins}
              title={empty.title}
              description={empty.description}
              actionLabel={status === 'OPEN' && canCollect ? 'Open a collection' : undefined}
              onAction={status === 'OPEN' && canCollect ? openNew : undefined}
            />
          }
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
      )}
    </Screen>
  );
}
