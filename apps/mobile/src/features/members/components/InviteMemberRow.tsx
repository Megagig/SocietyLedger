import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { InvitableMemberDTO } from '@/types/api/membersManage';
import { memberFullName } from '../labels';

export type InviteMemberRowProps = {
  member: InvitableMemberDTO;
  selected: boolean;
  onToggle: (member: InvitableMemberDTO) => void;
};

/** A member who can be invited: checkbox, name, email, and a note when an invite is already out. */
function InviteMemberRowBase({ member, selected, onToggle }: InviteMemberRowProps) {
  const { color } = useThemeTokens();
  const name = memberFullName(member);
  const alreadyInvited = member.invites.length > 0;

  return (
    <Pressable
      onPress={() => onToggle(member)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${member.email ?? ''}`}
      android_ripple={{ color: `${color.primary}1F` }}
      className="min-h-[64px] flex-row items-center border-b border-border bg-surface px-4 py-3"
      testID={`invite-row-${member.id}`}
    >
      <View
        className={cn('mr-3 h-6 w-6 items-center justify-center rounded-sm border', selected ? 'border-primary bg-primary' : 'border-border-strong bg-surface-sunken')}
      >
        {selected ? <Check size={16} color={color.textInverse} strokeWidth={2.5} /> : null}
      </View>
      <View className="mr-3">
        <Avatar name={name} colorSeed={member.id} size={32} />
      </View>
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {member.email}
        </Text>
      </View>
      {alreadyInvited ? <Badge tone="info">Invited</Badge> : null}
    </Pressable>
  );
}

export const InviteMemberRow = memo(InviteMemberRowBase);
