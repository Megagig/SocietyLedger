import { zodResolver } from '@hookform/resolvers/zod';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { TextField } from '@/components/forms/TextField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { agendaFormSchema, emptyAgendaValues, type AgendaFormValues } from '../schemas';

export type AgendaItemSheetProps = {
  /** The item being edited, or null for a new one. */
  initial: Partial<AgendaFormValues> | null;
  loading: boolean;
  onSubmit: (values: AgendaFormValues) => void;
};

/** Add or change one agenda item: what it is, who presents, how long, and any notes. */
export const AgendaItemSheet = forwardRef<BottomSheetModal, AgendaItemSheetProps>(function AgendaItemSheet({ initial, loading, onSubmit }, ref) {
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const { control, handleSubmit, reset } = useForm<AgendaFormValues>({ resolver: zodResolver(agendaFormSchema), defaultValues: emptyAgendaValues(), mode: 'onTouched' });

  // Start from the item being edited (or blank) every time the sheet is given a different one.
  useEffect(() => {
    reset({ ...emptyAgendaValues(), ...(initial ?? {}) });
  }, [initial, reset]);

  return (
    <BottomSheet ref={localRef} title={initial?.title ? 'Edit agenda item' : 'Add an agenda item'} snapPoints={['80%']}>
      <View className="gap-4 pb-6">
        <TextField control={control} name="title" label="Item" placeholder="Treasurer's report" autoCapitalize="sentences" testID="agenda-title" />
        <TextField control={control} name="presenter" label="Presented by (optional)" autoCapitalize="words" />
        <TextField control={control} name="duration" label="Minutes (optional)" keyboardType="number-pad" />
        <TextField control={control} name="description" label="Notes (optional)" multiline />
        <Button variant="primary" loading={loading} onPress={() => { void handleSubmit(onSubmit)(); }} testID="agenda-save">
          Save item
        </Button>
      </View>
    </BottomSheet>
  );
});
