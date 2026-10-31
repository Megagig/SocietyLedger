import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { RosterPersonDTO } from '@/types/api/ajo';
import { formatDay } from '../format';
import { useAjoAction } from '../mutations';
import { useRuleVersions } from '../queries';

export type RecordRulesAcceptanceSheetHandle = { open: (person: RosterPersonDTO) => void };

type Values = { read: boolean; note: string };

/**
 * An officer records that a person accepted the circle's rules in person: someone who is not using the app, or who agreed at a meeting. It
 * records the version in force now, who recorded it and the note about how it was given, and the roster then shows it as accepted by an
 * officer. The officer must say they read the rules to the person and the person agreed; the note is required.
 */
export const RecordRulesAcceptanceSheet = forwardRef<RecordRulesAcceptanceSheetHandle, { groupId: number }>(function RecordRulesAcceptanceSheet({ groupId }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [person, setPerson] = useState<RosterPersonDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const versions = useRuleVersions(groupId);
  const { control, getValues, reset } = useForm<Values>({ defaultValues: { read: false, note: '' } });
  const accept = useAjoAction((input: { membershipId: number; ruleVersionId: number; note: string }) => ajoApi.acceptRules(input.membershipId, { ruleVersionId: input.ruleVersionId, note: input.note }));

  useImperativeHandle(
    ref,
    () => ({
      open: (p) => {
        setPerson(p);
        reset({ read: false, note: '' });
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [reset],
  );

  // The version in force now is the one a person joins under; a later one that has not started yet is accepted when it does.
  const inForce = [...(versions.data?.versions ?? [])].filter((v) => new Date(v.effectiveFrom).getTime() <= Date.now()).sort((a, b) => b.version - a.version)[0];

  const submit = async () => {
    if (!person || !inForce) return;
    const v = getValues();
    if (!v.read) return setProblem('Tick the box to say you read the rules to them and they agreed.');
    if (v.note.trim().length < 5) return setProblem('Say how it was given, for example “read aloud at the 14 Nov meeting”.');
    setProblem(null);
    try {
      await accept.mutateAsync({ membershipId: person.membershipId, ruleVersionId: inForce.id, note: v.note.trim() });
      toast.success(`${person.name}'s acceptance was recorded.`);
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record the acceptance.');
    }
  };

  return (
    <BottomSheet ref={sheet} title="Record rules acceptance" snapPoints={['90%']} onDismiss={() => setProblem(null)}>
      {person ? (
        <View className="gap-4 pb-6">
          <Text variant="body" tone="secondary">
            Use this when {person.name} accepted the circle’s rules in person, for example at a meeting, and is not accepting them in the app. It is recorded as accepted by an officer, with your name and the note below.
          </Text>
          {inForce ? (
            <View className="gap-1 rounded-md bg-surface-sunken p-3">
              <Text variant="body-strong">
                Version {inForce.version}, in force from {formatDay(inForce.effectiveFrom)}
              </Text>
              {inForce.summary.map((line) => (
                <Text key={line} variant="caption" tone="secondary">
                  • {line}
                </Text>
              ))}
            </View>
          ) : (
            <Text variant="caption" tone="tertiary">
              Loading the rules…
            </Text>
          )}
          <Checkbox control={control} name="read" label={`I read these rules to ${person.name} and they agreed to them.`} testID="ajo-rules-read" />
          <TextField control={control} name="note" label="How it was given" helper="For example “read aloud at the 14 Nov meeting”. It stays on the record." multiline maxLength={300} testID="ajo-rules-note" />
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={accept.isPending} disabled={!inForce} onPress={() => void submit()} testID="ajo-rules-record">
              Record acceptance
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
