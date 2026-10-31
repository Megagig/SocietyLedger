import { useLocalSearchParams } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { RulesFields } from '@/features/ajo/components/RulesFields';
import { formatDay } from '@/features/ajo/format';
import { DEFAULT_RULES, rulesFormToInput, rulesToForm, type RulesFormValues } from '@/features/ajo/groupForm';
import { useAjoAction } from '@/features/ajo/mutations';
import { useGroup, useRuleVersions } from '@/features/ajo/queries';
import { useAjoCan } from '@/features/ajo/useAjoCan';

/** Rules are never edited: a change is a new version that takes effect after a notice period, and a member is bound only once they accept it. */
export default function CircleRulesScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoWrite();
  const { manage } = useAjoCan();
  const versions = useRuleVersions(groupId);
  // Only a rotating pot has a Circle board, so only a rotating pot is asked whether its members may see each other.
  const detail = useGroup(groupId).data;
  const rotating = detail?.model !== 'COLLECTOR_THRIFT';
  // Before the circle starts nobody is paying under the rules yet, so a change can take effect straight away if the admin chooses.
  const canApplyNow = detail?.status === 'DRAFT' || detail?.status === 'OPEN';
  const [applyNow, setApplyNow] = useState(false);
  const publish = useAjoAction((input: { rules: Parameters<typeof ajoApi.publishRules>[1]; immediate: boolean }) => ajoApi.publishRules(groupId, input.rules, { immediate: input.immediate }));
  const { control, getValues, reset } = useForm<RulesFormValues>({ defaultValues: DEFAULT_RULES });
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const list = [...(versions.data?.versions ?? [])].sort((x, y) => y.version - x.version);
  const acceptance = versions.data?.acceptance;

  const submit = async () => {
    const built = rulesFormToInput(getValues(), rotating);
    if ('error' in built) {
      setProblem(built.error);
      return;
    }
    setProblem(null);
    try {
      await publish.mutateAsync({ rules: built.input, immediate: canApplyNow && applyNow });
      toast.success('A new version of the rules was published. Members accept it before it binds them.');
      setEditing(false);
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not publish the rules.');
    }
  };

  return (
    <AjoScreen title="Rules" access={['AJO_MANAGE']} keyboard refreshing={versions.isRefetching} onRefresh={() => void versions.refetch()}>
      <Text variant="body" tone="secondary">
        Changing the rules makes a new version. It takes effect after a notice period, and each member is only bound by the version they accepted.
      </Text>

      {acceptance && acceptance.latestVersion !== null && acceptance.total > 0 ? (
        <Text variant="body" testID="ajo-acceptance">
          {`${acceptance.accepted} of ${acceptance.total} ${acceptance.total === 1 ? 'person has' : 'people have'} accepted version ${acceptance.latestVersion}.`}
          {acceptance.accepted < acceptance.total ? ' The rest keep their old terms until they accept.' : ''}
        </Text>
      ) : null}

      {manage && canWrite && !editing ? (
        <Button
          onPress={() => {
            const current = list[0];
            reset(current ? rulesToForm(current) : DEFAULT_RULES);
            setProblem(null);
            setEditing(true);
          }}
          testID="ajo-rules-new-version"
        >
          Publish a new version
        </Button>
      ) : null}

      {editing ? (
        <Card testID="ajo-rules-editor">
          <View className="gap-4">
            <RulesFields control={control} rotating={rotating} />
            {canApplyNow ? (
              <View className="flex-row items-start gap-3 rounded-md bg-surface-sunken p-3">
                <Switch value={applyNow} onValueChange={setApplyNow} accessibilityLabel="Take effect now" testID="ajo-rules-apply-now" />
                <View className="flex-1">
                  <Text variant="body-strong">Take effect now, without the usual 7 days’ notice</Text>
                  <Text variant="caption" tone="secondary">
                    Only possible before the circle starts, while nobody is paying under the rules. Members are told. Leave it off to give them the notice period.
                  </Text>
                </View>
              </View>
            ) : null}
            {problem ? (
              <Text variant="body" tone="danger">
                {problem}
              </Text>
            ) : null}
            <View className="flex-row gap-3">
              <Button variant="secondary" fullWidth onPress={() => setEditing(false)}>
                Cancel
              </Button>
              <Button fullWidth loading={publish.isPending} onPress={() => void submit()} testID="ajo-rules-publish">
                Publish
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      {versions.isPending ? (
        <AjoLoading />
      ) : versions.isError ? (
        <ErrorState error={versions.error} onRetry={() => versions.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={FileText} title="No rules have been set yet." />
      ) : (
        <View className="gap-3">
          {list.map((v) => (
            <Card key={v.id} testID={`ajo-rule-version-${v.version}`}>
              <View className="gap-2">
                <Text variant="body-strong">
                  Version {v.version} <Text variant="caption" tone="tertiary">· from {formatDay(v.effectiveFrom)}</Text>
                </Text>
                {v.summary.map((line) => (
                  <Text key={line} variant="body" tone="secondary">
                    • {line}
                  </Text>
                ))}
              </View>
            </Card>
          ))}
        </View>
      )}
    </AjoScreen>
  );
}
