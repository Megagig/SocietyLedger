import { FlatList, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Heart } from 'lucide-react-native';
import type { Decimal } from 'decimal.js-light';
import type { DonationDTO } from '@/types/api/memberFinance';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { donationTotals } from '@/features/memberFinance/donations';
import { useMemberDonations } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';
import { tokens } from '@/theme/tokens';

// The API's donation with its money fields turned into decimals (see `memberFinanceApi.getDonations`).
type DonationItem = Omit<DonationDTO, 'amount' | 'amountPaid' | 'balance'> & { amount: Decimal; amountPaid: Decimal; balance: Decimal };

function DonationRow({ item }: { item: DonationItem }) {
  const when = item.isPledge && item.dueDate ? `Pledged · due ${formatDate(item.dueDate, 'short')}` : formatDate(item.createdAt, 'short');
  return (
    <ListItem
      title={item.category.name}
      meta={`${when}${item.isAnonymous ? ' · Anonymous' : ''}`}
      trailing={
        item.isPledge ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Money value={item.balance} size="body-strong" />
            <Badge tone="warning">{item.amountPaid.gt(0) ? 'Part paid · Pay' : 'To pay · Pay now'}</Badge>
          </View>
        ) : (
          <Money value={item.amountPaid} size="body-strong" />
        )
      }
      showChevron={item.isPledge}
      onPress={item.isPledge ? () => router.push({ pathname: '/(app)/(tabs)/money/pay' as never, params: { transactionId: String(item.id) } }) : undefined}
      testID={`donation-${item.id}`}
    />
  );
}

export default function DonationsScreen() {
  const donationsQuery = useMemberDonations();

  // A pledge may have been paid online while this screen was behind another; re-read when it comes back into view.
  const { refetch } = donationsQuery;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const donations = donationsQuery.data?.donations ?? [];

  const { donated, pledged, pledgeCount } = donationTotals(donations);

  const hasDonations = donations.length > 0;

  return (
    <>
      <View style={{ flex: 1 }}>
      <Screen
        edges={['top']}
        refreshing={donationsQuery.isRefetching}
        onRefresh={() => donationsQuery.refetch()}
      >
        <ScreenHeader title="My Donations" onBack={() => router.back()} />

        <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 80 }}>
          {/* Summary banner — shown only when donations exist */}
          {donationsQuery.isPending ? (
            <Skeleton width="100%" height={72} radius="lg" />
          ) : hasDonations ? (
            <View className="mx-4 rounded-xl bg-primary/10 p-4">
              <Text variant="caption" tone="secondary">
                Total donated
              </Text>
              <Money value={donated} size="h2" />
              {pledgeCount > 0 ? (
                <View className="mt-3 flex-row items-center justify-between" testID="donations-pledged">
                  <Text variant="caption" tone="secondary">
                    {pledgeCount === 1 ? 'Pledged, still to pay' : `${pledgeCount} pledges, still to pay`}
                  </Text>
                  <Money value={pledged} size="body-strong" tone="warning" />
                </View>
              ) : null}
            </View>
          ) : null}

          <Section>
            {donationsQuery.isPending ? (
              <View className="gap-2 px-4">
                <Skeleton width="100%" height={60} radius="md" />
                <Skeleton width="100%" height={60} radius="md" />
                <Skeleton width="100%" height={60} radius="md" />
              </View>
            ) : !hasDonations ? (
              <View className="flex-1 items-center justify-center py-12">
                <EmptyState
                  icon={Heart}
                  title="No donations yet"
                  description="Your donation history will appear here once you make your first donation."
                  actionLabel="Make a donation"
                  onAction={() => router.push('/(app)/(tabs)/money/donations/new' as never)}
                />
              </View>
            ) : (
              <ListGroup>
                <FlatList
                  data={donations}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={false}
                  renderItem={({ item }) => <DonationRow item={item} />}
                />
              </ListGroup>
            )}
          </Section>
        </View>

      </Screen>
      {/* Only show sticky footer when there are donations — empty state has its own CTA */}
      {hasDonations && (
        <StickyFooter>
          <View style={{ flex: 1 }}>
            <Button variant="gradient" size="lg" fullWidth onPress={() => router.push('/(app)/(tabs)/money/donations/new' as never)}>
              Make a donation
            </Button>
          </View>
        </StickyFooter>
      )}
      </View>
    </>
  );
}
