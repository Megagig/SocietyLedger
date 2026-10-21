import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useThemeMode } from '@/providers/ThemeProvider';
import { tokens } from '@/theme/tokens';

export type SegmentedOption<T extends string> = { label: string; value: T };

export type SegmentedControlProps<T extends string> = {
  /** 2–4 peer views (ui-rules.md §5.7) — more than 4 should be a scrollable chip row instead, not this component. */
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

/**
 * ui-rules.md §5.7 — track surface-sunken, selected pill surface + elevation-1 (light) /
 * surface-raised (dark). Deliberately plain controlled (value/onChange), not RHF-bound — used
 * both for local view toggles (Upcoming|Past) and per-row state (GV4's
 * Present/Absent/Excused/Late), neither a single submitted form field.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, testID }: SegmentedControlProps<T>) {
  const { scheme } = useThemeMode();
  const elevation1 = tokens.elevation[1];

  return (
    <View testID={testID} className="flex-row rounded-md bg-surface-sunken p-1">
      {options.map((option) => {
        const active = option.value === value;
        const elevationStyle =
          active && scheme === 'light'
            ? Platform.select({
                ios: {
                  shadowColor: elevation1.shadowColor,
                  shadowOffset: elevation1.shadowOffset,
                  shadowOpacity: elevation1.shadowOpacity,
                  shadowRadius: elevation1.shadowRadius,
                },
                android: { elevation: elevation1.android },
              })
            : undefined;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={elevationStyle}
            className={['flex-1 items-center rounded-sm py-2', active ? 'bg-surface dark:bg-surface-raised' : ''].join(' ')}
          >
            <Text variant="label" tone={active ? 'default' : 'secondary'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
