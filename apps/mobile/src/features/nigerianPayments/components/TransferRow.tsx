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
import type { BankTransferListItemDTO } from '@/types/api/bankManage';
import { TRANSFER_STATUS_LABELS, transferMemberName } from '../labels';

export type TransferRowProps = {
  transfer: BankTransferListItemDTO;
  /** Where the row sits in the list, so separately rendered rows read as one grouped surface (ui-rules.md §5.3). */
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (transfer: BankTransferListItemDTO) => void;
};

/** One transfer: who it came from, its reference and date, the amount over its status. */
function TransferRowBase({ transfer, position, onPress }: TransferRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const title = transferMemberName(transfer) ?? transfer.senderAccountName ?? transfer.senderBankName;
  const statusLabel = TRANSFER_STATUS_LABELS[transfer.status];

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(transfer)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, reference ${transfer.reference}, ${statusLabel}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`transfer-row-${transfer.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${transfer.reference} · ${formatDate(transfer.transferDate, 'long')}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {transfer.senderBankName}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={transfer.amount} size="body-strong" />
          <StatusChip status={transfer.status.toLowerCase()} label={statusLabel} />
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const TransferRow = memo(TransferRowBase);
