import { Check, ChevronDown } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { SearchField } from '@/components/forms/SearchField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { memberFullName } from '@/features/members/labels';
import { useMembersList } from '@/features/members/queries';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';

/**
 * Pick several members from the directory: a field that says how many are chosen, and a sheet to search and tick them. Needs the
 * officer to be able to view members.
 */
export function MemberMultiPicker({
  value,
  onChange,
  label = 'Members',
  testID,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  testID?: string;
}) {
  const { color } = useThemeTokens();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [search, setSearch] = useState('');
  const query = useMembersList({ search: search.trim() || undefined });
  const members = useMemo(() => query.data?.pages.flatMap((page) => page.members) ?? [], [query.data]);

  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <View className="gap-1.5">
      <Text variant="label">{label}</Text>
      <Pressable
        testID={testID}
        onPress={() => sheetRef.current?.present()}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-[52px] flex-row items-center justify-between rounded-md border border-border-strong bg-surface-sunken px-4"
      >
        <Text variant="body" tone={value.length > 0 ? 'default' : 'tertiary'}>
          {value.length > 0 ? `${value.length} chosen` : 'Choose members'}
        </Text>
        <ChevronDown size={20} color={color.textSecondary} strokeWidth={1.75} />
      </Pressable>

      <BottomSheet ref={sheetRef} title="Choose members" snapPoints={['80%']}>
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
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const picked = value.includes(item.id);
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: picked }}
                  className="min-h-[52px] flex-row items-center gap-3 px-1 py-2"
                  testID={`pick-member-${item.id}`}
                >
                  <View className={cn('h-5 w-5 items-center justify-center rounded-xs border', picked ? 'border-primary bg-primary' : 'border-border-strong bg-surface')}>
                    {picked ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
                  </View>
                  <View className="flex-1">
                    <Text variant="body-lg" numberOfLines={1}>
                      {memberFullName(item)}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {item.memberId}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
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
        <View className="flex-row gap-3 pb-6 pt-3">
          <Button variant="secondary" fullWidth onPress={() => onChange([])}>
            Clear
          </Button>
          <Button variant="primary" fullWidth onPress={() => sheetRef.current?.dismiss()}>
            {value.length > 0 ? `Done (${value.length})` : 'Done'}
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}
