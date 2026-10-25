import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

type Props = {
  voucherNumber: string;
  loading: boolean;
  /** Shown under the password when the server said it was wrong. */
  error?: string | null;
  onConfirm: (values: { reason: string; password: string }) => void;
  onDismiss?: () => void;
};

/**
 * Voiding cancels an expense that is already in the books: a reversing entry is posted and the voucher stays, marked voided. It asks
 * why, and for the officer's password. Both are cleared whenever the sheet closes.
 */
export const VoidExpenseSheet = forwardRef<BottomSheetModal, Props>(function VoidExpenseSheet({ voucherNumber, loading, error, onConfirm, onDismiss }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset, setError } = useForm<{ reason: string; password: string }>({ defaultValues: { reason: '', password: '' } });

  const submit = handleSubmit(({ reason, password }) => {
    if (reason.trim().length < 3) {
      setError('reason', { message: 'Say why, in a sentence' });
      return;
    }
    if (!password.trim()) {
      setError('password', { message: 'Enter your password' });
      return;
    }
    onConfirm({ reason: reason.trim(), password });
  });

  return (
    <BottomSheet
      ref={localRef}
      title={`Void ${voucherNumber}?`}
      snapPoints={['75%']}
      onDismiss={() => {
        reset({ reason: '', password: '' });
        onDismiss?.();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          The spending is taken out of the books with a reversing entry. The voucher stays, marked as voided, so there is a record of it.
        </Text>
        <TextField control={control} name="reason" label="Why is it being voided?" placeholder="For example: paid twice" multiline testID="void-reason" />
        <PasswordField control={control} name="password" label="Your password" testID="void-password" />
        {error ? (
          <Text variant="caption" tone="danger" testID="void-error">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={loading}
            onPress={() => {
              void submit();
            }}
            testID="void-confirm"
          >
            Void expense
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
