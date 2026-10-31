import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { toast } from 'sonner-native';

import { ajoApi } from '@/api/endpoints/ajo';
import { ApiError } from '@/api/errors';
import { FileAttachField } from '@/components/forms/FileAttachField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { InstallmentDTO } from '@/types/api/ajo';
import { formatDay, formatKobo } from '../format';
import { useAjoAction } from '../mutations';
import { disputeSchema, PROOF_TYPES, type DisputeValues } from '../schemas';

export type DisputeSheetHandle = { open: (installment: InstallmentDTO) => void };

/** THM8: "I paid" about one instalment, with a written claim and optional evidence. An officer decides; nothing is paid by raising it. */
export const DisputeSheet = forwardRef<DisputeSheetHandle, { membershipId: number }>(function DisputeSheet({ membershipId }, ref) {
  const sheet = useRef<BottomSheetModal>(null);
  const [installment, setInstallment] = useState<InstallmentDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      open: (item) => {
        setInstallment(item);
        setProblem(null);
        sheet.current?.present();
      },
    }),
    [],
  );
  const { control, handleSubmit, reset } = useForm<DisputeValues>({ resolver: zodResolver(disputeSchema), defaultValues: { claim: '', evidence: null }, mode: 'onTouched' });
  const raise = useAjoAction((input: { installmentId: number; claim: string; evidence?: DisputeValues['evidence'] }) => ajoApi.raiseDispute(membershipId, input));

  const submit = handleSubmit(async (values) => {
    if (!installment) return;
    setProblem(null);
    try {
      await raise.mutateAsync({ installmentId: installment.id, claim: values.claim.trim(), evidence: values.evidence ?? null });
      toast.success('Your claim was sent. An officer will look at it and decide.');
      sheet.current?.dismiss();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'Could not send your claim.');
    }
  });

  return (
    <BottomSheet
      ref={sheet}
      title="I already paid this"
      snapPoints={['90%']}
      onDismiss={() => {
        reset();
        setProblem(null);
      }}
    >
      {installment ? (
        <View className="gap-4 pb-6">
          <Text variant="body" tone="secondary">
            The payment due on {formatDay(installment.dueDate)} ({formatKobo(installment.amountKobo)}) is showing as not paid. Tell the officers what happened. While they look, you will not be charged a late fee for it.
          </Text>
          <TextField control={control} name="claim" label="What happened" placeholder="I gave ₦5,000.00 to the collector on Monday morning at the market." multiline testID="ajo-dispute-claim" />
          <FileAttachField control={control} name="evidence" label="Evidence (optional)" helper="A photo of the slip or a screenshot. JPG, PNG, WebP or PDF, up to 5 MB." allowedTypes={PROOF_TYPES} testID="ajo-dispute-evidence" />
          {problem ? (
            <Text variant="body" tone="danger">
              {problem}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button variant="secondary" fullWidth onPress={() => sheet.current?.dismiss()}>
              Cancel
            </Button>
            <Button fullWidth loading={raise.isPending} onPress={() => void submit()} testID="ajo-dispute-send">
              Send my claim
            </Button>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
});
