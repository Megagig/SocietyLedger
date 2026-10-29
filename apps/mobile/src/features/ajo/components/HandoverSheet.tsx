import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { CollectorDayDTO } from '@/types/api/ajo';
import { formatKobo, koboPositive, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { handoverSchema, type HandoverValues } from '../schemas';

export type HandoverSheetHandle = { open: () => void };

/** THC3: record how much cash the collector is handing over at the end of the day. The difference, if any, is shown to the officer who counts it. */
export const HandoverSheet = forwardRef<HandoverSheetHandle, { groupId: number; day: CollectorDayDTO | undefined; online: boolean }>(function HandoverSheet({ groupId, day, online }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );
  const { control, handleSubmit, reset } = useForm<HandoverValues>({ resolver: zodResolver(handoverSchema), defaultValues: { amount: '', note: '' }, mode: 'onTouched' });
  const handOver = useAjoAction((input: { handedOverKobo: string; note?: string }) => ajoApi.handOver(groupId, input));

  const submit = handleSubmit(async (values) => {
    if (!online) {
      setProblem('You are offline. Connect to the internet and try again. Nothing is saved for later.');
      return;
    }
    setProblem(null);
    try {
      await handOver.mutateAsync({ handedOverKobo: nairaToKoboString(values.amount) ?? '0', note: values.note?.trim() || undefined });
      toast.success('Your handover was recorded. An officer will count it.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record the handover.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Hand over cash"
      snapPoints={['75%']}
      onDismiss={() => {
        reset();
        setProblem(null);
      }}
    >
      <View className="gap-4 pb-6">
        {day ? (
          <Text variant="body" tone="secondary">
            You collected {formatKobo(day.collectedKobo)}
            {koboPositive(day.carriedOverKobo) ? ` and carried over ${formatKobo(day.carriedOverKobo)}` : ''}.
          </Text>
        ) : null}
        <AmountField control={control} name="amount" label="Cash you are handing over" helper="Enter 0 if you have none." testID="ajo-handover-amount" />
        <TextField control={control} name="note" label="Note (optional)" testID="ajo-handover-note" />
        {problem ? (
          <Text variant="body" tone="danger" testID="ajo-handover-problem">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={handOver.isPending} disabled={!online} onPress={() => void submit()} testID="ajo-handover-record">
            Record handover
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
