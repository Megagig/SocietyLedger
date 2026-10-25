import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { mergeDateTime, type DatePart } from '@/lib/dateTime';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type DateTimeFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  /** Shown while nothing is chosen. */
  placeholder?: string;
  /** Adds a clear (×) button once a value is chosen — for fields that may be left empty. */
  clearable?: boolean;
  testID?: string;
};

/**
 * A date AND a time, as two taps (Android's picker can't do both at once). The form value is an ISO string, or '' when empty. Used where
 * the time matters — a meeting's start and end.
 */
export function DateTimeField<TFieldValues extends FieldValues = FieldValues>({ control, name, label, helper, placeholder = 'Not set', clearable = false, testID }: DateTimeFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const [picker, setPicker] = useState<DatePart | null>(null);
  const value = field.value as string | undefined;
  const selected = value ? new Date(value) : undefined;
  const hasError = !!fieldState.error;
  const box = ['h-[52px] flex-1 flex-row items-center rounded-md border bg-surface-sunken px-4', hasError ? 'border-danger' : 'border-border-strong'].join(' ');

  const apply = (picked: Date, part: DatePart) => field.onChange(mergeDateTime(selected, picked, part).toISOString());

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    const part = picker;
    setPicker(null);
    if (event.type === 'set' && date && part) apply(date, part);
  };

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <View className="flex-row items-center gap-2">
        <Pressable testID={testID} onPress={() => setPicker('date')} accessibilityRole="button" accessibilityLabel={`${label ?? 'Date'}: date`} className={box}>
          <Text variant="body" tone={selected ? 'default' : 'tertiary'} numberOfLines={1}>
            {selected ? formatDate(selected.toISOString(), 'long') : placeholder}
          </Text>
        </Pressable>
        <Pressable onPress={() => setPicker('time')} accessibilityRole="button" accessibilityLabel={`${label ?? 'Time'}: time`} className={`${box} max-w-[120px]`}>
          <Text variant="body" tone={selected ? 'default' : 'tertiary'}>
            {selected ? formatDate(selected.toISOString(), 'time') : '–'}
          </Text>
        </Pressable>
        {clearable && selected ? (
          <Pressable onPress={() => field.onChange('')} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8} className="h-11 w-11 items-center justify-center">
            <X size={18} color={color.textSecondary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      {picker && Platform.OS === 'android' ? <DateTimePicker value={selected ?? new Date()} mode={picker} onChange={onAndroidChange} /> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <View className="flex-1 justify-end bg-overlay/45">
            <View className="rounded-t-xl bg-surface p-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text variant="h2">{picker === 'time' ? 'Choose the time' : 'Choose the date'}</Text>
                <Button variant="ghost" size="sm" onPress={() => setPicker(null)}>
                  Done
                </Button>
              </View>
              {picker ? <DateTimePicker value={selected ?? new Date()} mode={picker} display="spinner" onChange={(_event, date) => date && apply(date, picker)} /> : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </FieldShell>
  );
}
