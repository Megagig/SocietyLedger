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

const schema = z.object({ message: z.string().trim().max(300, 'Keep the message under 300 characters') });
type FormValues = z.infer<typeof schema>;

export type ReminderSheetProps = {
  memberCount: number;
  loading: boolean;
  onSend: (message: string | undefined) => void;
};

/** Confirms a reminder and lets the officer add a short message of their own (optional). */
export const ReminderSheet = forwardRef<BottomSheetModal, ReminderSheetProps>(function ReminderSheet({ memberCount, loading, onSend }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { message: '' }, mode: 'onTouched' });

  return (
    <BottomSheet ref={localRef} title={`Remind ${memberCount} ${memberCount === 1 ? 'member' : 'members'}?`} snapPoints={['60%']} onDismiss={() => reset()}>
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          Each member gets a notification in the app, and an email if they have one, saying what they owe. A charge reminded in the last 24 hours is skipped.
        </Text>
        <TextField control={control} name="message" label="Your message (optional)" placeholder="For example: please pay before Saturday's meeting" multiline testID="reminder-message" />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Not now
          </Button>
          <Button variant="primary" fullWidth loading={loading} onPress={() => { void handleSubmit((values) => onSend(values.message.trim() || undefined))(); }} testID="reminder-send">
            Send reminders
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
