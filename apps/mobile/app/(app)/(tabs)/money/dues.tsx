import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import type { Decimal } from 'decimal.js-light';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { useMemberDues } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { tokens } from '@/theme/tokens';

type StatusFilter = 'all' | 'unpaid' | 'paid';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Paid', value: 'paid' },
];

type DueItem = {
  id: number;
  referenceNumber: string;
  category: { id: number; name: string; type: string };
  amount: Decimal;
  balance: Decimal;
  dueDate: string;
  status: string;
  isOverdue: boolean;
};

function DueRow({ item }: { item: DueItem }) {
  const isPaid = item.status === 'paid';
  return (
    <View className="flex-row items-center px-4 py-3 gap-3">
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>{item.category.name}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          Due {formatDate(item.dueDate, 'short')} · {item.referenceNumber}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Money value={item.amount} size="body-strong" />
        <StatusChip status={item.isOverdue ? 'overdue' : item.status} />
        {!isPaid && (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => router.push({ pathname: '/money/pay' as never, params: { transactionId: item.id } })}
          >
            Pay now
          </Button>
        )}
      </View>
    </View>
  );
}

export default function DuesScreen() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const duesQuery = useMemberDues();
  const dues = duesQuery.data ?? [];

  const filtered = dues.filter((d) => {
    if (filter === 'unpaid') return d.status !== 'paid';
    if (filter === 'paid') return d.status === 'paid';
    return true;
  });

  const totalOutstanding = dues.reduce((sum, d) => (d.status !== 'paid' ? sum + Number(d.balance) : sum), 0);
  const hasOutstanding = totalOutstanding > 0;

  return (
    <Screen edges={['top']} refreshing={duesQuery.isRefetching} onRefresh={() => duesQuery.refetch()}>
      <ScreenHeader title="My Dues" onBack={() => router.back()} />

      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        {/* Summary banner */}
        {duesQuery.isPending ? (
          <Skeleton width="100%" height={72} radius="lg" />
        ) : (
          <View className={['mx-4 rounded-xl p-4', hasOutstanding ? 'bg-danger/10' : 'bg-success/10'].join(' ')}>
            <Text variant="caption" tone="secondary">
              {hasOutstanding ? 'Outstanding balance' : 'All dues cleared'}
            </Text>
            {hasOutstanding ? (
              <Money value={toDecimal(totalOutstanding)} size="h2" />
            ) : (
              <Text variant="body-strong" tone="success">Your account is clear</Text>
            )}
          </View>
        )}

        {/* Filter + Pay all */}
        <View className="mx-4 flex-row items-center gap-3">
          <View className="flex-1">
            <SegmentedControl options={STATUS_OPTIONS} value={filter} onChange={setFilter} />
          </View>
          {hasOutstanding && (
            <Button size="sm" onPress={() => router.push('/money/pay' as never)}>Pay all</Button>
          )}
        </View>

        {/* List */}
        <Section>
          {duesQuery.isPending ? (
            <View className="gap-2 px-4">
              <Skeleton width="100%" height={80} radius="md" />
              <Skeleton width="100%" height={80} radius="md" />
              <Skeleton width="100%" height={80} radius="md" />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={filter === 'unpaid' ? 'No unpaid dues' : filter === 'paid' ? 'No paid dues yet' : 'No dues yet'}
              description="Your dues will appear here once assigned."
            />
          ) : (
            <ListGroup>
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                renderItem={({ item }) => <DueRow item={item} />}
              />
            </ListGroup>
          )}
        </Section>
      </View>
    </Screen>
  );
}
