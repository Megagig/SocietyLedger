import { useRef, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { FieldShell, type RHFControlProps } from './FieldShell';

export type OtpInputProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  length?: number;
  testID?: string;
};

/** ui-rules.md §5.6 — 6 boxes, auto-advance, paste fills all, `oneTimeCode` autofill on iOS (A6 Verify Email). */
export function OtpInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  length = 6,
  testID,
}: OtpInputProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const value = (field.value as string | undefined) ?? '';
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const hasError = !!fieldState.error;

  const setDigit = (index: number, text: string) => {
    if (text.length > 1) {
      // A full paste (or iOS oneTimeCode autofill) landing in one box.
      const pasted = text.slice(0, length);
      field.onChange(pasted);
      inputs.current[Math.min(pasted.length, length) - 1]?.focus();
      return;
    }
    const next = digits.slice();
    next[index] = text;
    field.onChange(next.join(''));
    if (text && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const onKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <View className="flex-row gap-2">
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            testID={testID ? `${testID}-${index}` : undefined}
            value={digit}
            onChangeText={(text) => setDigit(index, text)}
            onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            textContentType={index === 0 ? 'oneTimeCode' : undefined}
            maxLength={index === 0 ? length : 1}
            className={[
              'h-12 w-12 rounded-md border bg-surface-sunken text-center font-semibold text-h3 text-text',
              hasError ? 'border-danger' : 'border-border-strong',
            ].join(' ')}
          />
        ))}
      </View>
    </FieldShell>
  );
}
