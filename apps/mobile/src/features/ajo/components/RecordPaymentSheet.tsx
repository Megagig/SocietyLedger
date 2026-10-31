import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { DateField } from '@/components/forms/DateField';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { isoToLocalDay, newIdempotencyKey, nairaToKoboString } from '../format';
import { useAjoAction } from '../mutations';
import { PROOF_TYPES } from '../schemas';
import { useGroups, usePeople } from '../queries';

export type RecordPaymentSheetHandle = { open: (groupId?: number) => void };

type Values = { groupId: string; membershipId: string; amount: string; paidOn: string; reference: string; note: string; proof: { uri: string; name: string; type: string } | null };
const EMPTY: Values = { groupId: '', membershipId: '', amount: '', paidOn: new Date().toISOString(), reference: '', note: '', proof: null };

/**
 * An officer records a payment a member made but never reported. Someone who can confirm sees it confirmed in the same step (they have
 * seen it at the bank): the bank reference and how they checked it are required, and it is marked as recorded by an officer. Someone who
 * can only manage records it as reported, and a person who can confirm finishes it.
 */
export const RecordPaymentSheet = forwardRef<RecordPaymentSheetHandle, { canConfirm: boolean }>(function RecordPaymentSheet({ canConfirm }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);
  const { control, getValues, reset } = useForm<Values>({ defaultValues: EMPTY });
  const groupId = useWatch({ control, name: 'groupId' });
  const groups = useGroups();
  const people = usePeople(Number(groupId) || 0);
  const running = (groups.data ?? []).filter((g) => g.status === 'ACTIVE');
  const circleOptions = useMemo(() => running.map((g) => ({ label: g.name, value: String(g.id) })), [running]);
  const personOptions = (people.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => ({ label: p.name, value: String(p.membershipId) }));

  useImperativeHandle(
    ref,
    () => ({
      open: (id) => {
        reset({ ...EMPTY, paidOn: new Date().toISOString(), groupId: id ? String(id) : '' });
        setProblem(null);
        setKey(newIdempotencyKey());
        sheet.current?.present();
      },
    }),
    [reset],
  );

  const record = useAjoAction<{ groupId: number; body: Parameters<typeof ajoApi.recordReceived>[1] }, unknown>((input) => (canConfirm ? ajoApi.recordReceived(input.groupId, input.body) : ajoApi.reportTransfer(input.groupId, { ...input.body, bankReference: input.body.bankReference || undefined })));

  const submit = async () => {
    const v = getValues();
    const kobo = nairaToKoboString(v.amount);
    if (!v.groupId) return setProblem('Choose the circle.');
    if (!v.membershipId) return setProblem('Choose the person.');
    if (!kobo) return setProblem('Enter the amount, in naira.');
    if (canConfirm && v.reference.trim().length < 3) return setProblem('Give the bank reference, so the payment can be found on the statement.');
    if (canConfirm && v.note.trim().length < 5) return setProblem('Say how you checked it, for example “seen in the 14 Nov statement”.');
    if (!canConfirm && !v.proof && v.reference.trim().length < 3) return setProblem('Attach the slip, or give the bank reference.');
    setProblem(null);
    try {
      await record.mutateAsync({
        groupId: Number(v.groupId),
        body: { membershipId: Number(v.membershipId), amountKobo: kobo, bankReference: v.reference.trim(), note: v.note.trim(), paidOn: isoToLocalDay(v.paidOn), proof: v.proof, idempotencyKey: key },
      });
      toast.success(canConfirm ? 'Recorded and confirmed. The member has been told.' : 'Recorded. A person who can confirm will finish it.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not record the payment.');
    }
  };

  return (
    <BottomSheet ref={sheet} title="Record a payment" snapPoints={['92%']} onDismiss={() => setProblem(null)}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          For a member who paid but did not report it.{' '}
          {canConfirm ? 'Record it only after you have seen it at the bank. It is confirmed in the same step, and the member is told it was recorded by an officer.' : 'It is recorded as reported, and a person who can confirm checks it against the bank statement.'}
        </Text>
        <SelectSheet control={control} name="groupId" label="Circle" options={circleOptions} placeholder="Choose a circle" testID="ajo-record-circle" />
        <SelectSheet control={control} name="membershipId" label="Person" options={personOptions} placeholder={groupId ? 'Choose a person' : 'Choose a circle first'} testID="ajo-record-person" />
        <TextField control={control} name="amount" label="Amount (₦)" keyboardType="decimal-pad" testID="ajo-record-amount" />
        <DateField control={control} name="paidOn" label="Date paid" maximumDate={new Date()} testID="ajo-record-date" />
        <TextField control={control} name="reference" label={canConfirm ? 'Bank reference' : 'Bank reference (or attach the slip)'} helper="As it appears on the circle's bank statement." testID="ajo-record-reference" />
        {canConfirm ? <TextField control={control} name="note" label="How you checked it" helper="For example “seen in the 14 Nov statement”. The admin can see this." multiline testID="ajo-record-note" /> : null}
        <FileAttachField control={control} name="proof" label="Slip or receipt (optional)" helper="JPG, PNG, WebP or PDF, up to 5 MB." allowedTypes={PROOF_TYPES} testID="ajo-record-proof" />
        {problem ? (
          <Text variant="body" tone="danger">
            {problem}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
            Cancel
          </Button>
          <Button fullWidth loading={record.isPending} onPress={() => void submit()} testID="ajo-record-save">
            {canConfirm ? 'Record and confirm' : 'Record'}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
