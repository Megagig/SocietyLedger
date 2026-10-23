import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { HandCoins, Plus, Rocket } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { CAMPAIGN_STATUS_LABELS } from '@/features/financeSetup/labels';
import { CampaignRow } from '@/features/financeSetup/components/CampaignRow';
import { CategoryRow } from '@/features/financeSetup/components/CategoryRow';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { ASSIGN_ACCESS, FINANCE_VIEW_ACCESS, SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCampaigns, useCategories } from '@/features/financeSetup/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { CampaignListItemDTO, CampaignStatus, CategoryDTO } from '@/types/api/financeSetup';

type Tab = 'campaigns' | 'types';
type StatusFilter = '' | CampaignStatus;

const STATUS_FILTERS: CampaignStatus[] = ['ACTIVE', 'CLOSED', 'COMPLETED'];

/**
 * project-overview.md §6.9 FN8 — levy campaigns (collected against a target) and the levy types they are raised under. A levy is a debt:
 * closing a campaign only stops new members; what members were charged stays owed.
 */
export default function LeviesScreen() {
  const router = useRouter();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canCreate = useCan(SETUP_CREATE_ACCESS);
  const canEdit = useCan(SETUP_EDIT_ACCESS);
  const canAssign = useCan(ASSIGN_ACCESS);
  const [tab, setTab] = useState<Tab>('campaigns');
  const [status, setStatus] = useState<StatusFilter>('');
  const [picked, setPicked] = useState<CategoryDTO | null>(null);
  const typeSheetRef = useRef<BottomSheetModal>(null);
  const campaignsQuery = useCampaigns({});
  const typesQuery = useCategories({ type: 'levy' });
  const allCampaigns = useMemo(() => campaignsQuery.data?.pages.flatMap((page) => page.campaigns) ?? [], [campaignsQuery.data]);
  const campaigns = useMemo(() => (status === '' ? allCampaigns : allCampaigns.filter((c) => c.status === status)), [allCampaigns, status]);
  const types = useMemo(() => typesQuery.data?.pages.flatMap((page) => page.categories) ?? [], [typesQuery.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Levies" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const active = allCampaigns.filter((c) => c.status === 'ACTIVE').length;
  const collected = allCampaigns.reduce((sum, c) => sum + c.progress.totalCollected, 0);
  const stillOwed = allCampaigns.reduce((sum, c) => sum + c.progress.stillOwed, 0);
  const query = tab === 'campaigns' ? campaignsQuery : typesQuery;
  const addLabel = tab === 'campaigns' ? 'Start a campaign' : 'Add a levy type';
  const onAdd = () => (tab === 'campaigns' ? go('levies/campaign-form') : go('categories/form?type=levy'));

  const openType = (category: CategoryDTO) => {
    setPicked(category);
    typeSheetRef.current?.present();
  };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Levies"
        onBack={back}
        docsKey="FN8"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel={addLabel} onPress={onAdd} testID="levies-new" /> : undefined}
      />

      <View className="gap-3 pb-3">
        {tab === 'campaigns' && !campaignsQuery.isPending ? (
          <View className="flex-row gap-2">
            <StatTile label="Active campaigns" value={String(active)} tone="primary" />
            <StatTile label="Collected" value={formatMoney(collected)} tone="success" />
            <StatTile label="Still owed" value={formatMoney(stillOwed)} tone="warning" />
          </View>
        ) : null}
        <SegmentedControl<Tab>
          options={[
            { label: 'Campaigns', value: 'campaigns' },
            { label: 'Levy types', value: 'types' },
          ]}
          value={tab}
          onChange={setTab}
          testID="levies-tab"
        />
        {tab === 'campaigns' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <FilterChip label="All" active={status === ''} onPress={() => setStatus('')} />
            {STATUS_FILTERS.map((s) => (
              <FilterChip key={s} label={CAMPAIGN_STATUS_LABELS[s]} active={status === s} onPress={() => setStatus(status === s ? '' : s)} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={96} radius="md" />
          <Skeleton width="100%" height={96} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : tab === 'campaigns' ? (
        <FlashList
          data={campaigns}
          keyExtractor={(campaign) => String(campaign.id)}
          renderItem={({ item, index }: { item: CampaignListItemDTO; index: number }) => (
            <CampaignRow campaign={item} position={positionOf(index, campaigns.length)} onPress={(c) => go(`levies/${c.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={Rocket}
              title={status ? 'No campaigns match' : 'No campaigns yet'}
              description={status ? 'Try another filter.' : 'A campaign raises a levy towards a target with a deadline. Start one and put members on it.'}
              actionLabel={!status && canCreate ? 'Start a campaign' : undefined}
              onAction={!status && canCreate ? onAdd : undefined}
            />
          }
          ListFooterComponent={
            campaignsQuery.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (campaignsQuery.hasNextPage && !campaignsQuery.isFetchingNextPage) void campaignsQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={campaignsQuery.isRefetching && !campaignsQuery.isFetchingNextPage}
          onRefresh={() => void campaignsQuery.refetch()}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlashList
          data={types}
          keyExtractor={(category) => String(category.id)}
          renderItem={({ item, index }: { item: CategoryDTO; index: number }) => (
            <CategoryRow category={item} position={positionOf(index, types.length)} onPress={canEdit || canAssign ? openType : undefined} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={HandCoins}
              title="No levy types yet"
              description="A levy type is a kind of special contribution, like a building fund. Add one, then raise it as a campaign or charge it straight to members."
              actionLabel={canCreate ? 'Add a levy type' : undefined}
              onAction={canCreate ? onAdd : undefined}
            />
          }
          ListFooterComponent={
            typesQuery.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (typesQuery.hasNextPage && !typesQuery.isFetchingNextPage) void typesQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={typesQuery.isRefetching && !typesQuery.isFetchingNextPage}
          onRefresh={() => void typesQuery.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomSheet ref={typeSheetRef} title={picked?.name ?? 'Levy type'} snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {picked && canAssign && picked.isActive ? (
            <Button
              variant="primary"
              onPress={() => {
                typeSheetRef.current?.dismiss();
                go(`dues?categoryId=${picked.id}`);
              }}
              testID="levy-type-assign"
            >
              Assign to members
            </Button>
          ) : null}
          {picked && canEdit ? (
            <Button
              variant="secondary"
              onPress={() => {
                typeSheetRef.current?.dismiss();
                go(`categories/form?id=${picked.id}`);
              }}
              testID="levy-type-edit"
            >
              Edit levy type
            </Button>
          ) : null}
          {picked && !picked.isActive ? (
            <Text variant="caption" tone="secondary">
              This levy type is switched off. Edit it to switch it back on.
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
