import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { rejectSchema, type RejectValues } from '../schemas';

export type ReasonSheetProps = {
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: (reason: string) => void;
};

/** Asks the officer for the reason a request or application is being turned down — required, because the member reads it. */
export const ReasonSheet = forwardRef<BottomSheetModal, ReasonSheetProps>(function ReasonSheet({ title, description, confirmLabel, loading, onConfirm }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: '' }, mode: 'onTouched' });

  return (
    <BottomSheet ref={localRef} title={title} snapPoints={['60%']} onDismiss={() => reset()}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {description}
        </Text>
        <TextField control={control} name="reason" label="Reason" placeholder="Say why, in a sentence" multiline testID="reason-input" />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Not now
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { void handleSubmit((values) => onConfirm(values.reason.trim()))(); }} testID="reason-confirm">
            {confirmLabel}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
