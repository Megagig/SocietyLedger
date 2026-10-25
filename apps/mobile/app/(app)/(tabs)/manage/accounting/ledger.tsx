import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Pencil } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Divider } from '@/components/ui/Divider';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { LedgerLineRow, LedgerSummary, SubAccountRow } from '@/features/accounting/components/LedgerParts';
import { ACCOUNT_TYPE_LABELS, ACCOUNTING_EDIT_ACCESS, entryHref, LEDGER_DATE_OPTIONS, ledgerHref, ledgerRange, type LedgerDates } from '@/features/accounting/labels';
import { useAccountingAccess, useLedgerInfinite } from '@/features/accounting/queries';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import type { LedgerLineDTO } from '@/types/api/accounting';

type Params = { accountId?: string; accountIds?: string; scope?: string; title?: string; from?: string; to?: string; datesLabel?: string };

/**
 * project-overview.md §6.9 AC2 — what makes up an account's balance: every posted line, in order, with the balance after it.
 * Opening + movement = closing, and the closing figure is the one on the screen that opened this. Opened from the chart of accounts,
 * a statement, a budget line or the dashboard; each line opens its journal entry, and that opens the record behind it.
 */
export default function LedgerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const allowed = useAccountingAccess();
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const [search, setSearch] = useState('');
  const [dates, setDates] = useState<LedgerDates>('opened');
  const range = useMemo(() => ledgerRange(dates, { from: params.from, to: params.to }), [dates, params.from, params.to]);
  const accountId = params.accountId ? Number(params.accountId) : undefined;
  const query = useLedgerInfinite({ accountId, accountIds: params.accountIds, scope: params.scope, from: range.from, to: range.to, search: search.trim() || undefined });
  const first = query.data?.pages[0];
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.lines) ?? [], [query.data]);
  const back = () => router.back();
  const title = params.title || first?.accounts[0]?.name || 'Ledger';

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Ledger" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const single = first && first.accounts.length === 1 ? first.accounts[0] : null;
  const datesText = !first
    ? ''
    : first.range.from && first.range.to
      ? `${formatDate(first.range.from, 'long')} to ${formatDate(first.range.to, 'long')}`
      : first.range.to
        ? `Everything posted up to ${formatDate(first.range.to, 'long')}`
        : first.range.from
          ? `Everything posted from ${formatDate(first.range.from, 'long')}`
          : 'Everything posted so far';
  const caption = [single ? `${single.code} · ${ACCOUNT_TYPE_LABELS[single.type].replace(/s$/, '')}` : first ? `${first.accounts.length} accounts together` : '', datesText].filter(Boolean).join(' · ');
  const openRange = { from: range.from, to: range.to };

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title={title}
        onBack={back}
        docsKey="AC2"
        rightActions={
          single && canEdit ? (
            <IconButton icon={Pencil} accessibilityLabel="Change this account" onPress={() => router.push(`/(app)/(tabs)/manage/accounting/account-form?id=${single.id}` as never)} testID="ledger-edit" />
          ) : undefined
        }
      />
      <View className="gap-3 pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by description or entry number" testID="ledger-search" />
        <OptionDropdown
          label="Dates"
          value={dates}
          options={LEDGER_DATE_OPTIONS.map((o) => (o.value === 'opened' && params.datesLabel ? { ...o, label: params.datesLabel } : o))}
          onChange={setDates}
          testID="ledger-dates"
        />
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(l) => String(l.lineId)}
        skeletonHeight={76}
        header={
          first ? (
            <View>
              <LedgerSummary ledger={first} caption={caption} />
              {first.subAccounts.length > 0 ? (
                <View className="mb-3">
                  <Section title="Sub-accounts">
                    <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent" testID="ledger-sub-accounts">
                      {first.subAccounts.map((s, i) => (
                        <View key={s.id}>
                          {i > 0 ? <Divider /> : null}
                          <SubAccountRow
                            code={s.code}
                            name={s.name}
                            balance={s.balance}
                            onPress={() => router.push(ledgerHref({ accountId: s.id, title: s.name, ...openRange, datesLabel: params.datesLabel }) as never)}
                            testID={`ledger-sub-${s.id}`}
                          />
                        </View>
                      ))}
                    </View>
                  </Section>
                </View>
              ) : null}
              {search.trim() ? (
                <Text variant="caption" tone="secondary" className="mb-2" testID="ledger-matches">
                  {`${first.pagination.totalCount} matching ${first.pagination.totalCount === 1 ? 'line' : 'lines'}. The balances are for the whole ledger.`}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
        renderItem={(l: LedgerLineDTO, i, n) => (
          <LedgerLineRow item={l} position={positionOf(i, n)} showAccount={(first?.accounts.length ?? 1) > 1} onPress={(line) => router.push(entryHref(line.entryId) as never)} />
        )}
        empty={
          <EmptyState
            icon={BookOpen}
            title="Nothing posted"
            description={search.trim() || dates !== 'opened' ? 'No posted entries match. Try other dates or a different search.' : 'Entries appear here once they are posted to the books.'}
          />
        }
      />
    </Screen>
  );
}
