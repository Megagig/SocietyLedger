import { useState } from 'react';
import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { FlatList, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { CONTRIBUTION_STATUS_OPTIONS } from '@/features/welfare/labels';
import { useMyContributions, useWelfareFunds } from '@/features/welfare/queries';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { useCan } from '@/hooks/useCan';
import { WELFARE_VIEW_ACCESS } from '@/lib/permissions';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { WelfareContributionDTO } from '@/types/api/welfare';

/** project-overview.md §6.5 C11 — the member's own welfare contributions, filterable by fund and status (web `welfare/contributions`). */
export default function WelfareContributionsScreen() {
  const router = useRouter();
  const canView = useCan(WELFARE_VIEW_ACCESS);
  const [fundId, setFundId] = useState<number | undefined>();
  const [status, setStatus] = useState('');

  const fundsQuery = useWelfareFunds();
  const query = useMyContributions({ fundId, status: status || undefined });
  const locked = useModuleDisabled('welfare');
  const memberId = useMemberId();
  const contributions: WelfareContributionDTO[] = query.data?.pages.flatMap((p) => p.contributions) ?? [];
  const funds = fundsQuery.data?.funds ?? [];
  const filtersActive = fundId !== undefined || status !== '';

  if (locked) return <ModuleLockedScreen title="Contributions" moduleName="Welfare" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Contributions" onBack={() => router.back()} />
        <NoMemberProfile subject="welfare contributions" />
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
        {CONTRIBUTION_STATUS_OPTIONS.map((o) => (
          <FilterChip key={o.value} label={o.label} active={status === o.value} onPress={() => setStatus(o.value)} />
        ))}
      </ScrollView>
    </View>
  );

  let empty: React.ReactElement;
  if (!canView) {
    empty = <EmptyState icon={HandCoins} title="No access" description="You don't have access to welfare contributions." />;
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
        icon={HandCoins}
        title={filtersActive ? 'No contributions match' : 'No contributions found'}
        description={filtersActive ? 'Try a different fund or status.' : 'Your welfare contributions will appear here.'}
        actionLabel={filtersActive ? 'Clear filters' : undefined}
        onAction={
          filtersActive
            ? () => {
                setFundId(undefined);
                setStatus('');
              }
            : undefined
        }
      />
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Contributions" onBack={() => router.back()} />
      <Text variant="body" tone="secondary" className="pb-3">
        Track your contributions to welfare funds
      </Text>

      <FlatList
        data={canView && query.isSuccess ? contributions : []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={query.isFetchingNextPage ? <Spinner /> : undefined}
        renderItem={({ item }) => (
          <View className="pb-3">
            <ListGroup>
              <ListItem
                leading={<IconCircle icon={HandCoins} tone={item.status === 'CONFIRMED' ? 'success' : 'neutral'} />}
                title={item.fund.name}
                meta={`${format(new Date(item.contributionDate), 'd MMM yyyy')}${item.paymentMethod ? ` · ${item.paymentMethod}` : ''}`}
                trailing={
                  <View className="items-end gap-1">
                    <Money value={item.amount} />
                    <StatusChip status={item.status} />
                  </View>
                }
              />
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
