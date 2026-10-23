import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Receipt } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatTile } from '@/components/ui/StatTile';
import { ChargeRow } from '@/features/finance/components/ChargeRow';
import { CHARGE_KIND_LABELS, CHARGE_KIND_OPTIONS, CHARGE_STATUS_LABELS, CHARGE_STATUS_OPTIONS } from '@/features/finance/labels';
import { CHARGE_CREATE_ACCESS, FINANCE_VIEW_ACCESS, useChargeStats, useCharges } from '@/features/finance/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { ChargeKind, ChargeListItemDTO, ChargeStatus } from '@/types/api/financeManage';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 FN2 — every charge, newest first, filtered by status and kind, searchable by member or reference. */
export default function ChargesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canCreate = useCan(CHARGE_CREATE_ACCESS);
  const [status, setStatus] = useState<ChargeStatus | ''>(CHARGE_STATUS_OPTIONS.includes(params.status as ChargeStatus) ? (params.status as ChargeStatus) : '');
  const [kind, setKind] = useState<ChargeKind | ''>('');
  const [search, setSearch] = useState('');
  const term = search.trim();
  const query = useCharges({ status: status || undefined, type: kind || undefined, search: term || undefined });
  const stats = useChargeStats().data;
  const charges = useMemo(() => query.data?.pages.flatMap((page) => page.transactions) ?? [], [query.data]);
  const back = () => router.back();
  const open = (charge: ChargeListItemDTO) => router.push(`/(app)/(tabs)/manage/finance/transactions/${charge.id}` as never);
  const openNew = () => router.push('/(app)/(tabs)/manage/finance/transactions/new' as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Charges" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const filtered = status !== '' || kind !== '' || term !== '';

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Charges"
        onBack={back}
        docsKey="FN2"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Charge members" onPress={openNew} testID="charges-new" /> : undefined}
      />

      <View className="gap-3 pb-3">
        {stats ? (
          <View className="flex-row gap-2">
            <StatTile label="Charges" value={String(stats.totalTransactions)} tone="primary" />
            <StatTile label="Billed" value={formatMoney(stats.totalAmount, { compact: true })} tone="info" />
            <StatTile label="Outstanding" value={formatMoney(Math.max(0, Number(stats.totalOutstanding)), { compact: true })} tone="warning" />
          </View>
        ) : null}
        <SearchField value={search} onChangeText={setSearch} placeholder="Search member, reference or note" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
          {CHARGE_STATUS_OPTIONS.map((s) => (
            <FilterChip key={s} label={CHARGE_STATUS_LABELS[s]} active={status === s} onPress={() => setStatus(status === s ? '' : s)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label="Any kind" active={kind === ''} onPress={() => setKind('')} />
          {CHARGE_KIND_OPTIONS.map((k) => (
            <FilterChip key={k} label={CHARGE_KIND_LABELS[k]} active={kind === k} onPress={() => setKind(kind === k ? '' : k)} />
          ))}
        </ScrollView>
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
          data={charges}
          keyExtractor={(charge) => String(charge.id)}
          renderItem={({ item, index }) => <ChargeRow charge={item} position={positionOf(index, charges.length)} onPress={open} />}
          ListEmptyComponent={
            <EmptyState
              icon={Receipt}
              title={filtered ? 'No charges match' : 'No charges yet'}
              description={filtered ? 'Try clearing a filter or a different search.' : 'Charge your members their dues, levies and penalties and they show up here.'}
              actionLabel={!filtered && canCreate ? 'Charge members' : undefined}
              onAction={!filtered && canCreate ? openNew : undefined}
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
