import { TextInput, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type TextFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  multiline?: boolean;
  maxLength?: number;
  editable?: boolean;
  testID?: string;
};

/** ui-rules.md §5.6 — label above, height 52 (or auto for multiline), radius md, surface-sunken fill, border-strong → 2dp focus, danger on error. */
export function TextField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  placeholder,
  keyboardType,
  autoCapitalize = 'none',
  returnKeyType,
  onSubmitEditing,
  multiline = false,
  maxLength,
  editable = true,
  testID,
}: TextFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const hasError = !!fieldState.error;

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <TextInput
        testID={testID}
        value={(field.value as string | undefined) ?? ''}
        onChangeText={field.onChange}
        onBlur={field.onBlur}
        placeholder={placeholder}
        placeholderTextColor={color.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        textAlignVertical={multiline ? 'top' : 'center'}
        className={cn(
          'rounded-md border bg-surface-sunken px-4 font-regular text-body text-text',
          multiline ? 'min-h-[52px] py-3' : 'h-[52px]',
          hasError ? 'border-danger' : 'border-border-strong focus:border-2 focus:border-focus',
          !editable && 'opacity-60',
        )}
      />
    </FieldShell>
  );
}
