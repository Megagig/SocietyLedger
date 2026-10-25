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
  reason: z.string().trim().min(1, 'Tell the applicant why you are declining').max(500, 'Keep the reason under 500 characters'),
});

type FormValues = z.infer<typeof schema>;

export type DeclineGuaranteeSheetProps = {
  applicantName: string;
  loading: boolean;
  onSubmit: (reason: string) => void;
  onDismiss: () => void;
};

/** Decline a guarantor request. The API refuses a decline without a reason, and the applicant sees it on their application. */
export const DeclineGuaranteeSheet = forwardRef<BottomSheetModal, DeclineGuaranteeSheetProps>(function DeclineGuaranteeSheet(
  { applicantName, loading, onSubmit, onDismiss },
  ref,
) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });

  return (
    <BottomSheet
      ref={localRef}
      title="Decline this request?"
      snapPoints={['60%']}
      onDismiss={() => {
        reset();
        onDismiss();
      }}
    >
      <View className="gap-4 pb-6">
        <Text variant="body" tone="secondary">
          {`${applicantName} will see your reason on their application. You can't undo this.`}
        </Text>
        <TextField control={control} name="reason" label="Reason" placeholder="Why are you declining?" multiline />
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth onPress={() => localRef.current?.dismiss()}>
            Keep it
          </Button>
          <Button variant="danger" fullWidth loading={loading} onPress={() => { handleSubmit((values) => onSubmit(values.reason.trim()))(); }}>
            Decline request
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
});
