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
  reason: z.string().trim().min(3, 'Say why — for example, "not in our statement"').max(500, 'Keep the reason under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

export type RejectTransferSheetProps = {
  loading: boolean;
  onSubmit: (reason: string) => void;
  onDismiss: () => void;
};

/** Reject a recorded transfer. The reason is required and is kept on the transfer's notes. */
export const RejectTransferSheet = forwardRef<BottomSheetModal, RejectTransferSheetProps>(function RejectTransferSheet({ loading, onSubmit, onDismiss }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' }, mode: 'onTouched' });

  return (
    <BottomSheet
      ref={localRef}
      title="Reject this transfer?"
      snapPoints={['65%']}
      onDismiss={() => {
        reset();
        onDismiss();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          Use this when the transfer isn’t genuine or isn’t in your bank statement. It can’t be undone.
        </Text>
        <TextField control={control} name="reason" label="Reason" placeholder="Why are you rejecting this transfer?" multiline testID="reject-transfer-reason" />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { handleSubmit((values) => onSubmit(values.reason.trim()))(); }} testID="reject-transfer-confirm">
            Reject transfer
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
