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

const schema = z.object({ reason: z.string().trim().max(500, 'Keep the reason under 500 characters') });

type FormValues = z.infer<typeof schema>;

export type RejectRegistrationSheetProps = {
  name: string;
  loading: boolean;
  /** An empty reason is allowed (as on the web) — it is sent as undefined. */
  onSubmit: (reason: string | undefined) => void;
  onDismiss: () => void;
};

/** Reject a self-registration. The reason is optional; when given, it goes in the email the person receives. */
export const RejectRegistrationSheet = forwardRef<BottomSheetModal, RejectRegistrationSheetProps>(function RejectRegistrationSheet(
  { name, loading, onSubmit, onDismiss },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });

  return (
    <BottomSheet
      ref={localRef}
      title="Reject this registration?"
      snapPoints={['60%']}
      onDismiss={() => {
        reset();
        onDismiss();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {`${name} won't be able to sign in. They get an email, with your reason if you give one.`}
        </Text>
        <TextField control={control} name="reason" label="Reason (optional)" placeholder="Why are you rejecting this registration?" multiline />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { handleSubmit((values) => onSubmit(values.reason.trim() || undefined))(); }}>
            Reject registration
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
