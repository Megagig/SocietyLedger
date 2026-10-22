import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Divider } from '@/components/ui/Divider';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { MemberListItemDTO } from '@/types/api/membersManage';
import { categoryLabel, memberFullName, statusLabel } from '../labels';

export type MemberRowProps = {
  member: MemberListItemDTO;
  /** Where the row sits in the list, so the rows read as one grouped surface (ui-rules.md §5.3) even though FlashList renders them one by one. */
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (member: MemberListItemDTO) => void;
};

/** One member in the directory: avatar, name, member ID and category, status chip. */
function MemberRowBase({ member, position, onPress }: MemberRowProps) {
  const { color } = useThemeTokens();
  const name = memberFullName(member);
  const status = member.status.toLowerCase();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';

  return (
    <View
      className={cn(
        'overflow-hidden border-x border-border bg-surface dark:border-transparent',
        isFirst && 'rounded-t-md border-t',
        isLast && 'rounded-b-md border-b',
      )}
    >
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(member)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${member.memberId}, ${statusLabel(status)}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[64px] flex-row items-center px-4 py-3"
        testID={`member-row-${member.id}`}
      >
        <View className="mr-3">
          <Avatar name={name} colorSeed={member.id} />
        </View>
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${member.memberId} · ${categoryLabel(member.category)}`}
          </Text>
        </View>
        <View className="ml-3">
          <StatusChip status={status} label={statusLabel(status)} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const MemberRow = memo(MemberRowBase);
