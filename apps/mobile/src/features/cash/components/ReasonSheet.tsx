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
  reason: z.string().trim().min(3, 'Say why, so the record makes sense later').max(500, 'Keep the reason under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

export type ReasonSheetProps = {
  title: string;
  description: string;
  placeholder: string;
  confirmLabel: string;
  keepLabel?: string;
  loading: boolean;
  onSubmit: (reason: string) => void;
  testID?: string;
};

/** Asks an officer for a required reason before a final action — voiding a receipt, rejecting a lodgment. */
export const ReasonSheet = forwardRef<BottomSheetModal, ReasonSheetProps>(function ReasonSheet(
  { title, description, placeholder, confirmLabel, keepLabel = 'Keep it', loading, onSubmit, testID = 'reason' },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' }, mode: 'onTouched' });

  return (
    <BottomSheet ref={localRef} title={title} snapPoints={['65%']} onDismiss={() => reset()}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {description}
        </Text>
        <TextField control={control} name="reason" label="Reason" placeholder={placeholder} multiline testID={`${testID}-field`} />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            {keepLabel}
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { handleSubmit((values) => onSubmit(values.reason.trim()))(); }} testID={`${testID}-confirm`}>
            {confirmLabel}
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
