import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { LedgerMemberDTO } from '@/types/api/ledgerManage';
import { balanceLabel } from './labels';

export type LedgerMemberRowProps = {
  member: LedgerMemberDTO;
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (member: LedgerMemberDTO) => void;
};

const STATE_TEXT = { owes: 'Owes', credit: 'Credit', settled: 'Settled' } as const;

/** One member's ledger: who they are, and whether they owe, are in credit, or are settled. */
function LedgerMemberRowBase({ member, position, onPress }: LedgerMemberRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const name = `${member.firstName} ${member.lastName}`.trim();
  const state = balanceLabel(member.balance);

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(member)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${STATE_TEXT[state]}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[64px] flex-row items-center px-4 py-3"
        testID={`ledger-member-${member.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {member.memberId ?? ''}
          </Text>
        </View>
        <View className="ml-3 items-end">
          {state === 'settled' ? (
            <Text variant="body-strong" tone="secondary">
              Settled
            </Text>
          ) : (
            <>
              <Money value={Math.abs(member.balance)} size="body-strong" tone={state === 'owes' ? 'danger' : 'success'} />
              <Text variant="caption" tone="secondary">
                {STATE_TEXT[state]}
              </Text>
            </>
          )}
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const LedgerMemberRow = memo(LedgerMemberRowBase);
