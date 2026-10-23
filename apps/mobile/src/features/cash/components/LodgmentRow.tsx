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
import type { CashLodgmentDTO } from '@/types/api/cash';
import { LODGMENT_STATUS_LABELS } from '../labels';

export type LodgmentRowProps = {
  lodgment: CashLodgmentDTO;
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (lodgment: CashLodgmentDTO) => void;
};

/** One lodgment: the bank it went into, who paid it in and when, the amount over its status — with a flag when it was lodged short. */
function LodgmentRowBase({ lodgment, position, onPress }: LodgmentRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const statusLabel = LODGMENT_STATUS_LABELS[lodgment.status];

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(lodgment)}
        accessibilityRole="button"
        accessibilityLabel={`${lodgment.bankAccount.bankName}, lodged by ${lodgment.lodgedBy.name}, ${statusLabel}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`lodgment-row-${lodgment.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {lodgment.bankAccount.bankName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${lodgment.lodgedBy.name} · ${formatDate(lodgment.depositDate, 'long')}`}
          </Text>
          {lodgment.shortfall > 0 ? (
            <Text variant="caption" tone="danger" numberOfLines={1}>
              Lodged short
            </Text>
          ) : null}
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={lodgment.amount} size="body-strong" />
          <StatusChip status={lodgment.status.toLowerCase()} label={statusLabel} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const LodgmentRow = memo(LodgmentRowBase);
