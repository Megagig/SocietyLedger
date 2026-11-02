import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { WithdrawalApprovePayload } from '@/types/api/coopEnhanced';

type Values = { payoutMethod: WithdrawalApprovePayload['payoutMethod']; payoutReference: string; comment: string };

const METHODS = [
  { label: 'Bank transfer', value: 'BANK_TRANSFER' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Cheque', value: 'CHEQUE' },
  { label: 'Other', value: 'OTHER' },
];

/** Final approval of a withdrawal: how it was paid out, and the officer's reference. The balance moves when this is confirmed. */
export const PayoutSheet = forwardRef<BottomSheetModal, { summary: string; loading: boolean; onConfirm: (payload: WithdrawalApprovePayload) => void }>(function PayoutSheet(
  { summary, loading, onConfirm },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<Values>({ defaultValues: { payoutMethod: 'BANK_TRANSFER', payoutReference: '', comment: '' } });

  return (
    <BottomSheet ref={localRef} title="Approve and record the payout" snapPoints={['75%']} onDismiss={() => reset()}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {summary}
        </Text>
        <SelectSheet control={control} name="payoutMethod" label="How was it paid out?" options={METHODS} />
        <TextField control={control} name="payoutReference" label="Payout reference (optional)" placeholder="Transfer reference or cheque number" />
        <TextField control={control} name="comment" label="Comment (optional)" multiline />
        <Text variant="caption" tone="secondary">
          The balance moves now. The balance, any savings held against a loan, and the monthly limit are checked once more first.
        </Text>
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Not now
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              void handleSubmit((v) => onConfirm({ payoutMethod: v.payoutMethod, payoutReference: v.payoutReference.trim() || undefined, comment: v.comment.trim() || undefined }))();
            }}
            testID="payout-confirm"
          >
            Approve
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
