import { View } from 'react-native';
import type { UseQueryResult } from '@tanstack/react-query';
import { format } from 'date-fns';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider'; // used in ActivityRow and StatusBadge
import type { FinanceSummaryDTO } from '@/types/api/memberFinance';

type Props = {
  summaryQuery: UseQueryResult<FinanceSummaryDTO, unknown>;
};

type StatusBadgeProps = { status: string };

function StatusBadge({ status }: StatusBadgeProps) {
  const { color } = useThemeTokens();
  const s = status.toLowerCase();
  const bg =
    s === 'paid' || s === 'completed'
      ? color.successSoft
      : s === 'overdue'
        ? color.dangerSoft
        : s === 'partial'
          ? color.warningSoft
          : color.surfaceSunken;

  const fg =
    s === 'paid' || s === 'completed'
      ? color.success
      : s === 'overdue'
        ? color.danger
        : s === 'partial'
          ? color.warning
          : color.textSecondary;

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
      <Text variant="caption" style={{ color: fg, textTransform: 'capitalize' }}>
        {status}
      </Text>
    </View>
  );
}

/** Member's own recent transactions — category, amount, status, date. Different from
 * RecentPaymentsList which shows confirmed payment records; this shows the underlying
 * obligations (dues/levies/penalties) and their current status. */
export function RecentActivityList({ summaryQuery }: Props) {
  if (summaryQuery.isPending) {
    return (
      <View style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={56} radius="md" />
        ))}
      </View>
    );
  }

  const items = summaryQuery.data?.recentTransactions ?? [];

  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text variant="body" tone="secondary">No recent activity</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.slice(0, 5).map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function ActivityRow({ item }: { item: FinanceSummaryDTO['recentTransactions'][number] }) {
  const { color } = useThemeTokens();
  const amount = toDecimal(item.amount);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color.surfaceRaised,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {item.category.name}
        </Text>
        <Text variant="caption" tone="secondary">
          {format(new Date(item.createdAt), 'MMM d, yyyy')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="label" style={{ color: color.text }}>
          {formatMoney(amount)}
        </Text>
        <StatusBadge status={item.status} />
      </View>
    </View>
  );
}
