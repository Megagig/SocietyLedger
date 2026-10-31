'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Alert, Anchor, Card, Group, Loader, Pagination, Select, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconArrowLeft, IconBook, IconSearch } from '@tabler/icons-react';
import { accountingApi, Ledger } from '@/lib/api/accounting';
import { entryHref, formatNaira, LEDGER_DATE_OPTIONS, ledgerHref, ledgerRange, type LedgerDates } from '@/lib/accounting-drill';

const TYPE_NAMES: Record<string, string> = { ASSET: 'Asset', LIABILITY: 'Liability', EQUITY: 'Equity', INCOME: 'Income', EXPENSE: 'Expense' };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * What makes up an account's balance: every posted line, in order, with the balance after it. Opening + movement = closing, and the
 * closing figure is the one on the page that opened this. Opened from the chart of accounts, a statement, a budget line or the
 * dashboard; each line opens its journal entry, and that opens the record behind it.
 */
export default function LedgerPage() {
  const params = useSearchParams();
  const accountId = params.get('accountId');
  const accountIds = params.get('accountIds');
  const scope = params.get('scope');
  const title = params.get('title');
  const openedFrom = params.get('from') ?? undefined;
  const openedTo = params.get('to') ?? undefined;
  const datesLabel = params.get('datesLabel');

  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [dates, setDates] = useState<LedgerDates>('opened');
  const [page, setPage] = useState(1);
  const range = useMemo(() => ledgerRange(dates, { from: openedFrom, to: openedTo }), [dates, openedFrom, openedTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-ledger', accountId, accountIds, scope, range.from, range.to, debounced, page],
    queryFn: () =>
      accountingApi.getLedger({
        accountId: accountId ? Number(accountId) : undefined,
        accountIds: accountIds ?? undefined,
        scope: scope ?? undefined,
        from: range.from,
        to: range.to,
        search: debounced || undefined,
        page,
        limit: 30,
      }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const ledger: Ledger | undefined = data?.data;
  const single = ledger && ledger.accounts.length === 1 ? ledger.accounts[0] : null;
  const heading = title || single?.name || 'Ledger';

  const datesText = !ledger
    ? ''
    : ledger.range.from && ledger.range.to
      ? `${day(ledger.range.from)} to ${day(ledger.range.to)}`
      : ledger.range.to
        ? `Everything posted up to ${day(ledger.range.to)}`
        : ledger.range.from
          ? `Everything posted from ${day(ledger.range.from)}`
          : 'Everything posted so far';
  const caption = [single ? `${single.code} · ${TYPE_NAMES[single.type] ?? single.type}` : ledger ? `${ledger.accounts.length} accounts together` : '', datesText].filter(Boolean).join(' · ');

  const dateOptions = LEDGER_DATE_OPTIONS.map((o) => (o.value === 'opened' && datesLabel ? { ...o, label: datesLabel } : { ...o }));
  const carried = { from: range.from, to: range.to, datesLabel: datesLabel ?? undefined };
  const multiple = (ledger?.accounts.length ?? 1) > 1;

  return (
    <div>
      <Anchor component={Link} href="/dashboard/accounting/chart-of-accounts" size="sm" c="dimmed" className="inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={14} /> Chart of accounts
      </Anchor>

      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">{heading}</h1>
        <p className="text-gray-600 dark:text-gray-400" data-testid="ledger-caption">
          {caption || 'Every posted entry behind this figure'}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : error || !ledger ? (
        <Alert icon={<IconBook size={20} />} title="Unable to open this ledger" color="red">
          <Text size="sm">{(error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'The ledger could not be loaded. Try again.'}</Text>
        </Alert>
      ) : (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 2, md: 4 }} data-testid="ledger-summary">
            {[
              ['Opening balance', ledger.opening, 'ledger-opening'],
              ['Debits', ledger.totalDebit, 'ledger-debits'],
              ['Credits', ledger.totalCredit, 'ledger-credits'],
              ['Closing balance', ledger.closing, 'ledger-closing'],
            ].map(([label, value, testId]) => (
              <Card key={String(testId)} withBorder padding="md" data-testid={String(testId)}>
                <Text size="xs" c="dimmed">
                  {String(label)}
                </Text>
                <Text size="xl" fw={700}>
                  {formatNaira(value as string)}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          {ledger.subAccounts.length > 0 ? (
            <Card withBorder padding="md" data-testid="ledger-sub-accounts">
              <Text fw={600} mb="xs">
                Sub-accounts
              </Text>
              <Table>
                <Table.Tbody>
                  {ledger.subAccounts.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>
                        <Anchor component={Link} href={ledgerHref({ accountId: s.id, title: s.name, ...carried })} data-testid={`ledger-sub-${s.id}`}>
                          {s.code} - {s.name}
                        </Anchor>
                      </Table.Td>
                      <Table.Td ta="right">{formatNaira(s.balance)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          ) : null}

          <Group align="flex-end">
            <TextInput
              label="Search"
              placeholder="Description or entry number"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value);
                setPage(1);
              }}
              className="flex-1 min-w-[220px]"
              data-testid="ledger-search"
            />
            <Select
              label="Dates"
              data={dateOptions}
              value={dates}
              onChange={(v) => {
                setDates((v as LedgerDates) ?? 'opened');
                setPage(1);
              }}
              allowDeselect={false}
              w={200}
            />
          </Group>
          {debounced ? (
            <Text size="sm" c="dimmed" data-testid="ledger-matches">
              {ledger.pagination.totalCount} matching {ledger.pagination.totalCount === 1 ? 'line' : 'lines'}. The balances are for the whole ledger.
            </Text>
          ) : null}

          <Card withBorder padding={0}>
            <Table.ScrollContainer minWidth={720}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Entry</Table.Th>
                    <Table.Th>Description</Table.Th>
                    {multiple ? <Table.Th>Account</Table.Th> : null}
                    <Table.Th ta="right">Debit</Table.Th>
                    <Table.Th ta="right">Credit</Table.Th>
                    <Table.Th ta="right">Balance</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ledger.lines.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={multiple ? 7 : 6}>
                        <Text c="dimmed" ta="center" py="md">
                          Nothing posted. Entries appear here once they are posted to the books.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    ledger.lines.map((line) => {
                      const debit = Number(line.debit) > 0;
                      return (
                        <Table.Tr key={line.lineId} data-testid={`ledger-line-${line.lineId}`}>
                          <Table.Td>{line.entryDate ? day(line.entryDate) : ''}</Table.Td>
                          <Table.Td>
                            <Anchor component={Link} href={entryHref(line.entryId)} data-testid={`ledger-entry-${line.lineId}`}>
                              {line.entryNumber}
                            </Anchor>
                          </Table.Td>
                          <Table.Td>{line.lineDescription || line.entryDescription}</Table.Td>
                          {multiple ? <Table.Td>{line.accountName}</Table.Td> : null}
                          <Table.Td ta="right">{debit ? formatNaira(line.debit) : ''}</Table.Td>
                          <Table.Td ta="right">{!debit ? formatNaira(line.credit) : ''}</Table.Td>
                          <Table.Td ta="right" fw={500}>
                            {formatNaira(line.balance)}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>

          {ledger.pagination.totalPages > 1 ? (
            <Group justify="center">
              <Pagination total={ledger.pagination.totalPages} value={page} onChange={setPage} />
            </Group>
          ) : null}
        </Stack>
      )}
    </div>
  );
}
