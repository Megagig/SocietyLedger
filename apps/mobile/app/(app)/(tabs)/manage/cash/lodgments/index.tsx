import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Landmark, Plus } from 'lucide-react-native';
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
import { LodgmentRow } from '@/features/cash/components/LodgmentRow';
import { LODGMENT_STATUS_LABELS } from '@/features/cash/labels';
import { CASH_ANY_ACCESS, CASH_LODGE_ACCESS, useCashLodgments, useCashOverview } from '@/features/cash/queries';
import { useCan } from '@/hooks/useCan';
import type { CashLodgmentDTO, CashLodgmentStatus } from '@/types/api/cash';

const EMPTY_COPY: Record<CashLodgmentStatus, { title: string; description: string }> = {
  PENDING: { title: 'Nothing waiting', description: 'Cash that has been paid into the bank shows up here until another officer checks it.' },
  VERIFIED: { title: 'No verified lodgments yet', description: 'Lodgments that were matched to the bank statement show up here.' },
  REJECTED: { title: 'No rejected lodgments', description: 'Lodgments that were not accepted show up here, with the reason.' },
};

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 CA7 — lodgments by status, newest first: waiting for a check, verified against the statement, or rejected. */
export default function LodgmentsScreen() {
  const router = useRouter();
  const canView = useCan(CASH_ANY_ACCESS);
  const canLodge = useCan(CASH_LODGE_ACCESS);
  const [status, setStatus] = useState<CashLodgmentStatus>('PENDING');
  const query = useCashLodgments(status);
  const waiting = useCashOverview().data?.lodgmentsToVerify ?? 0;
  const lodgments = useMemo(() => query.data?.pages.flatMap((page) => page.lodgments) ?? [], [query.data]);
  const back = () => router.back();
  const open = (lodgment: CashLodgmentDTO) => router.push(`/(app)/(tabs)/manage/cash/lodgments/${lodgment.id}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Lodgments" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const empty = EMPTY_COPY[status];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Lodgments"
        onBack={back}
        docsKey="CA7"
        rightActions={canLodge ? <IconButton icon={Plus} accessibilityLabel="Lodge cash" onPress={() => router.push('/(app)/(tabs)/manage/cash/lodge' as never)} testID="lodgments-new" /> : undefined}
      />

      <View className="pb-3">
        <SegmentedControl<CashLodgmentStatus>
          options={[
            { label: waiting > 0 ? `${LODGMENT_STATUS_LABELS.PENDING} (${waiting})` : LODGMENT_STATUS_LABELS.PENDING, value: 'PENDING' },
            { label: LODGMENT_STATUS_LABELS.VERIFIED, value: 'VERIFIED' },
            { label: LODGMENT_STATUS_LABELS.REJECTED, value: 'REJECTED' },
          ]}
          value={status}
          onChange={setStatus}
          testID="lodgments-status"
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
          data={lodgments}
          keyExtractor={(lodgment) => String(lodgment.id)}
          renderItem={({ item, index }) => <LodgmentRow lodgment={item} position={positionOf(index, lodgments.length)} onPress={open} />}
          ListEmptyComponent={<EmptyState icon={Landmark} title={empty.title} description={empty.description} />}
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
