import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { format, isPast, isToday } from 'date-fns';

import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatMoney, toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { FinanceSummaryDTO } from '@/types/api/memberFinance';

type Props = {
  summaryQuery: UseQueryResult<FinanceSummaryDTO, unknown>;
};

/** Upcoming payment obligations — shows the next 5 from finance summary. */
export function UpcomingObligationsList({ summaryQuery }: Props) {
  const { color } = useThemeTokens();

  if (summaryQuery.isPending) {
    return (
      <View style={{ gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={64} radius="md" />
        ))}
      </View>
    );
  }

  const items = summaryQuery.data?.upcomingPayments ?? [];

  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <Text variant="body" tone="secondary">No upcoming obligations</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {items.slice(0, 5).map((item) => (
        <ObligationRow key={item.id} item={item} />
      ))}
    </View>
  );
}

function ObligationRow({ item }: { item: FinanceSummaryDTO['upcomingPayments'][number] }) {
  const { color } = useThemeTokens();
  const router = useRouter();
  const balance = toDecimal(item.balance);
  const dueDate = new Date(item.dueDate);
  const overdue = isPast(dueDate) && !isToday(dueDate);
  const dueColor = overdue ? color.danger : isToday(dueDate) ? color.warning : color.textSecondary;

  return (
    <Pressable
      onPress={() => router.push(`/(app)/(tabs)/money/transaction/${item.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${item.category.name}, due ${format(dueDate, 'MMM d, yyyy')}. Opens the charge.`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: overdue ? color.dangerSoft : color.surfaceRaised,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: overdue ? color.danger : color.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      {/* Left accent bar for overdue */}
      {overdue && (
        <View style={{ width: 3, height: '100%', backgroundColor: color.danger, borderRadius: 2 }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={1}>
          {item.category.name}
        </Text>
        <Text variant="caption" style={{ color: dueColor }}>
          Due {format(dueDate, 'MMM d, yyyy')}
          {overdue ? ' · Overdue' : isToday(dueDate) ? ' · Today' : ''}
        </Text>
      </View>
      <Text variant="label" style={{ color: overdue ? color.danger : color.text }}>
        {formatMoney(balance)}
      </Text>
    </Pressable>
  );
}
