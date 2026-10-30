import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { boardSetting } from '../boardSetting';
import { formatDay } from '../format';
import { useRuleVersions } from '../queries';

/**
 * A rotating pot's Circle board setting, where an officer looks for it: on or off, when a change takes effect, and the way to change it.
 * The setting lives in the rules, so changing it is publishing a new version, which takes effect after the notice period.
 */
export function BoardSettingCard({ groupId, canChange }: { groupId: number; canChange: boolean }) {
  const router = useRouter();
  const versions = useRuleVersions(groupId);
  if (!versions.data) return null;
  const s = boardSetting(versions.data.versions);
  const words =
    s.state === 'ON'
      ? 'On. Members can see each other’s progress: who has paid, when, who is next and who is behind.'
      : s.state === 'OFF'
        ? 'Off. Members cannot see the circle board; only officers can.'
        : s.state === 'TURNS_ON'
          ? `Off now. It turns on ${formatDay(s.on)}, when the new rules take effect.`
          : `On now. It turns off ${formatDay(s.on)}, when the new rules take effect.`;
  return (
    <Card testID="ajo-board-setting">
      <View className="gap-1">
        <Text variant="h3">Circle board</Text>
        <Text variant="body">{words}</Text>
        <Text variant="caption" tone="tertiary">
          This is part of the circle’s rules, so a change is published as a new version and takes effect after 7 days’ notice, once members have been told.
        </Text>
        {canChange ? (
          <View className="flex-row pt-2">
            <Button size="sm" variant="secondary" onPress={() => router.push(`/(app)/(tabs)/manage/thrift/${groupId}/rules` as never)} testID="ajo-board-setting-rules">
              {s.state === 'OFF' || s.state === 'TURNS_OFF' ? 'Turn it on in Rules' : 'Change in Rules'}
            </Button>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
