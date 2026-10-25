import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';

import { PasswordField } from '@/components/forms/PasswordField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

type Props = {
  entryNumber: string;
  /** The question and the words on the button, when the sheet confirms something other than posting an entry. */
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading: boolean;
  /** Shown under the password when the server said it was wrong. */
  error?: string | null;
  onConfirm: (password: string) => void;
  onDismiss?: () => void;
};

/**
 * Posting adds an entry to the books for good, so the officer confirms with their password first. The password is sent with the
 * request and checked on the server; it is cleared whenever the sheet closes.
 */
export const PostEntrySheet = forwardRef<BottomSheetModal, Props>(function PostEntrySheet({ entryNumber, title, description, confirmLabel, loading, error, onConfirm, onDismiss }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset, setError } = useForm<{ password: string }>({ defaultValues: { password: '' } });

  const submit = handleSubmit(({ password }) => {
    if (!password.trim()) {
      setError('password', { message: 'Enter your password' });
      return;
    }
    onConfirm(password);
  });

  return (
    <BottomSheet
      ref={localRef}
      title={title ?? `Post ${entryNumber}?`}
      snapPoints={['55%']}
      onDismiss={() => {
        reset({ password: '' });
        onDismiss?.();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {description ?? 'Posting adds this entry to the books for good. It can no longer be changed. Enter your password to confirm.'}
        </Text>
        <PasswordField control={control} name="password" label="Your password" testID="post-password" />
        {error ? (
          <Text variant="caption" tone="danger" testID="post-error">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              void submit();
            }}
            testID="post-confirm"
          >
            {confirmLabel ?? 'Post entry'}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
