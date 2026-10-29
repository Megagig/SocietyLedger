import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { formatDay, formatKobo, frequencyText, koboPositive, MODEL_LABEL, ordinal } from '../format';
import type { MyMembershipDTO } from '@/types/api/ajo';
import { useAjoWrite } from './AjoGate';
import { AjoMoney } from './AjoMoney';
import { AjoStatusBadge } from './AjoStatusBadge';

export const thriftHref = (membershipId: number, sub = '') => `/(app)/(tabs)/money/thrift/${membershipId}${sub}` as never;

/** One of the person's circles: what is owed, what is next, and where they stand in the payout order. */
export function MembershipCard({ item }: { item: MyMembershipDTO }) {
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const { group } = item;
  const owes = koboPositive(item.totalOwedKobo);
  const overdue = koboPositive(item.overdueKobo);

  return (
    <Card testID={`ajo-membership-${item.membershipId}`}>
      <View className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text variant="h3">{group.name}</Text>
            <Text variant="caption" tone="secondary">
              {MODEL_LABEL[group.model]} · {frequencyText(group)} · {formatKobo(group.contributionKobo)}
              {item.shares > 1 ? ` × ${item.shares} shares` : ''}
            </Text>
          </View>
          <AjoStatusBadge status={item.status === 'ACTIVE' ? group.status : item.status} />
        </View>

        {item.waitingFor.length > 0 ? (
          <View className="gap-1 rounded-md bg-warning-soft p-3">
            <Text variant="label" tone="warning">
              Before you can start, the circle is waiting for:
            </Text>
            {item.waitingFor.map((w) => (
              <Text key={w.requirement} variant="caption" tone="warning">
                • {w.text}
              </Text>
            ))}
          </View>
        ) : null}

        {item.status === 'ACTIVE' ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="caption" tone="secondary">
                Overdue
              </Text>
              <AjoMoney kobo={item.overdueKobo} tone={overdue ? 'danger' : 'default'} />
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="caption" tone="secondary">
                Next payment
              </Text>
              {item.nextDue ? (
                <View className="items-end">
                  <AjoMoney kobo={item.nextDue.remainingKobo} />
                  <Text variant="caption" tone="tertiary">
                    due {formatDay(item.nextDue.dueDate)}
                  </Text>
                </View>
              ) : (
                <Text variant="caption" tone="tertiary">
                  Nothing coming up
                </Text>
              )}
            </View>
            {group.model === 'ROTATING_POT' ? (
              <View className="flex-row items-center justify-between">
                <Text variant="caption" tone="secondary">
                  Your turn to collect
                </Text>
                <Text variant="body-strong">
                  {item.payoutPositions.length ? item.payoutPositions.map(ordinal).join(', ') : 'Not drawn yet'}
                  {item.payoutPositions.length && item.rounds ? ` of ${item.rounds}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => router.push(thriftHref(item.membershipId))} testID={`ajo-open-${item.membershipId}`}>
            Open
          </Button>
          {canWrite && item.status === 'ACTIVE' && owes ? (
            <Button fullWidth onPress={() => router.push(thriftHref(item.membershipId, '/pay'))} testID={`ajo-pay-${item.membershipId}`}>
              Pay
            </Button>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
