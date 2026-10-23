import { memo } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Check, Phone } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ReminderMemberDTO } from '@/types/api/financeManage';
import { daysOverdue, lastRemindedAt, remindedLabel } from '../labels';

export type OverdueMemberRowProps = {
  entry: ReminderMemberDTO;
  selected: boolean;
  /** Whether the officer can send reminders; without it the row is just a list entry. */
  selectable: boolean;
  position: 'first' | 'middle' | 'last' | 'only';
  onToggle: (memberId: number) => void;
};

/** One member who owes: name, how long the oldest charge has been overdue, what they owe, when they were last reminded, and a call button. */
function OverdueMemberRowBase({ entry, selected, selectable, position, onToggle }: OverdueMemberRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const name = `${entry.member.firstName} ${entry.member.lastName}`.trim();
  const oldest = Math.max(0, ...entry.transactions.map((t) => daysOverdue(t.dueDate)));
  const reminded = remindedLabel(lastRemindedAt(entry.transactions));
  const charges = entry.transactions.length === 1 ? '1 charge' : `${entry.transactions.length} charges`;
  const reach = entry.member.email || entry.member.hasAccount ? null : 'No email or login — can’t be reminded here';
  const meta = [oldest > 0 ? `${oldest} ${oldest === 1 ? 'day' : 'days'} overdue` : 'Not yet due', charges].join(' · ');

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <View className="min-h-[76px] flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => selectable && onToggle(entry.member.id)}
          disabled={!selectable}
          accessibilityRole={selectable ? 'checkbox' : undefined}
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`${name}, owes, ${meta}`}
          className="flex-1 flex-row items-center gap-3"
          testID={`overdue-row-${entry.member.id}`}
        >
          {selectable ? (
            <View className={cn('h-6 w-6 items-center justify-center rounded-sm border', selected ? 'border-primary bg-primary' : 'border-border-strong')}>
              {selected ? <Check size={16} color={color.onPassbook} strokeWidth={2.5} /> : null}
            </View>
          ) : null}
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone={oldest > 0 ? 'danger' : 'secondary'} numberOfLines={1}>
              {meta}
            </Text>
            {reach ? (
              <Text variant="caption" tone="warning" numberOfLines={1}>
                {reach}
              </Text>
            ) : reminded ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {reminded}
              </Text>
            ) : null}
          </View>
          <Money value={entry.totalOutstanding} size="body-strong" tone={oldest > 0 ? 'danger' : 'default'} />
        </Pressable>
        {entry.member.phone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${entry.member.phone}`)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${name}`}
            hitSlop={8}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-primary-soft"
            testID={`overdue-call-${entry.member.id}`}
          >
            <Phone size={18} color={color.primary} strokeWidth={1.75} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const OverdueMemberRow = memo(OverdueMemberRowBase);
