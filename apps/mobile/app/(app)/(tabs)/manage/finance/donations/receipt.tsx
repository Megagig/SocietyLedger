import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { receiptShareText } from '@/features/donationsPenalties/labels';
import { FINANCE_VIEW_ACCESS, useDonationReceipt } from '@/features/donationsPenalties/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.9 FN10 — a donation receipt, shared as text through the phone's share sheet (the donor's name is "Anonymous Donor" when they asked). */
export default function DonationReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const canView = useCan(FINANCE_VIEW_ACCESS);
  const query = useDonationReceipt(id);
  const back = () => router.back();

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Receipt" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const receipt = query.data;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Receipt" onBack={back} docsKey="FN10" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !receipt ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {receipt.association.name}
            </Text>
            <Money value={receipt.amount} size="h1" />
            <Text variant="caption" tone="secondary">
              {`Receipt ${receipt.receiptNumber}`}
            </Text>
          </View>

          <Section title="Details">
            <ListGroup>
              <FactRow label="Date" value={formatDate(receipt.donationDate, 'long')} />
              <FactRow label="From" value={receipt.donor.name} />
              <FactRow label="Cause" value={receipt.category} />
              <FactRow label="Fund" value={receipt.allocation?.name ?? null} />
              <FactRow label="Paid by" value={receipt.paymentMethod === 'N/A' ? null : receipt.paymentMethod.replace(/_/g, ' ')} />
              <FactRow label="Message" value={receipt.donorMessage} />
            </ListGroup>
          </Section>
        </View>
      )}

      {receipt ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => { void Share.share({ message: receiptShareText(receipt) }); }} testID="receipt-share">
              Share receipt
            </Button>
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
