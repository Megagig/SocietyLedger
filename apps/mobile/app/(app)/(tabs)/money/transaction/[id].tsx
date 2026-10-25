import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';

import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useMemberOutstanding } from '@/features/memberFinance/queries';
import { formatDate } from '@/lib/dates';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = id ? Number(id) : NaN;

  const outstandingQuery = useMemberOutstanding();
  const item = outstandingQuery.data?.find((t) => t.id === numericId);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Transaction detail" onBack={() => router.back()} />

      {outstandingQuery.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={56} radius="md" />
          <Skeleton width="100%" height={56} radius="md" />
        </View>
      ) : !item ? (
        <EmptyState
          icon={AlertCircle}
          title="Transaction not found"
          description="This transaction may have been paid or no longer exists."
        />
      ) : (
        <View className="gap-6">
          {/* Header summary */}
          <View className="items-center gap-2 py-4">
            <Text variant="caption" tone="secondary" className="uppercase tracking-wide">
              {item.category.type} · {item.type}
            </Text>
            <Money value={item.amount} size="display" />
            <StatusChip status={item.balance.greaterThan(0) ? 'pending' : 'paid'} />
          </View>

          <Section title="Details">
            <ListGroup>
              <ListItem
                title="Category"
                trailing={<Text variant="body">{item.category.name}</Text>}
              />
              <ListItem
                title="Due date"
                trailing={
                  <Text variant="body">
                    {item.dueDate ? formatDate(item.dueDate, 'short') : '—'}
                  </Text>
                }
              />
              {item.campaign ? (
                <ListItem
                  title="Campaign"
                  trailing={<Text variant="body">{item.campaign.name}</Text>}
                />
              ) : null}
            </ListGroup>
          </Section>

          <Section title="Balance">
            <ListGroup>
              <ListItem
                title="Total charged"
                trailing={<Money value={item.amount} />}
              />
              <ListItem
                title="Remaining"
                trailing={<Money value={item.balance} size="body-strong" />}
              />
            </ListGroup>
          </Section>
        </View>
      )}
    </Screen>
  );
}
