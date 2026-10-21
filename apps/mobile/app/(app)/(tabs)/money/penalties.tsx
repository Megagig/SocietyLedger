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
import { useMemberPenalties } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { tokens } from '@/theme/tokens';

type PenaltyItem = {
  id: number;
  referenceNumber: string;
  category: { id: number; name: string; type: string };
  amount: Decimal;
  paid: Decimal;
  balance: Decimal;
  reason: string | null;
  status: string;
  createdAt: string;
};

function PenaltyRow({ item }: { item: PenaltyItem }) {
  const isPaid = item.status === 'paid';
  return (
    <View className="flex-row items-center px-4 py-3 gap-3">
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>{item.category.name}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {item.reason ?? item.referenceNumber} · {formatDate(item.createdAt, 'short')}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Money value={item.amount} size="body-strong" />
        <StatusChip status={item.status} />
        {!isPaid && (
          <Button
            size="sm"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/money/pay' as never, params: { transactionId: item.id } })
            }
          >
            Pay penalty
          </Button>
        )}
      </View>
    </View>
  );
}

export default function PenaltiesScreen() {
  const penaltiesQuery = useMemberPenalties();
  const penalties = penaltiesQuery.data ?? [];

  const totalOutstanding = penalties.reduce(
    (sum, p) => (p.status !== 'paid' ? sum + Number(p.balance) : sum),
    0,
  );
  const hasOutstanding = totalOutstanding > 0;

  return (
    <Screen edges={['top']} refreshing={penaltiesQuery.isRefetching} onRefresh={() => penaltiesQuery.refetch()}>
      <ScreenHeader title="My Penalties" onBack={() => router.back()} />

      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        {/* Dynamic summary banner — red if outstanding, green if clear */}
        {penaltiesQuery.isPending ? (
          <Skeleton width="100%" height={72} radius="lg" />
        ) : (
          <View className={['mx-4 rounded-xl p-4', hasOutstanding ? 'bg-danger/10' : 'bg-success/10'].join(' ')}>
            <Text variant="caption" tone="secondary">
              {hasOutstanding ? 'Outstanding penalties' : 'No outstanding penalties'}
            </Text>
            {hasOutstanding ? (
              <Money value={toDecimal(totalOutstanding)} size="h2" />
            ) : (
              <Text variant="body-strong" tone="success">Your account is clear</Text>
            )}
          </View>
        )}

        {/* Penalties list */}
        <Section>
          {penaltiesQuery.isPending ? (
            <View className="gap-2 px-4">
              <Skeleton width="100%" height={80} radius="md" />
              <Skeleton width="100%" height={80} radius="md" />
            </View>
          ) : penalties.length === 0 ? (
            <EmptyState
              title="No penalties"
              description="Any penalties assigned to your account will appear here."
            />
          ) : (
            <ListGroup>
              <FlatList
                data={penalties}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                renderItem={({ item }) => <PenaltyRow item={item} />}
              />
            </ListGroup>
          )}
        </Section>
      </View>
    </Screen>
  );
}
