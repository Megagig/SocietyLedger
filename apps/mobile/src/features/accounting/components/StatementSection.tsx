import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { toDecimal } from '@/lib/money';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { AccountBalanceDTO } from '@/types/api/accounting';

export type StatementRow = Pick<AccountBalanceDTO, 'accountName' | 'balance'> & {
  /** Opens what makes this line up. A line with nothing in it stays plain. */
  onPress?: () => void;
};

/**
 * One part of a financial statement: a heading, a line for each account that holds something, and a total. An empty part says so
 * instead of showing nothing. A line, or the total, can be opened to see the entries that make it up; a chevron says so.
 */
export function StatementSection({
  title,
  rows,
  totalLabel,
  total,
  onOpenTotal,
  emptyText = 'Nothing yet',
  testID,
}: {
  title: string;
  rows: StatementRow[];
  totalLabel: string;
  total: string | number;
  onOpenTotal?: () => void;
  emptyText?: string;
  testID?: string;
}) {
  const { color } = useThemeTokens();
  const chevron = <ChevronRight size={16} color={color.textTertiary} strokeWidth={1.75} />;
  return (
    <View className="gap-2" testID={testID}>
      <Text variant="h3">{title}</Text>
      <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent">
        {rows.length === 0 ? (
          <View className="px-4 py-3">
            <Text variant="body" tone="secondary">
              {emptyText}
            </Text>
          </View>
        ) : (
          rows.map((row, i) => {
            const open = !toDecimal(row.balance).isZero() ? row.onPress : undefined;
            const body = (
              <View className="min-h-[48px] flex-row items-center justify-between gap-3 px-4 py-3">
                <Text variant="body" className="flex-1" numberOfLines={2}>
                  {row.accountName}
                </Text>
                <Money value={row.balance} size="body" />
                {open ? chevron : null}
              </View>
            );
            return (
              <View key={`${row.accountName}-${i}`}>
                {i > 0 ? <Divider /> : null}
                {open ? (
                  <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${row.accountName}. Opens the entries.`} testID={`statement-line-${i}`}>
                    {body}
                  </Pressable>
                ) : (
                  body
                )}
              </View>
            );
          })
        )}
        <Divider />
        {onOpenTotal && !toDecimal(total).isZero() ? (
          <Pressable onPress={onOpenTotal} accessibilityRole="button" accessibilityLabel={`${totalLabel}. Opens the entries.`} testID="statement-total">
            <View className="min-h-[48px] flex-row items-center justify-between gap-3 bg-surface-sunken px-4 py-3">
              <Text variant="body-strong">{totalLabel}</Text>
              <View className="flex-row items-center gap-3">
                <Money value={total} size="body-strong" />
                {chevron}
              </View>
            </View>
          </Pressable>
        ) : (
          <View className="min-h-[48px] flex-row items-center justify-between gap-3 bg-surface-sunken px-4 py-3">
            <Text variant="body-strong">{totalLabel}</Text>
            <Money value={total} size="body-strong" />
          </View>
        )}
      </View>
    </View>
  );
}
