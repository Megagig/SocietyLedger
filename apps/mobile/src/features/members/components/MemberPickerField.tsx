import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronDown, X } from 'lucide-react-native';
import { useController, type FieldValues } from 'react-hook-form';

import { FieldShell, type RHFControlProps } from '@/components/forms/FieldShell';
import { SearchField } from '@/components/forms/SearchField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { memberFullName } from '../labels';
import { useMembersList } from '../queries';

/** What the form holds for a chosen member: the id to send and the name to show. */
export type PickedMember = { id: number; name: string };

export type MemberPickerFieldProps<TFieldValues extends FieldValues = FieldValues> = RHFControlProps<TFieldValues> & {
  label?: string;
  helper?: string;
  placeholder?: string;
  testID?: string;
};

/**
 * A form field that picks one member by searching the directory (name, member ID, email or phone). Optional by design — the value is
 * `PickedMember | null`, and the clear (×) button puts it back to null. Needs the officer to be able to view members.
 */
export function MemberPickerField<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  helper,
  placeholder = 'Choose a member',
  testID,
}: MemberPickerFieldProps<TFieldValues>) {
  const { field, fieldState } = useController({ control, name });
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState('');
  const picked = (field.value as PickedMember | null) ?? null;

  const query = useMembersList({ search: search.trim() || undefined });
  const members = useMemo(() => query.data?.pages.flatMap((page) => page.members) ?? [], [query.data]);

  return (
    <FieldShell label={label} helper={helper} error={fieldState.error?.message}>
      <View className="h-[52px] flex-row items-center rounded-md border border-border-strong bg-surface-sunken pl-4 pr-2">
        <Pressable
          testID={testID}
          onPress={() => sheetRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel={label ?? placeholder}
          className="h-full flex-1 flex-row items-center justify-between"
        >
          <Text variant="body" tone={picked ? 'default' : 'tertiary'} numberOfLines={1} className="flex-1">
            {picked?.name ?? placeholder}
          </Text>
          {picked ? null : <ChevronDown size={20} color={color.textSecondary} strokeWidth={1.75} />}
        </Pressable>
        {picked ? (
          <Pressable onPress={() => field.onChange(null)} accessibilityRole="button" accessibilityLabel="Clear member" hitSlop={8} className="h-11 w-11 items-center justify-center">
            <X size={18} color={color.textSecondary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>

      <BottomSheet ref={sheetRef} title="Choose a member" snapPoints={['70%']}>
        <View className="mb-3">
          <SearchField value={search} onChangeText={setSearch} placeholder="Search name, ID, email or phone" />
        </View>
        {query.isPending ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(member) => String(member.id)}
            style={{ maxHeight: 380 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  field.onChange({ id: item.id, name: memberFullName(item) } satisfies PickedMember);
                  sheetRef.current?.dismiss();
                }}
                accessibilityRole="button"
                className="min-h-[52px] justify-center px-1 py-2"
                testID={`pick-member-${item.id}`}
              >
                <Text variant="body-lg" tone={picked?.id === item.id ? 'primary' : 'default'} numberOfLines={1}>
                  {memberFullName(item)}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {item.memberId}
                </Text>
              </Pressable>
            )}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
            }}
            ListEmptyComponent={
              <Text variant="caption" tone="secondary">
                {search.trim() ? 'No members match' : 'No members yet'}
              </Text>
            }
          />
        )}
      </BottomSheet>
    </FieldShell>
  );
}
