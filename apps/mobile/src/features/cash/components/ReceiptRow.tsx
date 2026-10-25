import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { CashReceiptDTO } from '@/types/api/cash';

export type ReceiptRowProps = {
  receipt: CashReceiptDTO;
  position: 'first' | 'middle' | 'last' | 'only';
  /** Tapping a receipt opens its actions (void) — only offered when the caller can act on it. */
  onPress?: (receipt: CashReceiptDTO) => void;
};

/** One receipt inside a collection: the member, what was paid, the receipt number, the total — dimmed when voided. */
function ReceiptRowBase({ receipt, position, onPress }: ReceiptRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const voided = receipt.status === 'VOIDED';
  const what = receipt.items.map((i) => i.label).join(', ');

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={onPress ? () => onPress(receipt) : undefined}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${receipt.member.name}, receipt ${receipt.receiptNumber}${voided ? ', voided' : ''}`}
        android_ripple={onPress ? { color: `${color.primary}1F` } : undefined}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`receipt-row-${receipt.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1} className={voided ? 'opacity-60' : undefined}>
            {receipt.member.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {what}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${receipt.receiptNumber} · ${formatDate(receipt.createdAt, 'time')}`}
          </Text>
          {voided && receipt.voidReason ? (
            <Text variant="caption" tone="danger" numberOfLines={2}>
              {`Voided: ${receipt.voidReason}`}
            </Text>
          ) : null}
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={receipt.total} size="body-strong" tone={voided ? 'secondary' : 'default'} />
          {voided ? <StatusChip status="cancelled" label="Voided" /> : null}
        </View>
      </Pressable>
    </View>
  );
}

export const ReceiptRow = memo(ReceiptRowBase);
