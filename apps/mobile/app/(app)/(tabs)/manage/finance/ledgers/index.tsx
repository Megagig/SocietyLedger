import { FlashList } from '@shopify/flash-list';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { CollectionBar } from '@/features/collections/components/CollectionBar';
import { RecordPaymentSheet, type RecordPaymentTarget } from '@/features/collections/components/RecordPaymentSheet';
import { LEDGER_OPTIONS } from '@/features/collections/labels';
import { RECORD_ACCESS } from '@/features/collections/queries';
import { LedgerMemberRow } from '@/features/ledgers/LedgerMemberRow';
import { LEDGERS_VIEW_ACCESS, useLedgerMembers } from '@/features/ledgers/queries';
import { useCan } from '@/hooks/useCan';
import type { SettlementFilter } from '@/types/api/collections';
import type { LedgerMemberDTO } from '@/types/api/ledgerManage';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 FN13 — every member with what they owe or are owed; open one to see their statement. */
export default function LedgersScreen() {
  const router = useRouter();
  const canView = useCan(LEDGERS_VIEW_ACCESS);
  const canRecord = useCan(RECORD_ACCESS);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SettlementFilter>('all');
  const [payTarget, setPayTarget] = useState<RecordPaymentTarget | null>(null);
  const payRef = useRef<BottomSheetModal>(null);
  const term = search.trim();
  const query = useLedgerMembers(term, status === 'owing' ? 'owing' : status === 'paid' ? 'paid' : undefined);
  const members = useMemo(() => query.data?.pages.flatMap((page) => page.members) ?? [], [query.data]);
  const back = () => router.back();
  const open = (member: LedgerMemberDTO) => router.push(`/(app)/(tabs)/manage/finance/ledgers/${member.id}` as never);
  const record = (member: LedgerMemberDTO) => {
    setPayTarget({ memberId: member.id });
    payRef.current?.present();
  };

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Member ledgers" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Member ledgers" onBack={back} docsKey="FN13" />

      <View className="pb-3">
        <CollectionBar screen="member-ledger" search={search} onSearch={setSearch} status={status} onStatus={setStatus} options={LEDGER_OPTIONS} placeholder="Search name, member ID or email" />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={members}
          keyExtractor={(member) => String(member.id)}
          renderItem={({ item, index }) => <LedgerMemberRow member={item} position={positionOf(index, members.length)} onPress={open} onRecord={canRecord ? record : undefined} />}
          ListEmptyComponent={<EmptyState icon={BookOpen} title={term ? 'No members match' : 'No members yet'} description={term ? 'Try a different name or ID.' : 'Members and what they owe show up here.'} />}
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

      <RecordPaymentSheet ref={payRef} target={payTarget} source="member-ledger" onRecorded={() => void query.refetch()} />
    </Screen>
  );
}
