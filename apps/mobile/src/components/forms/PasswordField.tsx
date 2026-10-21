import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type PasswordFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  placeholder?: string;
  /** Strength meter — ui-rules.md §5.6: "on create/reset screens" only, not on login. */
  showStrength?: boolean;
  testID?: string;
};

const STRENGTH_BG_CLASSES = ['bg-danger', 'bg-warning', 'bg-info', 'bg-success'] as const;
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'] as const;

function scorePassword(value: string): number {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export function PasswordField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  placeholder,
  showStrength = false,
  testID,
}: PasswordFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const [visible, setVisible] = useState(false);
  const hasError = !!fieldState.error;
  const value = (field.value as string | undefined) ?? '';
  const score = showStrength ? scorePassword(value) : 0;

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <View
        className={[
          'h-[52px] flex-row items-center rounded-md border bg-surface-sunken px-4',
          hasError ? 'border-danger' : 'border-border-strong',
        ].join(' ')}
      >
        <TextInput
          testID={testID}
          value={value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          placeholder={placeholder}
          placeholderTextColor={color.textTertiary}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          className="flex-1 font-regular text-body text-text"
        />
        <IconButton
          icon={visible ? EyeOff : Eye}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
        />
      </View>
      {showStrength && value.length > 0 ? (
        <View className="gap-1">
          <View className="flex-row gap-1">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                className={['h-1 flex-1 rounded-full', i < score ? STRENGTH_BG_CLASSES[score - 1] : 'bg-surface-sunken'].join(' ')}
              />
            ))}
          </View>
          <Text variant="caption" tone="secondary">
            {STRENGTH_LABELS[Math.max(score - 1, 0)]}
          </Text>
        </View>
      ) : null}
    </FieldShell>
  );
}
