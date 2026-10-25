import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { EntrySourceDTO, LedgerDTO, LedgerLineDTO } from '@/types/api/accounting';
import { lineSide, SOURCE_OPEN_LABELS, sourceHref } from '../labels';

/** One posted line of a ledger: what it was for, which entry, the amount on its side, and the balance after it. Opens the entry. */
function LedgerLineRowBase({ item, position, showAccount, onPress }: { item: LedgerLineDTO; position: RowPosition; showAccount: boolean; onPress?: (item: LedgerLineDTO) => void }) {
  const debit = lineSide(item) === 'Debit';
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.entryNumber}, ${item.entryDescription}, ${debit ? 'debit' : 'credit'}`}
      testID={`ledger-line-${item.lineId}`}
      minHeight={76}
    >
      <View className="gap-1">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text variant="body-lg" numberOfLines={2}>
              {item.lineDescription || item.entryDescription}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.entryNumber} · {item.entryDate ? formatDate(item.entryDate, 'long') : ''}
              {showAccount ? ` · ${item.accountName}` : ''}
            </Text>
          </View>
          <View className="items-end">
            <Money value={debit ? item.debit : item.credit} size="body-strong" />
            <Text variant="caption" tone="secondary">
              {debit ? 'Debit' : 'Credit'}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="tertiary">
            Balance after
          </Text>
          <Money value={item.balance} size="caption" tone="secondary" />
        </View>
      </View>
    </GroupedRow>
  );
}
export const LedgerLineRow = memo(LedgerLineRowBase);

/** The four figures that make a ledger add up: where it opened, what went in and out, and where it closed. */
export function LedgerSummary({ ledger, caption }: { ledger: Pick<LedgerDTO, 'opening' | 'totalDebit' | 'totalCredit' | 'closing'>; caption: string }) {
  const figure = (label: string, value: string | number, testID: string, strong = false) => (
    <View className="min-w-[44%] flex-1 gap-0.5" testID={testID}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Money value={value} size={strong ? 'h3' : 'body-strong'} />
    </View>
  );
  return (
    <View className="mb-3 gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="ledger-summary">
      <Text variant="caption" tone="secondary">
        {caption}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {figure('Opening balance', ledger.opening, 'ledger-opening')}
        {figure('Closing balance', ledger.closing, 'ledger-closing', true)}
        {figure('Debits', ledger.totalDebit, 'ledger-debits')}
        {figure('Credits', ledger.totalCredit, 'ledger-credits')}
      </View>
    </View>
  );
}

/** Where an automatic entry came from: the record behind it in plain facts, with a button to open it. Not shown for an entry an officer wrote. */
export function SourceCard({ source, onOpen }: { source: EntrySourceDTO; onOpen: (href: string) => void }) {
  const href = sourceHref(source);
  return (
    <View className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID="entry-source">
      <Text variant="label" tone="secondary">
        {source.title}
      </Text>
      <Text variant="body-lg">{source.summary}</Text>
      {!source.missing ? (
        <View className="gap-1">
          {source.amount !== null ? <Money value={source.amount} size="body-strong" /> : null}
          <Text variant="caption" tone="secondary">
            {[source.date ? formatDate(source.date, 'long') : null, source.status, source.reference ? `Ref ${source.reference}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      {href ? (
        <Button variant="secondary" fullWidth onPress={() => onOpen(href)} testID="entry-source-open">
          {SOURCE_OPEN_LABELS[source.kind]}
        </Button>
      ) : null}
    </View>
  );
}

/** A tappable account in a list of sub-accounts, with a chevron. */
export function SubAccountRow({ code, name, balance, onPress, testID }: { code: string; name: string; balance: string | number; onPress: () => void; testID?: string }) {
  const { color } = useThemeTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${code} ${name}. Opens its ledger.`} testID={testID} className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-3">
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" tone="secondary">
          {code}
        </Text>
      </View>
      <Money value={balance} size="body-strong" />
      <ChevronRight size={16} color={color.textTertiary} strokeWidth={1.75} />
    </Pressable>
  );
}
