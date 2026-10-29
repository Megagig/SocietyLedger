import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollText } from 'lucide-react-native';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { TextField } from '@/components/forms/TextField';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useAjoWrite } from '@/features/ajo/components/AjoGate';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { formatDay } from '@/features/ajo/format';
import { useAjoAction } from '@/features/ajo/mutations';
import { AJO_MEMBER_ACCESS, useRulesToAccept } from '@/features/ajo/queries';
import { rulesAcceptSchema } from '@/features/ajo/schemas';

type Values = { read: boolean; note?: string };

/** THM4: read the circle's current rules in plain words and accept them. A rule change only binds you once you accept it. */
export default function RulesScreen() {
  const params = useLocalSearchParams<{ membershipId?: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const router = useRouter();
  const { canWrite } = useAjoWrite();
  const rules = useRulesToAccept(membershipId);
  const accept = useAjoAction((body: { ruleVersionId: number; note?: string }) => ajoApi.acceptRules(membershipId, body));
  const { control, handleSubmit } = useForm<Values>({ resolver: zodResolver(rulesAcceptSchema), defaultValues: { read: false, note: '' }, mode: 'onTouched' });
  const [problem, setProblem] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const back = () => router.replace(`/(app)/(tabs)/money/thrift/${membershipId}` as never);
  const current = rules.data;

  const submit = handleSubmit(async (values) => {
    if (!current) return;
    setProblem(null);
    try {
      await accept.mutateAsync({ ruleVersionId: current.ruleVersionId, note: values.note?.trim() || undefined });
      setAccepted(true);
      toast.success('Rules accepted.');
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record your acceptance.');
    }
  });

  return (
    <AjoScreen title="Circle rules" access={AJO_MEMBER_ACCESS} keyboard>
      {rules.isPending ? (
        <AjoLoading rows={2} />
      ) : rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : !current ? (
        <EmptyState icon={ScrollText} title="This circle has no rules to accept yet." actionLabel="Back" onAction={back} />
      ) : (
        <>
          <Text variant="caption" tone="secondary">
            Version {current.version}, in force from {formatDay(current.effectiveFrom)}.
          </Text>
          <Card testID="ajo-rules-summary">
            <View className="gap-2">
              {current.summary.map((line) => (
                <Text key={line} variant="body">
                  • {line}
                </Text>
              ))}
            </View>
          </Card>

          {accepted ? (
            <View className="rounded-lg bg-success-soft p-4" accessibilityRole="alert" testID="ajo-rules-accepted">
              <Text variant="body" tone="success">
                You accepted version {current.version}. It is on your record.
              </Text>
            </View>
          ) : canWrite ? (
            <View className="gap-4">
              <Checkbox control={control} name="read" label="I have read these rules and I agree to them." testID="ajo-rules-read" />
              <TextField control={control} name="note" label="Note (optional)" multiline maxLength={300} />
              {problem ? (
                <Text variant="body" tone="danger">
                  {problem}
                </Text>
              ) : null}
              <Button loading={accept.isPending} onPress={() => void submit()} testID="ajo-rules-accept">
                Accept the rules
              </Button>
            </View>
          ) : (
            <Text variant="body" tone="secondary">
              Accepting is switched off while the add-on is expired.
            </Text>
          )}
        </>
      )}
    </AjoScreen>
  );
}
