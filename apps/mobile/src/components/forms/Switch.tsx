import { Pressable, Switch as RNSwitch, View } from 'react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { RHFControlProps } from './FieldShell';

export type SwitchProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label: string;
  helper?: string;
  testID?: string;
};

/** N2 Notification Preferences' per-category toggles, etc. — boolean field, themed track/thumb colours. */
export function Switch<TFieldValues extends FieldValues = FieldValues>({ control, name, label, helper, testID }: SwitchProps<TFieldValues>) {
  const { field } = useController({ control, name });
  const { color } = useThemeTokens();
  const checked = !!field.value;

  return (
    // Review finding (Phase 1 retro): the row's own padding didn't give a 44dp tap target, and
    // only the small native Switch itself was interactive. Making the whole row pressable (a
    // common, expected pattern for label+switch rows) both grows the usable tap area and lets a
    // tap directly on the native Switch keep working — RN's touch responder system gives that
    // inner control exclusive capture of its own touches, so this doesn't double-toggle.
    <Pressable
      onPress={() => field.onChange(!checked)}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      className="flex-row items-center justify-between gap-3 py-2"
    >
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        {helper ? (
          <Text variant="caption" tone="secondary">
            {helper}
          </Text>
        ) : null}
      </View>
      <RNSwitch
        testID={testID}
        value={checked}
        onValueChange={field.onChange}
        trackColor={{ false: color.borderStrong, true: color.primary }}
        thumbColor={color.surface}
      />
    </Pressable>
  );
}
