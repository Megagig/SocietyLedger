import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { AmountField } from '@/components/forms/AmountField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { AssignedContributorDTO } from '@/types/api/ajo';
import { formatKobo, nairaToKoboString, newIdempotencyKey } from '../format';
import { useAjoAction } from '../mutations';
import { cashAmountSchema, type CashAmountValues } from '../schemas';

export type RecordCashSheetHandle = { open: (person: AssignedContributorDTO) => void };

/** THC2: write down cash taken from one person. It is marked "cash received, awaiting reconciliation" until the handover is counted. */
export const RecordCashSheet = forwardRef<RecordCashSheetHandle, { groupId: number; online: boolean }>(function RecordCashSheet({ groupId, online }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [person, setPerson] = useState<AssignedContributorDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // One key per attempt, so a double tap or a retry records it once; a recorded amount gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        setPerson(next);
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );
  const { control, handleSubmit, reset } = useForm<CashAmountValues>({ resolver: zodResolver(cashAmountSchema), defaultValues: { amount: '' }, mode: 'onTouched' });
  const record = useAjoAction((input: { membershipId: number; amountKobo: string; idempotencyKey: string }) => ajoApi.recordCash(groupId, input));

  const submit = handleSubmit(async (values) => {
    if (!person) return;
    if (!online) {
      setProblem('You are offline. Connect to the internet and try again. Nothing is saved for later.');
      return;
    }
    const amountKobo = nairaToKoboString(values.amount);
    if (!amountKobo) return;
    setProblem(null);
    try {
      await record.mutateAsync({ membershipId: person.membershipId, amountKobo, idempotencyKey });
      setIdempotencyKey(newIdempotencyKey());
      toast.success(`${formatKobo(amountKobo)} from ${person.name} was recorded.`);
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record the cash.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title={`Cash from ${person?.name ?? ''}`}
      snapPoints={['65%']}
      onDismiss={() => {
        reset();
        setProblem(null);
      }}
    >
      <View className="gap-4 pb-6">
        <AmountField control={control} name="amount" label="Amount received" testID="ajo-cash-amount" />
        <Text variant="caption" tone="tertiary">
          It stays &quot;cash received, awaiting reconciliation&quot; until you hand the cash over and an officer counts it.
        </Text>
        {problem ? (
          <Text variant="body" tone="danger" testID="ajo-cash-problem">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={record.isPending} disabled={!online} onPress={() => void submit()} testID="ajo-cash-record">
            Record cash
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
