import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { HandHeart, Plus, PiggyBank, Receipt } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { AllocationRow, DonationRow } from '@/features/donationsPenalties/components/Rows';
import { donationHasReceipt } from '@/features/donationsPenalties/labels';
import { DONATION_RECORD_ACCESS, FINANCE_VIEW_ACCESS, FUND_CREATE_ACCESS, FUND_EDIT_ACCESS, useAllocations, useDonations, useDonationStats } from '@/features/donationsPenalties/queries';
import { CategoryRow } from '@/features/financeSetup/components/CategoryRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCategories } from '@/features/financeSetup/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { CategoryDTO } from '@/types/api/financeSetup';
import type { DonationListItemDTO } from '@/types/api/donationsPenalties';

type Tab = 'causes' | 'funds' | 'recent';

/**
 * project-overview.md §6.9 FN10 — donations: the causes members give to, the funds a gift can be directed into, and every donation with
 * its receipt. A donation is money received (instant) or promised (a pledge, owed until paid).
 */
export default function DonationsScreen() {
  const router = useRouter();
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const canRecord = useCan(DONATION_RECORD_ACCESS);
  const canCreateCause = useCan(SETUP_CREATE_ACCESS);
  const canEditCause = useCan(SETUP_EDIT_ACCESS);
  const canCreateFund = useCan(FUND_CREATE_ACCESS);
  const canEditFund = useCan(FUND_EDIT_ACCESS);
  const [tab, setTab] = useState<Tab>('causes');
  const [picked, setPicked] = useState<CategoryDTO | null>(null);
  const causeSheetRef = useRef<BottomSheetModal>(null);
  const stats = useDonationStats().data;
  const causesQuery = useCategories({ type: 'donation' });
  const fundsQuery = useAllocations();
  const donationsQuery = useDonations();
  const causes = useMemo(() => causesQuery.data?.pages.flatMap((p) => p.categories) ?? [], [causesQuery.data]);
  const funds = useMemo(() => fundsQuery.data?.pages.flatMap((p) => p.allocations) ?? [], [fundsQuery.data]);
  const donations = useMemo(() => donationsQuery.data?.pages.flatMap((p) => p.donations) ?? [], [donationsQuery.data]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/finance/${path}` as never);

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Donations" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const canAdd = tab === 'causes' ? canCreateCause : tab === 'funds' ? canCreateFund : false;
  const addLabel = tab === 'causes' ? 'Add a cause' : 'Add a fund';
  const onAdd = () => (tab === 'causes' ? go('categories/form?type=donation') : go('donations/allocation-form'));

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Donations"
        onBack={back}
        docsKey="FN10"
        rightActions={canAdd ? <IconButton icon={Plus} accessibilityLabel={addLabel} onPress={onAdd} testID="donations-new" /> : undefined}
      />

      <View className="gap-3 pb-3">
        {stats ? (
          <View className="flex-row gap-2">
            <StatTile label="Received" value={formatMoney(stats.totalReceived)} tone="success" />
            <StatTile label="Pledged, unpaid" value={formatMoney(stats.totalPledged)} tone="warning" />
            <StatTile label="Donations" value={String(stats.totalDonations)} tone="primary" />
          </View>
        ) : null}
        <SegmentedControl<Tab>
          options={[
            { label: 'Causes', value: 'causes' },
            { label: 'Funds', value: 'funds' },
            { label: 'Recent', value: 'recent' },
          ]}
          value={tab}
          onChange={setTab}
          testID="donations-tab"
        />
      </View>

      {tab === 'causes' ? (
        <PagedList
          query={causesQuery}
          items={causes}
          keyOf={(c) => String(c.id)}
          renderItem={(c, i, n) => (
            <CategoryRow
              category={c}
              position={positionOf(i, n)}
              onPress={canRecord || canEditCause ? (cause) => { setPicked(cause); causeSheetRef.current?.present(); } : undefined}
            />
          )}
          empty={
            <EmptyState
              icon={HandHeart}
              title="No causes yet"
              description="A cause is something members give to, like a building fund or a charity drive. Add one, then record gifts to it."
              actionLabel={canCreateCause ? 'Add a cause' : undefined}
              onAction={canCreateCause ? onAdd : undefined}
            />
          }
        />
      ) : tab === 'funds' ? (
        <PagedList
          query={fundsQuery}
          items={funds}
          keyOf={(f) => String(f.id)}
          skeletonHeight={88}
          renderItem={(f, i, n) => <AllocationRow item={f} position={positionOf(i, n)} onPress={canEditFund ? (fund) => go(`donations/allocation-form?id=${fund.id}`) : undefined} />}
          empty={
            <EmptyState
              icon={PiggyBank}
              title="No funds yet"
              description="A fund is a named pot a gift can be directed into, with an optional target, like Hall roof repairs."
              actionLabel={canCreateFund ? 'Add a fund' : undefined}
              onAction={canCreateFund ? onAdd : undefined}
            />
          }
        />
      ) : (
        <PagedList
          query={donationsQuery}
          items={donations}
          keyOf={(d) => String(d.id)}
          renderItem={(d: DonationListItemDTO, i, n) => (
            <DonationRow item={d} position={positionOf(i, n)} onPress={donationHasReceipt(d) ? (donation) => go(`donations/receipt?id=${donation.id}`) : undefined} />
          )}
          empty={<EmptyState icon={Receipt} title="No donations yet" description="Gifts and pledges you record show up here, with a receipt for each one received." />}
        />
      )}

      <BottomSheet ref={causeSheetRef} title={picked?.name ?? 'Cause'} snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {picked && canRecord && picked.isActive ? (
            <Button
              variant="primary"
              onPress={() => {
                causeSheetRef.current?.dismiss();
                go(`donations/record?categoryId=${picked.id}`);
              }}
              testID="cause-record"
            >
              Record a donation
            </Button>
          ) : null}
          {picked && canEditCause ? (
            <Button
              variant="secondary"
              onPress={() => {
                causeSheetRef.current?.dismiss();
                go(`categories/form?id=${picked.id}`);
              }}
              testID="cause-edit"
            >
              Edit cause
            </Button>
          ) : null}
          {picked && !picked.isActive ? (
            <Text variant="caption" tone="secondary">
              This cause is switched off, so gifts can&apos;t be recorded to it. Edit it to switch it back on.
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </Screen>
  );
}
