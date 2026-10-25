import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { FileText } from 'lucide-react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Divider } from '@/components/ui/Divider';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useMyLedgerSummary, useMyLedgerEntries } from '@/features/memberLedger/queries';
import { formatDate } from '@/lib/dates';
import { formatMoney, toDecimal } from '@/lib/money';
import type { MemberLedgerEntryDTO } from '@/types/api/memberLedger';
import type { Decimal } from 'decimal.js-light';

type DecimalisedEntry = Omit<MemberLedgerEntryDTO, 'amount' | 'runningBalance'> & {
  amount: Decimal;
  runningBalance: Decimal;
};

type MonthHeader = { kind: 'header'; monthLabel: string };
type EntryItem = { kind: 'entry'; entry: DecimalisedEntry };
type ListItem = MonthHeader | EntryItem;

function getMonthLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'long' });
}

function groupByMonth(entries: DecimalisedEntry[]): ListItem[] {
  const result: ListItem[] = [];
  let currentMonth = '';

  for (const entry of entries) {
    const month = getMonthLabel(entry.effectiveDate);
    if (month !== currentMonth) {
      result.push({ kind: 'header', monthLabel: month });
      currentMonth = month;
    }
    result.push({ kind: 'entry', entry });
  }
  return result;
}

const CATEGORY_ROUTE: Record<string, string> = {
  LEVY: '/(app)/(tabs)/money/levies',
  DUES: '/(app)/(tabs)/money/dues',
  PENALTY: '/(app)/(tabs)/money/penalties',
  DONATION: '/(app)/(tabs)/money/donations',
};

function LedgerEntryRow({ entry }: { entry: DecimalisedEntry }) {
  const { color } = useThemeTokens();
  const isCredit = entry.entryType === 'CREDIT';
  const route = CATEGORY_ROUTE[entry.category];

  return (
    <Pressable
      onPress={route ? () => router.push(route as never) : undefined}
      accessibilityRole={route ? 'button' : 'text'}
      className="flex-row items-center px-4 py-3 min-h-[56px] active:opacity-70"
    >
      <View className="flex-1">
        <Text variant="body-lg" numberOfLines={1}>
          {entry.description}
        </Text>
        <Text variant="caption" tone="secondary">
          {formatDate(entry.effectiveDate, 'short')} · {entry.category}
        </Text>
      </View>
      <View className="ml-3 items-end gap-0.5">
        <Text
          variant="body-strong"
          style={{ color: isCredit ? color.success : color.danger }}
        >
          {isCredit ? '+' : '–'}{formatMoney(entry.amount)}
        </Text>
        <Money value={entry.runningBalance} size="caption" tone="secondary" />
      </View>
    </Pressable>
  );
}

function MonthHeaderRow({ label }: { label: string }) {
  return (
    <View className="px-4 pb-1 pt-4 bg-surface-sunken">
      <Text variant="label" tone="secondary" className="uppercase tracking-wide">
        {label}
      </Text>
    </View>
  );
}

export default function LedgerScreen() {
  const { color } = useThemeTokens();

  const summaryQuery = useMyLedgerSummary();
  const entriesQuery = useMyLedgerEntries();

  const allEntries = useMemo((): DecimalisedEntry[] => {
    if (!entriesQuery.data) return [];
    return entriesQuery.data.pages.flatMap((p) => p.entries) as DecimalisedEntry[];
  }, [entriesQuery.data]);

  const listItems = useMemo(() => groupByMonth(allEntries), [allEntries]);

  const handleEndReached = useCallback(() => {
    if (entriesQuery.hasNextPage && !entriesQuery.isFetchingNextPage) {
      entriesQuery.fetchNextPage();
    }
  }, [entriesQuery]);

  const refreshing = [summaryQuery, entriesQuery].some((q) => q.isRefetching);
  function handleRefresh() {
    summaryQuery.refetch();
    entriesQuery.refetch();
  }

  const summary = summaryQuery.data;

  return (
    <Screen edges={['top']} scroll={false} refreshing={refreshing} onRefresh={handleRefresh}>
      <ScreenHeader
        title="My Ledger"
        docsKey="M6"
        onBack={() => router.back()}
        rightActions={
          <IconButton
            icon={FileText}
            accessibilityLabel="Export statement"
            onPress={() => router.push('/money/ledger/statement')}
          />
        }
      />

      {/* Balance summary strip */}
      {summary ? (
        <View className="flex-row items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">Balance</Text>
            <Money value={summary.currentBalance} size="body-strong" />
          </View>
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">Charged</Text>
            <Money value={summary.totalDebits} size="body-strong" />
          </View>
          <View className="items-center gap-0.5">
            <Text variant="caption" tone="secondary">Paid</Text>
            <Money value={summary.totalCredits} size="body-strong" />
          </View>
        </View>
      ) : null}

      {entriesQuery.isPending ? (
        <View className="gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={56} radius="md" />
          ))}
        </View>
      ) : listItems.length === 0 ? (
        <EmptyState
          title="No ledger entries"
          description="Transactions and payments will appear here once they are recorded."
        />
      ) : (
        <FlatList<ListItem>
          data={listItems}
          keyExtractor={(item, index) =>
            item.kind === 'header' ? `h-${item.monthLabel}` : `e-${item.entry.id}-${index}`
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ItemSeparatorComponent={() => <Divider />}
          getItemLayout={(_data, index) => ({ length: 56, offset: 56 * index, index })}
          renderItem={({ item }: { item: ListItem }) => {
            if (item.kind === 'header') {
              return <MonthHeaderRow label={item.monthLabel} />;
            }
            return <LedgerEntryRow entry={item.entry} />;
          }}
          ListFooterComponent={
            entriesQuery.isFetchingNextPage ? (
              <View className="items-center py-6">
                <ActivityIndicator color={color.primary} />
              </View>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
