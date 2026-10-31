import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/forms/TextField';
import { useAjoAction } from '../mutations';

export type CaseResponseSheetHandle = { open: (caseId: number) => void };

/** Give your own side of a case the officers opened about your unpaid rounds. The officers read it on the file. */
export const CaseResponseSheet = forwardRef<CaseResponseSheetHandle>(function CaseResponseSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [caseId, setCaseId] = useState<number | null>(null);
  const { control, getValues, reset } = useForm<{ note: string }>({ defaultValues: { note: '' } });
  const [problem, setProblem] = useState<string | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      open: (id) => {
        setCaseId(id);
        reset({ note: '' });
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [reset],
  );
  const send = useAjoAction((input: { caseId: number; note: string }) => ajoApi.respondToCase(input.caseId, input.note));

  const submit = async () => {
    if (caseId === null) return;
    const note = getValues('note');
    if (note.trim().length < 3) return setProblem('Write a few words about what happened.');
    setProblem(null);
    try {
      await send.mutateAsync({ caseId, note: note.trim() });
      toast.success('Your explanation was added to the file.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not add your explanation.');
    }
  };

  return (
    <BottomSheet ref={sheet} title="Your side of this" snapPoints={['70%']} onDismiss={() => setProblem(null)}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          Tell the officers what happened. They read this on the file.
        </Text>
        <TextField control={control} name="note" label="What happened" multiline maxLength={1000} testID="ajo-case-response" />
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={send.isPending} onPress={() => void submit()} testID="ajo-case-response-send">
            Send
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
