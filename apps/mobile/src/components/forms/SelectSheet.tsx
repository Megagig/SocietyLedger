import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronDown, Search } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { FieldShell, type RHFControlProps } from './FieldShell';

export type SelectOption = { label: string; value: string };

export type SelectSheetProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  options: SelectOption[];
  placeholder?: string;
  testID?: string;
};

/** ui-rules.md §5.6 — opens a BottomSheet; searchable when > 8 options. */
export function SelectSheet<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  options,
  placeholder = 'Select an option',
  testID,
}: SelectSheetProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [query, setQuery] = useState('');
  const hasError = !!fieldState.error;
  const searchable = options.length > 8;

  const filtered = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query],
  );

  const selected = options.find((o) => o.value === field.value);

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <Pressable
        testID={testID}
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        className={[
          'h-[52px] flex-row items-center justify-between rounded-md border bg-surface-sunken px-4',
          hasError ? 'border-danger' : 'border-border-strong',
        ].join(' ')}
      >
        <Text variant="body" tone={selected ? 'default' : 'tertiary'}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={20} color={color.textSecondary} strokeWidth={1.75} />
      </Pressable>

      <BottomSheet ref={sheetRef} title={label ?? 'Select an option'}>
        {searchable ? (
          <View className="mb-3 h-11 flex-row items-center gap-2 rounded-md bg-surface-sunken px-3">
            <Search size={18} color={color.textTertiary} strokeWidth={1.75} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={color.textTertiary}
              className="flex-1 font-regular text-body text-text"
            />
          </View>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                field.onChange(item.value);
                sheetRef.current?.dismiss();
              }}
              className="h-12 flex-row items-center px-1"
            >
              <Text variant="body-lg" tone={item.value === field.value ? 'primary' : 'default'}>
                {item.label}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text variant="caption" tone="secondary">
              No matches
            </Text>
          }
        />
      </BottomSheet>
    </FieldShell>
  );
}
