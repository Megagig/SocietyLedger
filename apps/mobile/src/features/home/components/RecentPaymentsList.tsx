import { View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import type { memberFinanceApi } from '@/api/endpoints/memberFinance';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { InlineErrorRow } from './InlineErrorRow';

type MemberPayment = Awaited<ReturnType<typeof memberFinanceApi.getPayments>>[number];

export type RecentPaymentsListProps = {
  query: UseQueryResult<MemberPayment[], unknown>;
  onPressPayment: (payment: MemberPayment) => void;
};

const PREVIEW_COUNT = 3;

/** H1's "Recent payments (3)" — `memberFinanceApi.getPayments()` has no server-side limit
 * (that file's own finding), so this slices the first 3 of the already-newest-first list.
 * Every row here is a confirmed `Payment` record (not a pending transaction), so the status
 * chip is always "paid" — there is no other status this endpoint can return. */
export function RecentPaymentsList({ query, onPressPayment }: RecentPaymentsListProps) {
  if (query.isPending) {
    return (
      <View className="gap-2">
        <Skeleton width="100%" height={56} radius="md" />
        <Skeleton width="100%" height={56} radius="md" />
      </View>
    );
  }

  if (query.isError) {
    return <InlineErrorRow title={t('home.payments.errorTitle')} onRetry={() => query.refetch()} />;
  }

  const payments = (query.data ?? []).slice(0, PREVIEW_COUNT);
  if (payments.length === 0) {
    return <EmptyState title={t('home.payments.emptyTitle')} description={t('home.payments.emptyDescription')} />;
  }

  return (
    <ListGroup testID="home-recent-payments">
      {payments.map((payment) => (
        <ListItem
          key={payment.id}
          title={payment.transaction.category.name}
          meta={formatDate(payment.paymentDate, 'short')}
          trailing={
            <View className="items-end gap-1">
              <Money value={payment.amount} />
              <StatusChip status="paid" />
            </View>
          }
          onPress={() => onPressPayment(payment)}
        />
      ))}
    </ListGroup>
  );
}
