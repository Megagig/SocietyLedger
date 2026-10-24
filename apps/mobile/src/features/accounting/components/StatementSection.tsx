import { View } from 'react-native';

import { Divider } from '@/components/ui/Divider';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import type { AccountBalanceDTO } from '@/types/api/accounting';

/**
 * One part of a financial statement: a heading, a line for each account that holds something, and a total. An empty part says so
 * instead of showing nothing.
 */
export function StatementSection({
  title,
  rows,
  totalLabel,
  total,
  emptyText = 'Nothing yet',
  testID,
}: {
  title: string;
  rows: Pick<AccountBalanceDTO, 'accountName' | 'balance'>[];
  totalLabel: string;
  total: string | number;
  emptyText?: string;
  testID?: string;
}) {
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
          rows.map((row, i) => (
            <View key={`${row.accountName}-${i}`}>
              {i > 0 ? <Divider /> : null}
              <View className="min-h-[48px] flex-row items-center justify-between gap-3 px-4 py-3">
                <Text variant="body" className="flex-1" numberOfLines={2}>
                  {row.accountName}
                </Text>
                <Money value={row.balance} size="body" />
              </View>
            </View>
          ))
        )}
        <Divider />
        <View className="min-h-[48px] flex-row items-center justify-between gap-3 bg-surface-sunken px-4 py-3">
          <Text variant="body-strong">{totalLabel}</Text>
          <Money value={total} size="body-strong" />
        </View>
      </View>
    </View>
  );
}
