import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useController, type FieldValues } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type DateFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  testID?: string;
};

/**
 * ui-rules.md §5.6 — "Dates open the native date picker" (not a SelectSheet). Form value is an
 * ISO string. `@react-native-community/datetimepicker` pinned at F1.5 (owner-approved — no
 * picker package was documented anywhere in context before this feature, per library-docs.md's
 * own "stop and ask" rule for an undocumented library).
 */
export function DateField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  mode = 'date',
  minimumDate,
  maximumDate,
  placeholder = 'Select a date',
  testID,
}: DateFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const [open, setOpen] = useState(false);
  const hasError = !!fieldState.error;
  const value = field.value as string | undefined;
  const selectedDate = value ? new Date(value) : undefined;

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && date) field.onChange(date.toISOString());
      return;
    }
    if (date) field.onChange(date.toISOString());
  };

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        className={[
          'h-[52px] flex-row items-center rounded-md border bg-surface-sunken px-4',
          hasError ? 'border-danger' : 'border-border-strong',
        ].join(' ')}
      >
        <Text variant="body" tone={selectedDate ? 'default' : 'tertiary'}>
          {selectedDate ? formatDate(selectedDate.toISOString(), 'long') : placeholder}
        </Text>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={selectedDate ?? new Date()}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View className="flex-1 justify-end bg-overlay/45">
            <View className="rounded-t-xl bg-surface p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="h2">{label ?? 'Select date'}</Text>
                <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                  Done
                </Button>
              </View>
              <DateTimePicker
                value={selectedDate ?? new Date()}
                mode={mode}
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={handleChange}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </FieldShell>
  );
}
