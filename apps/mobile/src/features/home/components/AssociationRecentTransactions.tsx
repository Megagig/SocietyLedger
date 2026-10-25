import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { format } from 'date-fns';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { chargeHref } from '@/features/reports/drill';
import { useReportsAccess } from '@/features/reports/queries';
import { formatMoney, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { DashboardOverviewDTO, RecentTransaction } from '@/api/endpoints/dashboard';

type Props = {
  dashboardQuery: UseQueryResult<DashboardOverviewDTO, unknown>;
};

/** All-member recent transactions for the officer Association view. Shows memberName,
 * amount, status, and date — mirroring the web admin dashboard table. */
export function AssociationRecentTransactions({ dashboardQuery }: Props) {
  const { color } = useThemeTokens();

  if (dashboardQuery.isPending) {
    return (
      <View style={{ gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={60} radius="md" />
        ))}
      </View>
    );
  }

  const transactions = dashboardQuery.data?.recentTransactions ?? [];

  if (transactions.length === 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text variant="body" tone="secondary">No transactions yet</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: color.surfaceRaised,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: color.border,
        overflow: 'hidden',
      }}
    >
      {transactions.slice(0, 6).map((tx, i) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          isLast={i === Math.min(transactions.length, 6) - 1}
        />
      ))}
    </View>
  );
}

function TransactionRow({ tx, isLast }: { tx: RecentTransaction; isLast: boolean }) {
  const { color } = useThemeTokens();
  const router = useRouter();
  const canOpen = useReportsAccess();
  const amount = toDecimal(tx.amount);
  const s = tx.status.toLowerCase();

  const statusColor =
    s === 'paid' || s === 'completed'
      ? color.success
      : s === 'overdue'
        ? color.danger
        : s === 'partial'
          ? color.warning
          : color.textSecondary;

  const statusBg =
    s === 'paid' || s === 'completed'
      ? color.successSoft
      : s === 'overdue'
        ? color.dangerSoft
        : s === 'partial'
          ? color.warningSoft
          : color.surfaceSunken;

  return (
    <Pressable
      onPress={canOpen ? () => router.push(chargeHref(tx.id) as never) : undefined}
      disabled={!canOpen}
      accessibilityRole={canOpen ? 'button' : undefined}
      accessibilityLabel={`${tx.memberName}, ${tx.category}, ${tx.status}. Opens the charge.`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: color.border,
      }}
    >
      <Avatar name={tx.memberName} shape="circle" size={32} colorSeed={String(tx.id)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>{tx.memberName}</Text>
        <Text variant="caption" tone="secondary">
          {tx.category} · {format(new Date(tx.date), 'MMM d, yyyy')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text variant="label">{formatMoney(amount)}</Text>
        <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
          <Text variant="caption" style={{ color: statusColor, textTransform: 'capitalize' }}>
            {tx.status}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
