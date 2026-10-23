import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ChargeListItemDTO } from '@/types/api/financeManage';
import { chargeMemberName, chargeStatusKey, chargeStatusLabel } from '../labels';

export type ChargeRowProps = {
  charge: ChargeListItemDTO;
  /** Where the row sits in the list, so separately rendered rows read as one grouped surface (ui-rules.md §5.3). */
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (charge: ChargeListItemDTO) => void;
};

/** One charge: who owes it, what for and by when, the amount over its status (a part-paid charge also shows what is left). */
function ChargeRowBase({ charge, position, onPress }: ChargeRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const name = chargeMemberName(charge);
  const statusLabel = chargeStatusLabel(charge);
  const partPaid = !charge.isVoided && Number(charge.totalPaid) > 0 && Number(charge.balance) > 0;
  const second = charge.dueDate ? `Due ${formatDate(charge.dueDate, 'long')}` : `Created ${formatDate(charge.createdAt, 'long')}`;

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(charge)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${charge.category.name}, ${statusLabel}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`charge-row-${charge.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1} className={charge.isVoided ? 'opacity-60' : undefined}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {charge.category.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {second}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={charge.amount} size="body-strong" tone={charge.isVoided ? 'secondary' : 'default'} />
          {partPaid ? (
            <Text variant="caption" tone="secondary">
              <Money value={charge.balance} size="caption" tone="secondary" />
              {' left'}
            </Text>
          ) : null}
          <StatusChip status={chargeStatusKey(charge)} label={statusLabel} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const ChargeRow = memo(ChargeRowBase);
