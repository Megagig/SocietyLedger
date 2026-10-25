import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Check } from 'lucide-react-native';

import { SearchField } from '@/components/forms/SearchField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { memberFullName } from '@/features/members/labels';
import { useMembersList } from '@/features/members/queries';

export type PickedMemberRef = { id: number; name: string };

export type MembersMultiPickerSheetProps = {
  selected: PickedMemberRef[];
  onChange: (members: PickedMemberRef[]) => void;
  /** Members to leave out of the list (e.g. those already in a levy campaign). */
  excludeIds?: number[];
};

/** Choose several members: search the directory and tick as many as you need. Done closes the sheet. */
export const MembersMultiPickerSheet = forwardRef<BottomSheetModal, MembersMultiPickerSheetProps>(function MembersMultiPickerSheet({ selected, onChange, excludeIds }, ref) {
  const { color } = useThemeTokens();
  const localRef = useRef<BottomSheetModal>(null);
  useImperativeHandle(ref, () => localRef.current as BottomSheetModal, []);
  const [search, setSearch] = useState('');
  const query = useMembersList({ search: search.trim() || undefined, status: 'active' });
  const members = useMemo(() => {
    const skip = new Set(excludeIds ?? []);
    return (query.data?.pages.flatMap((page) => page.members) ?? []).filter((m) => !skip.has(m.id));
  }, [query.data, excludeIds]);
  const chosen = new Set(selected.map((m) => m.id));

  const toggle = (id: number, name: string) =>
    onChange(chosen.has(id) ? selected.filter((m) => m.id !== id) : [...selected, { id, name }]);

  return (
    <BottomSheet ref={localRef} title="Choose members" snapPoints={['75%']}>
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
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          renderItem={({ item }) => {
            const name = memberFullName(item);
            const on = chosen.has(item.id);
            return (
              <Pressable onPress={() => toggle(item.id, name)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="min-h-[48px] flex-row items-center gap-3 py-2">
                <View className={cn('h-6 w-6 items-center justify-center rounded-sm border', on ? 'border-primary bg-primary' : 'border-border-strong')}>
                  {on ? <Check size={16} color={color.onPassbook} strokeWidth={2.5} /> : null}
                </View>
                <View className="flex-1">
                  <Text variant="body-lg" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {item.memberId}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
      <View className="pt-3">
        <Button variant="primary" onPress={() => localRef.current?.dismiss()}>
          {selected.length === 0 ? 'Done' : `Done · ${selected.length} chosen`}
        </Button>
      </View>
    </BottomSheet>
  );
});
