import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { boardSetting } from '../boardSetting';
import { formatDay } from '../format';
import { useAjoAction } from '../mutations';
import { useRuleVersions } from '../queries';

/**
 * A rotating pot's Circle board setting, where an officer looks for it: on or off, when a change takes effect, and the way to change it.
 * The setting lives in the rules, so a change is a new version. Once the circle is running it takes effect after the notice period; before
 * it starts, while nobody is paying under the rules, the admin can choose to turn it on or off right now.
 */
export function BoardSettingCard({ groupId, canChange, groupStatus }: { groupId: number; canChange: boolean; groupStatus?: string }) {
  const router = useRouter();
  const versions = useRuleVersions(groupId);
  const [problem, setProblem] = useState<string | null>(null);
  const apply = useAjoAction((visibility: 'FULL' | 'OFF') => ajoApi.publishRules(groupId, { memberVisibility: visibility }, { immediate: true }));
  if (!versions.data) return null;
  const s = boardSetting(versions.data.versions);
  const turningOn = s.state === 'OFF' || s.state === 'TURNS_ON';
  const beforeStart = groupStatus === 'DRAFT' || groupStatus === 'OPEN';
  const waiting = s.state === 'TURNS_ON' || s.state === 'TURNS_OFF';
  const words =
    s.state === 'ON'
      ? 'On. Members can see each other’s progress: who has paid, when, who is next and who is behind.'
      : s.state === 'OFF'
        ? 'Off. Members cannot see the circle board; only officers can.'
        : s.state === 'TURNS_ON'
          ? `Off now. It turns on ${formatDay(s.on)}, when the new rules take effect.`
          : `On now. It turns off ${formatDay(s.on)}, when the new rules take effect.`;

  const doApply = async () => {
    setProblem(null);
    try {
      await apply.mutateAsync(turningOn ? 'FULL' : 'OFF');
      toast.success(turningOn ? 'The circle board is on. Members have been told.' : 'The circle board is off. Members have been told.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not change the circle board.');
    }
  };

  const ask = () =>
    Alert.alert(
      turningOn ? 'Turn the circle board on now?' : 'Turn the circle board off now?',
      turningOn
        ? `The board turns on straight away, with no notice period, because the circle has not started. Members are told. A person’s name shows on the board only after they have accepted rules that include the board; until then they appear as “Member 3”.${waiting ? ' A rule change is already waiting; it is brought forward too.' : ''}`
        : `The board turns off straight away. Members are told. Officers can still see it.${waiting ? ' A rule change is already waiting; it is brought forward too.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: turningOn ? 'Turn it on now' : 'Turn it off now', onPress: () => void doApply() },
      ],
    );

  return (
    <Card testID="ajo-board-setting">
      <View className="gap-1">
        <Text variant="h3">Circle board</Text>
        <Text variant="body">{words}</Text>
        <Text variant="caption" tone="tertiary">
          {beforeStart
            ? 'The circle has not started, so you can change this right now, or publish it as new rules with the usual 7 days’ notice.'
            : 'This is part of the circle’s rules, so a change is published as a new version and takes effect after 7 days’ notice, once members have been told.'}
        </Text>
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        {canChange ? (
          <View className="flex-row flex-wrap gap-2 pt-2">
            {beforeStart ? (
              <Button size="sm" loading={apply.isPending} onPress={ask} testID="ajo-board-now">
                {turningOn ? 'Turn it on now' : 'Turn it off now'}
              </Button>
            ) : null}
            {!beforeStart || !waiting ? (
              <Button size="sm" variant="secondary" onPress={() => router.push(`/(app)/(tabs)/manage/thrift/${groupId}/rules` as never)} testID="ajo-board-setting-rules">
                {turningOn ? 'Turn it on in Rules (with notice)' : 'Change in Rules'}
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
