import { Inbox } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { ProofButton } from '@/features/coopEnhanced/components/ProofButton';
import { RangeFilter } from '@/features/coopEnhanced/components/RangeFilter';
import { PAYMENT_STATUS_KEYS, PAYMENT_STATUS_LABELS } from '@/features/coopEnhanced/labels';
import { loadPendingProof, useMyPendingPayments } from '@/features/coopEnhanced/queries';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_OWN_PAGES_ACCESS } from '@/lib/permissions';

type Kind = 'ALL' | 'SAVINGS' | 'LOAN_REPAYMENT';
const KINDS: { label: string; value: Kind }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Savings', value: 'SAVINGS' },
  { label: 'Loan repayments', value: 'LOAN_REPAYMENT' },
];

const isoDay = (d: Date) => {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 2);
  return { from: isoDay(from), to: isoDay(to) };
};

/**
 * My Pending Payments: every payment you have declared (savings payments and loan repayments) and where each one stands. A payment is only
 * added to your account once an officer confirms the money arrived; a rejected one says why, so you know what to fix.
 */
export default function MyPendingPaymentsScreen() {
  const [range, setRange] = useState(defaultRange);
  const [kind, setKind] = useState<Kind>('ALL');
  const [newestFirst, setNewestFirst] = useState(true);
  const query = useMyPendingPayments({ ...range, type: kind === 'ALL' ? undefined : kind, sort: newestFirst ? 'newest' : 'oldest' });
  const items = query.data?.items ?? [];

  return (
    <OwnPage
      title="My pending payments"
      subject="payments"
      access={COOPERATIVE_OWN_PAGES_ACCESS}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
    >
      <View className="gap-4 pb-8">
        <Text variant="body" tone="secondary">
          Review the payments you have declared and where each one stands.
        </Text>
        <RangeFilter from={range.from} to={range.to} onApply={setRange} />
        <SegmentedControl<Kind> options={KINDS} value={kind} onChange={setKind} testID="pending-kind" />
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="secondary">
            {query.data ? `${query.data.count} record${query.data.count === 1 ? '' : 's'}` : ''}
          </Text>
          <Button variant="ghost" size="sm" onPress={() => setNewestFirst((v) => !v)} testID="pending-sort">
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </Button>
        </View>

        {query.isPending ? (
          <View className="gap-3">
            <Skeleton width="100%" height={100} radius="lg" />
            <Skeleton width="100%" height={100} radius="lg" />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Inbox} title="No pending payments found" description="Payments you declare will be listed here until an officer confirms them." />
        ) : (
          <View className="gap-3">
            {items.map((item) => (
              <Card key={`${item.kind}-${item.id}`}>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text variant="body-strong">{item.paymentType}</Text>
                    {item.detail && item.detail !== item.paymentType ? (
                      <Text variant="caption" tone="secondary" numberOfLines={2}>{item.detail}</Text>
                    ) : null}
                    <Text variant="caption" tone="secondary">{`${formatDate(item.date, 'short')}${item.reference ? ` · Ref ${item.reference}` : ''}`}</Text>
                  </View>
                  <View className="items-end gap-1.5">
                    <Money value={item.amount} />
                    <StatusChip status={PAYMENT_STATUS_KEYS[item.status]} label={PAYMENT_STATUS_LABELS[item.status]} />
                  </View>
                </View>
                {item.status === 'REJECTED' && item.rejectionReason ? (
                  <Text variant="caption" tone="danger" className="mt-2">{`Reason: ${item.rejectionReason}`}</Text>
                ) : null}
                {item.hasReceipt ? (
                  <View className="mt-2 flex-row">
                    <ProofButton
                      load={() => loadPendingProof(item)}
                      testID={`pending-proof-${item.kind}-${item.id}`}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </View>
    </OwnPage>
  );
}
