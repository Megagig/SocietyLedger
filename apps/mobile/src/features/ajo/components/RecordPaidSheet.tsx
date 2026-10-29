import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { Checkbox } from '@/components/forms/Checkbox';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { PayoutDTO } from '@/types/api/ajo';
import { formatKobo } from '../format';
import { useAjoAction } from '../mutations';
import { MIN_SELF_NOTE, PROOF_TYPES, recordPaidSchema, type RecordPaidValues } from '../schemas';

export type RecordPaidSheetHandle = { open: (payout: PayoutDTO) => void };

/** Recording that the circle has paid: the bank reference, and the slip if there is one. SocietyLedger sends no money. */
export const RecordPaidSheet = forwardRef<RecordPaidSheetHandle>(function RecordPaidSheet(_props, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [payout, setPayout] = useState<PayoutDTO | null>(null);
  const [needsOwn, setNeedsOwn] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<RecordPaidValues>({ resolver: zodResolver(recordPaidSchema), defaultValues: { reference: '', proof: null, own: false, note: '' } });
  const own = useWatch({ control, name: 'own' });
  const note = useWatch({ control, name: 'note' }) ?? '';
  const record = useAjoAction((input: { id: number; body: Parameters<typeof ajoApi.recordPayoutPaid>[1] }) => ajoApi.recordPayoutPaid(input.id, input.body));

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setPayout(next);
        sheet.current?.present();
      },
    }),
    [],
  );

  const submit = handleSubmit(async (values) => {
    if (!payout) return;
    setProblem(null);
    try {
      await record.mutateAsync({
        id: payout.id,
        body: { reference: values.reference.trim(), proof: values.proof ? { uri: values.proof.uri, name: values.proof.name, type: values.proof.type } : null, note: (values.note ?? '').trim() || undefined, confirmOwn: values.own || undefined },
      });
      toast.success('Recorded as paid.');
      sheet.current?.dismiss();
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'SELF_APPROVAL_NEEDS_CONFIRMATION' || error.code === 'SELF_CONFIRM_NEEDS_NOTE')) setNeedsOwn(error.message);
      else setProblem(error instanceof ApiError ? error.message : 'Could not record the payout.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="Record that this was paid"
      snapPoints={['92%']}
      onDismiss={() => {
        reset();
        setNeedsOwn(null);
        setProblem(null);
      }}
    >
      {payout ? (
        <View className="gap-4 pb-6">
          <Text variant="body" tone="secondary">
            Record this only after you have sent {formatKobo(payout.netKobo)} to {payout.recipient} ({payout.account.bankName} {payout.account.masked}) from the circle&apos;s account.
          </Text>
          <TextField control={control} name="reference" label="Bank reference" maxLength={120} testID="ajo-paid-reference" />
          <FileAttachField control={control} name="proof" label="Slip (optional)" allowedTypes={PROOF_TYPES} testID="ajo-paid-proof" />
          {needsOwn ? (
            <View className="gap-2 rounded-md bg-warning-soft p-3">
              <Text variant="caption" tone="warning">
                {needsOwn}
              </Text>
              <Checkbox control={control} name="own" label="I am the only person who can record this, and I paid it myself." testID="ajo-paid-own" />
              <TextField control={control} name="note" label="Note" multiline />
            </View>
          ) : null}
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth disabled={record.isPending} onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={record.isPending} disabled={needsOwn !== null && (!own || note.trim().length < MIN_SELF_NOTE)} onPress={() => void submit()} testID="ajo-paid-submit">
              Record as paid
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
