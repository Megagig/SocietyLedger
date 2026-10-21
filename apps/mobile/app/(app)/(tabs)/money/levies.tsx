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
import { useMemberLevies } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';
import { tokens } from '@/theme/tokens';
import { useThemeTokens } from '@/providers/ThemeProvider';

type LevyItem = {
  id: number;
  campaign: {
    id: number;
    name: string;
    description: string | null;
    deadline: string | null;
    status: string;
    category: { id: number; name: string; type: string };
  };
  amount: Decimal;
  paid: Decimal;
  balance: Decimal;
  status: string;
  isOverdue: boolean;
  transactionId: number | null;
  assignedAt: string;
};

function ProgressBar({ paid, total }: { paid: Decimal; total: Decimal }) {
  const { color } = useThemeTokens();
  const pct = total.gt(0) ? Math.min(1, Number(paid) / Number(total)) : 0;
  return (
    <View style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 999, backgroundColor: color.border }}>
      <View
        style={{ height: 6, borderRadius: 999, width: `${Math.round(pct * 100)}%`, backgroundColor: color.primary }}
      />
    </View>
  );
}

function LevyRow({ item }: { item: LevyItem }) {
  const isPaid = item.status === 'paid';
  const paidPct = item.amount.gt(0)
    ? Math.round((Number(item.paid) / Number(item.amount)) * 100)
    : 0;

  return (
    <View className="px-4 py-3 gap-2">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>{item.campaign.name}</Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {item.campaign.category.name}
            {item.campaign.deadline ? ` · Deadline ${formatDate(item.campaign.deadline, 'short')}` : ''}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Money value={item.amount} size="body-strong" />
          <StatusChip status={item.isOverdue ? 'overdue' : item.status} />
        </View>
      </View>

      <ProgressBar paid={item.paid} total={item.amount} />
      <Text variant="caption" tone="secondary">{paidPct}% paid · <Money value={item.balance} size="caption" /></Text>

      {!isPaid && (
        item.transactionId != null ? (
          <Button
            variant="gradient"
            size="lg"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/money/pay' as never, params: { transactionId: item.transactionId } })
            }
          >
            Contribute now
          </Button>
        ) : (
          <Button variant="secondary" size="lg" fullWidth disabled>
            Contact admin to pay
          </Button>
        )
      )}
    </View>
  );
}

export default function LeviesScreen() {
  const leviesQuery = useMemberLevies();
  const levies = leviesQuery.data ?? [];

  return (
    <Screen edges={['top']} refreshing={leviesQuery.isRefetching} onRefresh={() => leviesQuery.refetch()}>
      <ScreenHeader title="My Levies" onBack={() => router.back()} />

      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        <Section>
          {leviesQuery.isPending ? (
            <View className="gap-2 px-4">
              <Skeleton width="100%" height={100} radius="md" />
              <Skeleton width="100%" height={100} radius="md" />
              <Skeleton width="100%" height={100} radius="md" />
            </View>
          ) : leviesQuery.isError ? (
            <EmptyState
              title="Could not load levies"
              description="Pull down to retry. If this persists, log out and back in."
            />
          ) : levies.length === 0 ? (
            <EmptyState
              title="No levies assigned"
              description="Levy campaigns assigned to you will appear here."
            />
          ) : (
            <ListGroup>
              <FlatList
                data={levies}
                keyExtractor={(item) => `levy-${item.id}`}
                scrollEnabled={false}
                renderItem={({ item }) => <LevyRow item={item} />}
              />
            </ListGroup>
          )}
        </Section>
      </View>
    </Screen>
  );
}
