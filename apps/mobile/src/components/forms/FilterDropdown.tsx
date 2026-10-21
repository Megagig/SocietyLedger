import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';

export type FilterDropdownOption<T extends string> = {
  label: string;
  value: T;
  /** Leading icon shown in the trigger and in the sheet row. */
  icon?: LucideIcon;
  /** One-line explanation under the label in the sheet. */
  hint?: string;
};

export type FilterDropdownProps<T extends string> = {
  /** Small caption above the value, e.g. "Status". */
  label: string;
  value: T;
  options: FilterDropdownOption<T>[];
  onChange: (value: T) => void;
  /** The option that means "no filter" — the trigger is highlighted whenever the value differs from it. */
  defaultValue: T;
  testID?: string;
};

/**
 * ui-registry.md — controlled dropdown for list filters: a two-line trigger (caption + current value)
 * that opens a BottomSheet of rich option rows with a check on the selected one. Plain value/onChange
 * (not RHF-bound), same split as `SearchField`/`SegmentedControl`; `SelectSheet` stays the form-field version.
 */
export function FilterDropdown<T extends string>({ label, value, options, onChange, defaultValue, testID }: FilterDropdownProps<T>) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];
  const active = value !== defaultValue;
  const TriggerIcon = selected?.icon;

  return (
    <View className="flex-1">
      <Pressable
        testID={testID}
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className={[
          'min-h-[56px] flex-row items-center gap-2 rounded-lg border px-3 py-2',
          active ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
        ].join(' ')}
      >
        {TriggerIcon ? <TriggerIcon size={18} color={active ? color.primary : color.textSecondary} strokeWidth={1.75} /> : null}
        <View className="flex-1">
          <Text variant="micro" tone="secondary">
            {label}
          </Text>
          <Text variant="body-strong" tone={active ? 'primary' : 'default'} numberOfLines={1}>
            {selected?.label}
          </Text>
        </View>
        <ChevronDown size={18} color={color.textSecondary} strokeWidth={1.75} />
      </Pressable>

      <BottomSheet ref={sheetRef} title={label} snapPoints={['50%']}>
        <View className="gap-1 pb-6">
          {options.map((option) => {
            const isSelected = option.value === value;
            const Icon = option.icon;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  sheetRef.current?.dismiss();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                android_ripple={{ color: `${color.primary}1F` }}
                className={['min-h-[52px] flex-row items-center gap-3 rounded-lg px-3 py-2', isSelected ? 'bg-primary-soft' : ''].join(' ')}
              >
                {Icon ? (
                  <View
                    className={[
                      'h-[36px] w-[36px] items-center justify-center rounded-full',
                      isSelected ? 'bg-surface' : 'bg-surface-sunken',
                    ].join(' ')}
                  >
                    <Icon size={18} color={isSelected ? color.primary : color.textSecondary} strokeWidth={1.75} />
                  </View>
                ) : null}
                <View className="flex-1">
                  <Text variant="body-lg" tone={isSelected ? 'primary' : 'default'}>
                    {option.label}
                  </Text>
                  {option.hint ? (
                    <Text variant="caption" tone="secondary">
                      {option.hint}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Check size={20} color={color.primary} strokeWidth={2} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
