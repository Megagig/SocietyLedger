import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { Control, FieldValues, Path } from 'react-hook-form';

import { Text } from '@/components/ui/Text';

/** Shared control+name pair every RHF-bound field component accepts (code-standards.md §8). */
export type RHFControlProps<TFieldValues extends FieldValues = FieldValues> = {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
};

export type FieldShellProps = {
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

/** Label above, input, helper/error below (ui-rules.md §5.6) — composed internally by every field in this folder, not used directly by screens. */
export function FieldShell({ label, helper, error, required, children }: FieldShellProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="label" tone="secondary">
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : helper ? (
        <Text variant="caption" tone="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
