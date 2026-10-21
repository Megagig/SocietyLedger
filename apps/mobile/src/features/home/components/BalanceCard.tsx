import type { UseQueryResult } from '@tanstack/react-query';

import { Passbook } from '@/components/ui/Passbook';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { toDecimal } from '@/lib/money';
import type { FinanceSummaryDTO } from '@/types/api/memberFinance';
import { InlineErrorRow } from './InlineErrorRow';

export type BalanceCardProps = {
  query: UseQueryResult<FinanceSummaryDTO, unknown>;
  onPay: () => void;
};

/** H1's "Balance card" — the home-specific wrapper that computes a Passbook's props from
 * `FinanceSummaryDTO` (stamp text, next-due meta line, Pay CTA visibility). */
export function BalanceCard({ query, onPay }: BalanceCardProps) {
  if (query.isPending) {
    return <Skeleton width="100%" height={176} radius="lg" />;
  }

  if (query.isError || !query.data) {
    return <InlineErrorRow title={t('home.balance.errorTitle')} onRetry={() => query.refetch()} />;
  }

  const summary = query.data;
  const outstanding = toDecimal(summary.totalOutstanding);
  const nextDueDate = summary.upcomingPayments[0]?.dueDate;
  const stampLabel =
    summary.overdueCount > 0 ? t('home.balance.overdueStamp', { count: String(summary.overdueCount) }) : t('home.balance.paidUpStamp');

  return (
    <Passbook
      label={t('home.balance.label')}
      amount={outstanding}
      metaLine={nextDueDate ? t('home.balance.nextDue', { date: formatDate(nextDueDate, 'long') }) : undefined}
      stampLabel={stampLabel}
      actionLabel={outstanding.greaterThan(0) ? t('home.balance.pay') : undefined}
      onAction={onPay}
      testID="home-balance-card"
    />
  );
}
