import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useCan } from '@/hooks/useCan';
import { AJO_MEMBER_ACCESS, useMyMemberships } from '../queries';
import { thriftHref } from './MembershipCard';

/**
 * An officer is often a member of the same circle. On the officers' screen for a circle, this says so, and when their own membership is
 * still waiting on them (for example to accept the rules) it puts the action right there. Shows nothing when the person is not in this circle.
 */
export function MyMembershipBanner({ groupId }: { groupId: number }) {
  const router = useRouter();
  const member = useCan(AJO_MEMBER_ACCESS);
  const mine = useMyMemberships(member);
  const item = (mine.data ?? []).find((m) => m.group.id === groupId && m.status !== 'LEFT');
  if (!item) return null;
  const needsRules = item.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE');

  if (item.waitingFor.length > 0) {
    return (
      <View className="gap-2 rounded-lg bg-warning-soft p-4" testID="ajo-my-membership-banner">
        <Text variant="body-strong" tone="warning">
          You are also a member of this circle, and your own membership is not active yet.
        </Text>
        {item.waitingFor.map((w) => (
          <Text key={w.requirement} variant="caption" tone="warning">
            • {w.text}
          </Text>
        ))}
        {needsRules ? (
          <Button onPress={() => router.push(thriftHref(item.membershipId, '/rules'))} testID="ajo-my-membership-accept-rules">
            Read and accept the rules
          </Button>
        ) : null}
        <Button variant="secondary" onPress={() => router.push(thriftHref(item.membershipId))} testID="ajo-my-membership-open">
          Open my membership
        </Button>
      </View>
    );
  }
  return (
    <View className="flex-row items-center justify-between gap-3" testID="ajo-my-membership-link">
      <Text variant="caption" tone="secondary" className="flex-1">
        You are also a member of this circle.
      </Text>
      <Button size="sm" variant="secondary" onPress={() => router.push(thriftHref(item.membershipId))}>
        Open my membership
      </Button>
    </View>
  );
}
