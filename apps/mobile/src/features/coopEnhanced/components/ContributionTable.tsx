import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatMoney } from '@/lib/money';
import type { CoopDashboardDTO, ContributionCellStatus } from '@/types/api/coopEnhanced';
import { CELL_WORDS, MONTH_SHORT, isPositive } from '../labels';

const CELL_BG: Record<ContributionCellStatus, string> = {
  PAID: 'bg-success-soft',
  PARTIAL: 'bg-warning-soft',
  DEFAULTED: 'bg-danger-soft',
  DUE: '',
  NONE: '',
};

const NAME_W = 124;
const CELL_W = 112;

/**
 * What was paid FOR each month, against what the member is expected to pay: one row per savings type plus an "All types" row, scrolling
 * sideways so every figure stays in full. A month is only Defaulted once it is over; the current month is just due. Each cell carries its
 * status in words for a screen reader, so colour is never the only signal.
 */
export function ContributionTable({ table }: { table: CoopDashboardDTO['contributionTable'] }) {
  if (table.rows.length === 0) {
    return (
      <Text variant="body" tone="secondary" className="py-4 text-center">
        {`No contributions are expected or recorded for ${table.year} yet.`}
      </Text>
    );
  }
  const rows = [
    ...table.rows.map((row) => ({ key: String(row.accountTypeId), name: row.name, months: row.months })),
    ...(table.rows.length > 1 ? [{ key: 'total', name: 'All types', months: table.total }] : []),
  ];

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-4">
        {(
          [
            ['PAID', 'Paid'],
            ['PARTIAL', 'Part paid'],
            ['DEFAULTED', 'Defaulted'],
          ] as [ContributionCellStatus, string][]
        ).map(([status, label]) => (
          <View key={status} className="flex-row items-center gap-1.5">
            <View className={`h-3 w-3 rounded-sm border border-border ${CELL_BG[status]}`} />
            <Text variant="caption" tone="secondary">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={`Contribution table for ${table.year}`}>
        <View>
          <View className="flex-row border-b border-border pb-1">
            <View style={{ width: NAME_W }}>
              <Text variant="label" tone="secondary">{String(table.year)}</Text>
            </View>
            {MONTH_SHORT.map((m) => (
              <View key={m} style={{ width: CELL_W }} className="items-center">
                <Text variant="label" tone="secondary">{m}</Text>
              </View>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.key} className="flex-row items-center border-b border-border">
              <View style={{ width: NAME_W }} className="py-2 pr-2">
                <Text variant="body-strong" numberOfLines={2}>{row.name}</Text>
              </View>
              {row.months.map((cell) => (
                <View
                  key={cell.month}
                  style={{ width: CELL_W }}
                  className={`items-center justify-center self-stretch ${CELL_BG[cell.status]}`}
                  accessible
                  accessibilityLabel={`${row.name}, ${MONTH_SHORT[cell.month - 1]} ${table.year}: ${isPositive(cell.paid) ? formatMoney(cell.paid) + ', ' : ''}${CELL_WORDS[cell.status]}`}
                >
                  <Text variant="caption" tone={isPositive(cell.paid) ? 'default' : 'tertiary'}>
                    {isPositive(cell.paid) ? formatMoney(cell.paid) : '–'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
