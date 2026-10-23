import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Landmark, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { TransferRow } from '@/features/nigerianPayments/components/TransferRow';
import { TRANSFER_STATUS_LABELS } from '@/features/nigerianPayments/labels';
import { TRANSFERS_RECORD_ACCESS, TRANSFERS_VIEW_ACCESS, usePendingTransferCount, useTransfers } from '@/features/nigerianPayments/queries';
import { useCan } from '@/hooks/useCan';
import type { BankTransferStatus } from '@/types/api/enums';
import type { BankTransferListItemDTO } from '@/types/api/bankManage';

const EMPTY_COPY: Record<BankTransferStatus, { title: string; description: string }> = {
  PENDING: { title: 'Nothing waiting', description: 'Transfers you record show up here until someone verifies them.' },
  VERIFIED: { title: 'No verified transfers yet', description: 'Transfers that have been confirmed in the bank statement show up here.' },
  MATCHED: { title: 'No matched transfers', description: 'Transfers tied to a charge in reconciliation show up here.' },
  REJECTED: { title: 'No rejected transfers', description: 'Transfers that were rejected show up here.' },
};

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 PY4 — recorded bank transfers by status, newest first, searchable by reference, sender or narration. */
export default function TransfersScreen() {
  const router = useRouter();
  const canView = useCan(TRANSFERS_VIEW_ACCESS);
  const canRecord = useCan(TRANSFERS_RECORD_ACCESS);
  const [status, setStatus] = useState<BankTransferStatus>('PENDING');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useTransfers(status, term);
  const waiting = usePendingTransferCount().data ?? 0;
  const transfers = useMemo(() => query.data?.pages.flatMap((page) => page.transfers) ?? [], [query.data]);
  const back = () => router.back();
  const open = (transfer: BankTransferListItemDTO) => router.push(`/(app)/(tabs)/manage/payments/transfers/${transfer.id}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Bank transfers" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const empty = EMPTY_COPY[status];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Bank transfers"
        onBack={back}
        docsKey="PY4"
        rightActions={
          canRecord ? <IconButton icon={Plus} accessibilityLabel="Record a transfer" onPress={() => router.push('/(app)/(tabs)/manage/payments/transfers/form' as never)} testID="transfers-record" /> : undefined
        }
      />

      <View className="gap-3 pb-3">
        <SegmentedControl<BankTransferStatus>
          options={[
            { label: waiting > 0 ? `${TRANSFER_STATUS_LABELS.PENDING} (${waiting})` : TRANSFER_STATUS_LABELS.PENDING, value: 'PENDING' },
            { label: TRANSFER_STATUS_LABELS.VERIFIED, value: 'VERIFIED' },
            { label: TRANSFER_STATUS_LABELS.MATCHED, value: 'MATCHED' },
            { label: TRANSFER_STATUS_LABELS.REJECTED, value: 'REJECTED' },
          ]}
          value={status}
          onChange={setStatus}
          testID="transfers-status"
        />
        <SearchField value={search} onChangeText={setSearch} placeholder="Search reference, sender or narration" />
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
          data={transfers}
          keyExtractor={(transfer) => String(transfer.id)}
          renderItem={({ item, index }) => <TransferRow transfer={item} position={positionOf(index, transfers.length)} onPress={open} />}
          ListEmptyComponent={
            <EmptyState
              icon={Landmark}
              title={term ? 'No transfers match' : empty.title}
              description={term ? 'Try a different reference or name.' : empty.description}
              actionLabel={!term && status === 'PENDING' && canRecord ? 'Record a transfer' : undefined}
              onAction={!term && status === 'PENDING' && canRecord ? () => router.push('/(app)/(tabs)/manage/payments/transfers/form' as never) : undefined}
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
