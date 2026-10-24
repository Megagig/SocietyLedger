import { View } from 'react-native';

import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { FilterChip } from '@/components/ui/FilterChip';
import { Text } from '@/components/ui/Text';
import { CATEGORY_LABELS, CATEGORY_OPTIONS } from '@/features/members/labels';
import { useCan } from '@/hooks/useCan';
import { MEMBERS_VIEW_ACCESS } from '@/features/members/queries';
import type { AudienceDraft } from '../schemas';
import { MemberMultiPicker } from './MemberMultiPicker';

/** The kinds that need a category pick / a member pick (the announcement and texting endpoints name them differently). */
const NEEDS_CATEGORIES = ['CATEGORY', 'MEMBER_CATEGORY'];
const NEEDS_MEMBERS = ['SELECTED', 'SELECTED_MEMBERS'];

/**
 * Who a message goes to: the kind of audience, and what that kind needs — categories to tick, or members to choose. A phone-number
 * audience is typed in the form itself. A few kinds read as tabs; more read as a row of chips.
 */
export function AudiencePicker({
  options,
  value,
  onChange,
  testID,
}: {
  options: { label: string; value: string }[];
  value: AudienceDraft;
  onChange: (next: AudienceDraft) => void;
  testID?: string;
}) {
  const canPickMembers = useCan(MEMBERS_VIEW_ACCESS);
  // Choosing members needs the directory; without it that kind is not offered rather than offered and empty
  const shown = options.filter((o) => canPickMembers || !NEEDS_MEMBERS.includes(o.value));

  return (
    <View className="gap-3" testID={testID}>
      {shown.length <= 4 ? (
        <SegmentedControl options={shown} value={value.type} onChange={(type) => onChange({ ...value, type })} />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {shown.map((o) => (
            <FilterChip key={o.value} label={o.label} active={value.type === o.value} onPress={() => onChange({ ...value, type: o.value })} />
          ))}
        </View>
      )}

      {NEEDS_CATEGORIES.includes(value.type) ? (
        <View className="gap-1.5">
          <Text variant="label">Categories</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_LABELS[c]}
                active={value.categories.includes(c)}
                onPress={() => onChange({ ...value, categories: value.categories.includes(c) ? value.categories.filter((x) => x !== c) : [...value.categories, c] })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {NEEDS_MEMBERS.includes(value.type) ? <MemberMultiPicker value={value.memberIds} onChange={(memberIds) => onChange({ ...value, memberIds })} testID="audience-members" /> : null}
    </View>
  );
}
