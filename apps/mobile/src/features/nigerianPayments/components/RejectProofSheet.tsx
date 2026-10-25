import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { z } from 'zod';

import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

const schema = z.object({
  reason: z.string().trim().min(3, 'Tell the member why — for example, how much you actually received').max(500, 'Keep the reason under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

export type RejectProofSheetProps = {
  memberName: string;
  loading: boolean;
  onSubmit: (reason: string) => void;
  onDismiss: () => void;
};

/** Reject a payment proof. The reason is required — the member gets it in a notification and can submit again. */
export const RejectProofSheet = forwardRef<BottomSheetModal, RejectProofSheetProps>(function RejectProofSheet({ memberName, loading, onSubmit, onDismiss }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' }, mode: 'onTouched' });

  return (
    <BottomSheet
      ref={localRef}
      title="Reject this proof?"
      snapPoints={['65%']}
      onDismiss={() => {
        reset();
        onDismiss();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {`Nothing is recorded. ${memberName} is told why and can submit it again. You can't undo this.`}
        </Text>
        <TextField control={control} name="reason" label="Reason" placeholder="Why can't you verify this payment?" multiline testID="reject-reason" />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { handleSubmit((values) => onSubmit(values.reason.trim()))(); }} testID="reject-confirm">
            Reject proof
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
