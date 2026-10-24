import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check, ChevronDown } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * A dropdown for choosing one of a few options: a labelled field that opens a bottom sheet listing every option, with a check on the
 * current one. The same look as the period picker, for filters and sorting that are not form fields.
 */
export function OptionDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (next: T) => void;
  testID?: string;
}) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const shown = options.find((o) => o.value === value)?.label ?? 'Choose';

  return (
    <View className="flex-1 gap-1.5">
      <Text variant="label">{label}</Text>
      <Pressable
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        className="h-[48px] flex-row items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-sunken px-3"
        testID={testID}
      >
        <Text variant="body" numberOfLines={1} className="flex-1">
          {shown}
        </Text>
        <ChevronDown size={18} color={color.textSecondary} strokeWidth={1.75} />
      </Pressable>

      <BottomSheet ref={sheetRef} title={label} snapPoints={['45%']}>
        <View className="pb-6">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  sheetRef.current?.dismiss();
                  onChange(o.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className="h-12 flex-row items-center justify-between px-1"
                testID={testID ? `${testID}-${o.value}` : undefined}
              >
                <Text variant="body-lg" tone={active ? 'primary' : 'default'}>
                  {o.label}
                </Text>
                {active ? <Check size={18} color={color.primary} strokeWidth={2.25} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
