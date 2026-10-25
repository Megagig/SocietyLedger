import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ChargeRowDTO, PaymentRowDTO } from '@/types/api/reports';
import { CHARGE_STATUS_LABELS, chargeStatusKey } from '../labels';

/**
 * A figure on a report that can be tapped: it opens the records that add up to it. The chevron says so, and the screen reader hears
 * "opens the list". A figure with nothing behind it (zero) is shown plainly and can't be tapped.
 */
export function DrillFigure({
  label,
  value,
  caption,
  onPress,
  tone = 'default',
  format = 'money',
  testID,
}: {
  label: string;
  value: string | number;
  /** money (₦10,000.00) or a plain count */
  format?: 'money' | 'count';
  caption?: string;
  onPress?: () => void;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  testID?: string;
}) {
  const { color } = useThemeTokens();
  const empty = Number(value) === 0;
  const tappable = !!onPress && !empty;
  const body = (
    <View className={cn('min-w-[140px] flex-1 gap-1 rounded-lg border border-border bg-surface p-3 dark:border-transparent')}>
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="secondary" numberOfLines={2} className="flex-1">
          {label}
        </Text>
        {tappable ? <ChevronRight size={16} color={color.textTertiary} strokeWidth={1.75} /> : null}
      </View>
      {format === 'count' ? (
        <Text variant="h3" tone={tone === 'default' ? 'default' : tone}>
          {Number(value).toLocaleString('en-NG')}
        </Text>
      ) : (
        <Money value={value} size="h3" tone={tone === 'default' ? 'default' : tone} />
      )}
      {caption ? (
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
  if (!tappable) return <View testID={testID}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. Opens the list.`} testID={testID} className="flex-1">
      {body}
    </Pressable>
  );
}

/** One charge: who owes it, what for, how much, and where it stands. Opens the charge. */
function ChargeRowBase({ item, position, onPress }: { item: ChargeRowDTO; position: RowPosition; onPress?: (item: ChargeRowDTO) => void }) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.memberName}, ${item.categoryName}, ${CHARGE_STATUS_LABELS[item.status] ?? item.status}`}
      testID={`charge-row-${item.id}`}
      minHeight={84}
    >
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {item.memberName}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.categoryName} · ${item.memberNumber}`}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Money value={item.balance} size="body-strong" />
            <StatusChip status={chargeStatusKey(item.status)} label={CHARGE_STATUS_LABELS[item.status] ?? item.status} />
          </View>
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`Charged ${formatDate(item.createdAt, 'long')}${item.dueDate ? ` · due ${formatDate(item.dueDate, 'long')}` : ''}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const ChargeRow = memo(ChargeRowBase);

/** One payment: who paid, for what, how much, and when. Opens the charge it paid. */
function PaymentRowBase({ item, position, onPress }: { item: PaymentRowDTO; position: RowPosition; onPress?: (item: PaymentRowDTO) => void }) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.memberName} paid ${item.categoryName}`}
      testID={`payment-row-${item.id}`}
      minHeight={72}
    >
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {item.memberName}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.categoryName} · ${formatDate(item.paymentDate, 'long')}`}
            </Text>
          </View>
          <Money value={item.amountPaid} size="body-strong" tone="success" />
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {[item.paymentMethod, item.receiptNumber ? `Receipt ${item.receiptNumber}` : null, item.chargeVoided ? 'For a charge that was cancelled' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const PaymentRow = memo(PaymentRowBase);
