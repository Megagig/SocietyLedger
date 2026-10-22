import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { SlidersHorizontal, Users } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { MemberFilterSheet } from '@/features/members/components/MemberFilterSheet';
import { countActiveFilters, type MemberFilterValues } from '@/features/members/labels';
import { MemberRow } from '@/features/members/components/MemberRow';
import { MEMBERS_VIEW_ACCESS, useMembersList, useMemberStats } from '@/features/members/queries';
import { useCan } from '@/hooks/useCan';
import type { MemberListItemDTO } from '@/types/api/membersManage';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 MG1 — the member directory: counts, search, filters and an infinite name-ordered list. */
export default function MembersListScreen() {
  const router = useRouter();
  const canView = useCan(MEMBERS_VIEW_ACCESS);
  const filterSheetRef = useRef<BottomSheetModal>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<MemberFilterValues>({});
  const activeFilters = countActiveFilters(filters);
  const term = search.trim();

  const listQuery = useMembersList({ ...filters, search: term || undefined });
  const statsQuery = useMemberStats();
  const members = useMemo(() => listQuery.data?.pages.flatMap((page) => page.members) ?? [], [listQuery.data]);
  const totalCount = listQuery.data?.pages[0]?.pagination.totalCount ?? 0;
  const stats = statsQuery.data;

  const back = () => router.back();
  const openMember = (member: MemberListItemDTO) => router.push(`/(app)/(tabs)/manage/members/${member.id}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Members" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const header = (
    <View className="gap-4 pb-4">
      {stats ? (
        <View className="flex-row gap-3">
          <StatTile label="Members" value={String(stats.totalMembers)} tone="primary" testID="members-stat-total" />
          <StatTile label="Active" value={String(stats.activeMembers)} tone="success" testID="members-stat-active" />
          <StatTile label="New this month" value={String(stats.newThisMonth)} tone="info" testID="members-stat-new" />
        </View>
      ) : null}
      {listQuery.data && (term || activeFilters > 0) ? (
        <Text variant="caption" tone="secondary">
          {totalCount === 1 ? '1 member found' : `${totalCount} members found`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Members" onBack={back} docsKey="MG1" />

      <View className="flex-row items-center gap-2 pb-3">
        <View className="flex-1">
          <SearchField value={search} onChangeText={setSearch} placeholder="Search name, ID, email or phone" testID="members-search" />
        </View>
        <View>
          <IconButton
            icon={SlidersHorizontal}
            variant="soft"
            accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} applied` : 'Filters'}
            onPress={() => filterSheetRef.current?.present()}
            testID="members-filters"
          />
          {activeFilters > 0 ? (
            <View className="absolute -right-1 -top-1">
              <Badge variant="count" count={activeFilters} />
            </View>
          ) : null}
        </View>
      </View>

      {listQuery.isPending ? (
        <View className="gap-3 pt-2">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
        </View>
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
      ) : (
        <FlashList
          data={members}
          keyExtractor={(member) => String(member.id)}
          renderItem={({ item, index }) => <MemberRow member={item} position={positionOf(index, members.length)} onPress={openMember} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon={Users}
              title={term || activeFilters > 0 ? 'No members match' : 'No members yet'}
              description={term || activeFilters > 0 ? 'Try a different name or clear the filters.' : 'Members you add will show up here.'}
              actionLabel={activeFilters > 0 ? 'Clear filters' : undefined}
              onAction={activeFilters > 0 ? () => setFilters({}) : undefined}
            />
          }
          ListFooterComponent={
            listQuery.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) void listQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={listQuery.isRefetching && !listQuery.isFetchingNextPage}
          onRefresh={() => {
            void listQuery.refetch();
            void statsQuery.refetch();
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <MemberFilterSheet ref={filterSheetRef} values={filters} onChange={setFilters} />
    </Screen>
  );
}
