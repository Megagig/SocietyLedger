import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Heart, Plus } from 'lucide-react-native';
import { FlatList, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle, type IconCircleTone } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PAYOUT_STATUS_OPTIONS, PAYOUT_TYPE_LABELS, PAYOUT_TYPE_OPTIONS } from '@/features/welfare/labels';
import { useMyPayoutRequests, useWelfareFunds } from '@/features/welfare/queries';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { useCan } from '@/hooks/useCan';
import { WELFARE_VIEW_ACCESS, WELFARE_REQUEST_ACCESS } from '@/lib/permissions';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { WelfarePayoutListItemDTO } from '@/types/api/welfare';

function statusTone(status: WelfarePayoutListItemDTO['status']): IconCircleTone {
  if (status === 'DISBURSED' || status === 'APPROVED') return 'success';
  if (status === 'PENDING' || status === 'UNDER_REVIEW') return 'warning';
  return 'neutral';
}

/** project-overview.md §6.5 C11 — the member's own payout requests, filterable by fund / status / type (web `welfare/requests`). */
export default function WelfareRequestsScreen() {
  const router = useRouter();
  const canView = useCan(WELFARE_VIEW_ACCESS);
  const canRequest = useCan(WELFARE_REQUEST_ACCESS);
  const [fundId, setFundId] = useState<number | undefined>();
  const [status, setStatus] = useState('');
  const [payoutType, setPayoutType] = useState('');

  const fundsQuery = useWelfareFunds();
  const query = useMyPayoutRequests({ fundId, status: status || undefined, payoutType: payoutType || undefined });
  const locked = useModuleDisabled('welfare');
  const memberId = useMemberId();
  const requests = query.data?.pages.flatMap((p) => p.requests) ?? [];
  const funds = fundsQuery.data?.funds ?? [];
  const filtersActive = fundId !== undefined || status !== '' || payoutType !== '';

  const clearFilters = () => {
    setFundId(undefined);
    setStatus('');
    setPayoutType('');
  };

  if (locked) return <ModuleLockedScreen title="Payout requests" moduleName="Welfare" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Payout requests" onBack={() => router.back()} />
        <NoMemberProfile subject="payout requests" />
      </Screen>
    );
  }

  const header = (
    <View className="gap-3 pb-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <FilterChip label="All funds" active={fundId === undefined} onPress={() => setFundId(undefined)} />
        {funds.map((f) => (
          <FilterChip key={f.id} label={f.name} active={fundId === f.id} onPress={() => setFundId(f.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PAYOUT_STATUS_OPTIONS.map((o) => (
          <FilterChip key={o.value} label={o.label} active={status === o.value} onPress={() => setStatus(o.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <FilterChip label="All types" active={payoutType === ''} onPress={() => setPayoutType('')} />
        {PAYOUT_TYPE_OPTIONS.map((o) => (
          <FilterChip key={o.value} label={o.label} active={payoutType === o.value} onPress={() => setPayoutType(o.value)} />
        ))}
      </ScrollView>
    </View>
  );

  let empty: React.ReactElement;
  if (!canView) {
    empty = <EmptyState icon={Heart} title="No access" description="You don't have access to payout requests." />;
  } else if (query.isPending) {
    empty = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={64} radius="lg" />
        ))}
      </View>
    );
  } else if (query.isError) {
    empty = <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  } else {
    empty = (
      <EmptyState
        icon={Heart}
        title={filtersActive ? 'No requests match' : 'No payout requests'}
        description={filtersActive ? 'Try different filters.' : 'Submit a request when you need welfare support.'}
        actionLabel={filtersActive ? 'Clear filters' : canRequest ? 'Request support' : undefined}
        onAction={
          filtersActive
            ? clearFilters
            : canRequest
              ? () => router.push('/(app)/(tabs)/community/welfare/request' as never)
              : undefined
        }
      />
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Payout requests"
        onBack={() => router.back()}
        rightActions={
          canRequest ? (
            <IconButton
              icon={Plus}
              accessibilityLabel="Request support"
              onPress={() => router.push('/(app)/(tabs)/community/welfare/request' as never)}
            />
          ) : undefined
        }
      />
      <Text variant="body" tone="secondary" className="pb-3">
        Request and track welfare support payouts
      </Text>

      <FlatList
        data={canView && query.isSuccess ? requests : []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : undefined}
        renderItem={({ item }) => (
          <View className="pb-3">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={Heart} tone={statusTone(item.status)} />}
                title={item.fund.name}
                meta={`${PAYOUT_TYPE_LABELS[item.payoutType] ?? item.payoutType} · ${format(new Date(item.requestedAt), 'd MMM yyyy')}`}
                trailing={
                  <View className="items-end gap-1">
                    <Money value={item.amount} />
                    <StatusChip status={item.status} />
                  </View>
                }
              />
              {item.status === 'REJECTED' && item.rejectionReason ? (
                <View className="px-4 pb-3">
                  <Text variant="caption" tone="danger">
                    {item.rejectionReason}
                  </Text>
                </View>
              ) : null}
            </ListGroup>
          </View>
        )}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
