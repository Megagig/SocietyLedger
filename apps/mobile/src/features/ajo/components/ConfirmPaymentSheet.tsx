import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import type { QueueContributionDTO } from '@/types/api/ajo';
import { formatKobo } from '../format';
import { useAjoAction } from '../mutations';
import { confirmPaymentSchema, MIN_SELF_NOTE, type ConfirmPaymentValues } from '../schemas';

export type ConfirmPaymentSheetHandle = { open: (item: QueueContributionDTO, name: string) => void };

type Needs = { duplicate: boolean; self: boolean; message: string };

/**
 * Confirming a payment is where money becomes real, so the two situations that need a second look are asked about in words: a proof
 * that looks like one already used, and confirming a payment you recorded yourself (only allowed when you are the only person who can).
 */
export const ConfirmPaymentSheet = forwardRef<ConfirmPaymentSheetHandle>(function ConfirmPaymentSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [item, setItem] = useState<QueueContributionDTO | null>(null);
  const [name, setName] = useState('');
  const [needs, setNeeds] = useState<Needs | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<ConfirmPaymentValues>({ resolver: zodResolver(confirmPaymentSchema), defaultValues: { ack: false, own: false, note: '' } });
  const ack = useWatch({ control, name: 'ack' });
  const own = useWatch({ control, name: 'own' });
  const note = useWatch({ control, name: 'note' }) ?? '';
  const confirm = useAjoAction((input: { id: number; body: Parameters<typeof ajoApi.confirm>[1] }) => ajoApi.confirm(input.id, input.body));

  useImperativeHandle(
    ref,
    () => ({
      open: (next, who) => {
        setItem(next);
        setName(who);
        sheet.current?.present();
      },
    }),
    [],
  );

  const blocked = (needs?.duplicate && !ack) || (needs?.self && (!own || note.trim().length < MIN_SELF_NOTE));

  const submit = handleSubmit(async (values) => {
    if (!item) return;
    setProblem(null);
    try {
      await confirm.mutateAsync({ id: item.id, body: { acknowledgeDuplicate: values.ack || undefined, confirmOwn: values.own || undefined, note: (values.note ?? '').trim() || undefined } });
      toast.success('Confirmed. A receipt goes to the member.');
      sheet.current?.dismiss();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DUPLICATE_ACK_REQUIRED') setNeeds({ duplicate: true, self: needs?.self ?? false, message: error.message });
      else if (error instanceof ApiError && error.code === 'SELF_CONFIRM_NEEDS_NOTE') setNeeds({ duplicate: needs?.duplicate ?? false, self: true, message: error.message });
      else setProblem(error instanceof ApiError ? error.message : 'Could not confirm the payment.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Confirm this payment"
      snapPoints={['90%']}
      onDismiss={() => {
        reset();
        setNeeds(null);
        setProblem(null);
      }}
    >
      {item ? (
        <View className="gap-4 pb-6">
          <Text variant="body" tone="secondary">
            Confirm only after you have seen {formatKobo(item.amountKobo)} from {name} in the circle&apos;s bank statement. Once confirmed it counts towards what they owe.
          </Text>
          {needs?.duplicate ? (
            <View className="gap-2 rounded-md bg-warning-soft p-3">
              <Text variant="caption" tone="warning">
                {needs.message}
              </Text>
              <Checkbox control={control} name="ack" label="I checked, and this is a different payment." testID="ajo-confirm-ack" />
            </View>
          ) : null}
          {needs?.self ? (
            <View className="gap-2 rounded-md bg-warning-soft p-3">
              <Text variant="caption" tone="warning">
                {needs.message}
              </Text>
              <Checkbox control={control} name="own" label="I am the only person who can confirm here, and I checked it against the statement." testID="ajo-confirm-own" />
              <TextField control={control} name="note" label="How you checked" multiline testID="ajo-confirm-note" />
            </View>
          ) : null}
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={confirm.isPending} disabled={!!blocked} onPress={() => void submit()} testID="ajo-confirm-submit">
              Confirm payment
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
