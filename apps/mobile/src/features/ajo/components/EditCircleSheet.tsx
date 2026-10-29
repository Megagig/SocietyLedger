import { zodResolver } from '@hookform/resolvers/zod';
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
import type { GroupDetailDTO } from '@/types/api/ajo';
import { koboToNaira, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { editCircleSchema, type EditCircleValues } from '../schemas';

export type EditCircleSheetHandle = { open: (group: GroupDetailDTO) => void };

/** Edit a draft or open circle's settings. A running circle's money fields are locked by the server. */
export const EditCircleSheet = forwardRef<EditCircleSheetHandle, { groupId: number }>(function EditCircleSheet({ groupId }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<EditCircleValues>({
    resolver: zodResolver(editCircleSchema),
    defaultValues: { name: '', contribution: '', maxParticipants: '1', cutoffTime: '', requirePhoneConfirm: false },
    mode: 'onTouched',
  });
  const save = useAjoAction((body: Parameters<typeof ajoApi.updateGroup>[1]) => ajoApi.updateGroup(groupId, body));
  // Start from the circle's current values each time the editor is opened.
  useImperativeHandle(
    ref,
    () => ({
      open: (group) => {
        reset({ name: group.name, contribution: koboToNaira(group.contributionKobo), maxParticipants: String(group.maxParticipants), cutoffTime: group.cutoffTime, requirePhoneConfirm: group.requirePhoneConfirm });
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [reset],
  );

  const submit = handleSubmit(async (values) => {
    setProblem(null);
    try {
      await save.mutateAsync({
        name: values.name.trim(),
        contributionKobo: nairaToKoboString(values.contribution) ?? undefined,
        maxParticipants: Number(values.maxParticipants),
        cutoffTime: values.cutoffTime.trim(),
        requirePhoneConfirm: values.requirePhoneConfirm,
      });
      toast.success('Settings saved.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not save the settings.');
    }
  });

  return (
    <BottomSheet ref={sheet} title="Edit settings" snapPoints={['90%']} onDismiss={() => setProblem(null)}>
      <View className="gap-4 pb-6">
        <TextField control={control} name="name" label="Circle name" maxLength={80} testID="ajo-edit-name" />
        <TextField control={control} name="contribution" label="Each person pays (₦)" keyboardType="decimal-pad" testID="ajo-edit-contribution" />
        <TextField control={control} name="maxParticipants" label="Most people in the circle" keyboardType="number-pad" maxLength={4} testID="ajo-edit-max" />
        <TextField control={control} name="cutoffTime" label="Cut-off time each day" placeholder="18:00" testID="ajo-edit-cutoff" />
        <Checkbox control={control} name="requirePhoneConfirm" label="Members must confirm their phone number" />
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={save.isPending} onPress={() => void submit()} testID="ajo-edit-save">
            Save
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
