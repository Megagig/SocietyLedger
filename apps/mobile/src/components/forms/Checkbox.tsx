import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { RHFControlProps } from './FieldShell';

export type CheckboxProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label: string;
  testID?: string;
};

/** A5 Register's terms checkbox, etc. — boolean field, 20dp box, primary fill when checked. */
export function Checkbox<TFieldValues extends FieldValues = FieldValues>({ control, name, label, testID }: CheckboxProps<TFieldValues>) {
  const { field } = useController({ control, name });
  const { color } = useThemeTokens();
  const checked = !!field.value;

  return (
    <Pressable
      testID={testID}
      onPress={() => field.onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      className="flex-row items-center gap-3 py-2"
    >
      <View
        className={[
          'h-5 w-5 items-center justify-center rounded-xs border',
          checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface',
        ].join(' ')}
      >
        {checked ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
      </View>
      <Text variant="body" className="flex-1">
        {label}
      </Text>
    </Pressable>
  );
}
