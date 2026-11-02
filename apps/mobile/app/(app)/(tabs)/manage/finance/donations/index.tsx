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
import { CollectionBar } from '@/features/collections/components/CollectionBar';
import { RecordPaymentSheet, type RecordPaymentTarget } from '@/features/collections/components/RecordPaymentSheet';
import { RECORD_ACCESS } from '@/features/collections/queries';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { SETUP_CREATE_ACCESS, SETUP_EDIT_ACCESS, useCategories } from '@/features/financeSetup/queries';
import { useCan } from '@/hooks/useCan';
import { formatMoney } from '@/lib/money';
import type { SettlementFilter } from '@/types/api/collections';
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
  const canPay = useCan(RECORD_ACCESS);
  const [tab, setTab] = useState<Tab>('causes');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SettlementFilter>('all');
  const [pickedDonation, setPickedDonation] = useState<DonationListItemDTO | null>(null);
  const [payTarget, setPayTarget] = useState<RecordPaymentTarget | null>(null);
  const donationSheetRef = useRef<BottomSheetModal>(null);
  const payRef = useRef<BottomSheetModal>(null);
  const [picked, setPicked] = useState<CategoryDTO | null>(null);
  const causeSheetRef = useRef<BottomSheetModal>(null);
  const stats = useDonationStats().data;
  const causesQuery = useCategories({ type: 'donation' });
  const fundsQuery = useAllocations();
  const donationsQuery = useDonations({ status: status === 'all' ? undefined : status, search: search || undefined });
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
        <>
        <View className="pb-3">
          <CollectionBar screen="donations" search={search} onSearch={setSearch} status={status} onStatus={setStatus} placeholder="Search donor name or member number" />
        </View>
        <PagedList
          query={donationsQuery}
          items={donations}
          keyOf={(d) => String(d.id)}
          renderItem={(d: DonationListItemDTO, i, n) => (
            <DonationRow
              item={d}
              position={positionOf(i, n)}
              onPress={
                (canPay && d.balance > 0) || donationHasReceipt(d)
                  ? (donation) => {
                      setPickedDonation(donation);
                      donationSheetRef.current?.present();
                    }
                  : undefined
              }
            />
          )}
          empty={
            <EmptyState
              icon={Receipt}
              title={search || status !== 'all' ? 'Nobody matches this search and filter' : 'No donations yet'}
              description={search || status !== 'all' ? 'Try a different name or choose Everyone.' : 'Gifts and pledges you record show up here, with a receipt for each one received.'}
            />
          }
        />
        </>
      )}

      <BottomSheet ref={donationSheetRef} title={pickedDonation?.donor.name ?? 'Donation'} snapPoints={['40%']}>
        <View className="gap-3 pb-6">
          {pickedDonation && canPay && pickedDonation.balance > 0 ? (
            <Button
              variant="primary"
              onPress={() => {
                donationSheetRef.current?.dismiss();
                setPayTarget({ memberId: pickedDonation.memberDbId, memberLabel: pickedDonation.donor.name === 'Anonymous' ? 'Anonymous donor' : undefined, preselectTransactionId: pickedDonation.transactionId });
                payRef.current?.present();
              }}
              testID="donation-record-payment"
            >
              Record payment
            </Button>
          ) : null}
          {pickedDonation && donationHasReceipt(pickedDonation) ? (
            <Button
              variant="secondary"
              onPress={() => {
                donationSheetRef.current?.dismiss();
                go(`donations/receipt?id=${pickedDonation.id}`);
              }}
              testID="donation-receipt"
            >
              View receipt
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <RecordPaymentSheet ref={payRef} target={payTarget} source="donations" onRecorded={() => void donationsQuery.refetch()} />

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
