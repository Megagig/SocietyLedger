'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Checkbox, Group, Loader, Modal, Pagination, SegmentedControl, Stack, Table, Tabs, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import api from '@/lib/axios';
import { nigerianPaymentsApi, type MatchRecord, type MatchRequest, type MatchSuggestion } from '@/lib/api/nigerian-payments';
import { useAuthStore } from '@/store/authStore';

const money = (value: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);
const day = (value: string) => new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
const errorText = (error: unknown, fallback: string) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const confidenceLabel = (c: number) => (c >= 90 ? 'Very likely' : c >= 60 ? 'Likely' : 'Possible');
const keyOf = (s: MatchSuggestion) => `${s.source}:${s.statementEntryId ?? s.bankTransferId}:${s.transactionId}`;
const toRequest = (s: MatchSuggestion): MatchRequest => ({
  transactionId: s.transactionId,
  ...(s.statementEntryId ? { statementEntryId: s.statementEntryId } : {}),
  ...(s.bankTransferId ? { bankTransferId: s.bankTransferId } : {}),
  confidence: s.confidence,
  matchType: s.matchType,
});

const STATUS = { PENDING: { label: 'To confirm', color: 'yellow' }, CONFIRMED: { label: 'Confirmed', color: 'green' }, DISPUTED: { label: 'Turned down', color: 'gray' } } as const;

/**
 * Reconciliation: see which charge each line of money received probably paid, propose the matches, and have another officer confirm
 * them. Nothing is recorded as a payment until a match is confirmed, and the amount is always the bank line's own.
 */
export function ReconciliationWorkbench({ initialTab = 'suggested' }: { initialTab?: 'suggested' | 'matches' | 'lines' }) {
  return (
    <Tabs defaultValue={initialTab} keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="suggested">Suggested</Tabs.Tab>
        <Tabs.Tab value="matches">Matches</Tabs.Tab>
        <Tabs.Tab value="lines">Unmatched lines</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="suggested"><Suggested /></Tabs.Panel>
      <Tabs.Panel value="matches"><Matches /></Tabs.Panel>
      <Tabs.Panel value="lines"><Lines /></Tabs.Panel>
    </Tabs>
  );
}

function Suggested() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['reconciliation', 'suggestions'], queryFn: () => nigerianPaymentsApi.getMatchSuggestions(), retry: false });
  // null until the officer ticks or unticks something: until then only the confident suggestions are ticked
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const suggestions = useMemo(() => query.data?.suggestions ?? [], [query.data]);
  const selected = useMemo(() => picked ?? new Set(suggestions.filter((s) => s.recommended).map(keyOf)), [picked, suggestions]);
  const chosen = suggestions.filter((s) => selected.has(keyOf(s)));

  const apply = useMutation({
    mutationFn: () => nigerianPaymentsApi.applyMatches(chosen.map(toRequest)),
    onSuccess: (result) => {
      setPicked(null);
      const why = result.results.find((r) => !r.success)?.error;
      notifications.show(
        result.failed > 0
          ? { title: 'Some matches could not be made', message: `${result.successful} proposed, ${result.failed} could not be: ${why ?? 'see Matches'}`, color: 'orange' }
          : { title: 'Matches proposed', message: `${result.successful} ${result.successful === 1 ? 'match' : 'matches'} proposed. Another officer confirms them.`, color: 'green' },
      );
      void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error) => notifications.show({ title: 'Could not propose the matches', message: errorText(error, 'Try again.'), color: 'red' }),
  });

  const toggle = (s: MatchSuggestion) =>
    setPicked((current) => {
      const next = new Set(current ?? selected);
      const k = keyOf(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  if (query.isLoading) return <Loader />;
  if (query.isError) return <Alert color="red" title="Could not find matches">{errorText(query.error, 'Try again.')}</Alert>;
  const counts = query.data!.counts;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {counts.unmatchedLines} money-in {counts.unmatchedLines === 1 ? 'line' : 'lines'} waiting · {counts.suggested} with a suggestion ({counts.recommended} confident)
        {counts.withoutSuggestion > 0 ? ` · ${counts.withoutSuggestion} need you to choose the charge` : ''}
      </Text>
      <Card withBorder padding="md" className="overflow-x-auto">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr><Table.Th /><Table.Th>Money received</Table.Th><Table.Th>Would pay</Table.Th><Table.Th>Still owes</Table.Th><Table.Th>How sure</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {suggestions.map((s) => (
              <Table.Tr key={keyOf(s)}>
                <Table.Td><Checkbox checked={selected.has(keyOf(s))} onChange={() => toggle(s)} aria-label={`Include the ${s.line.amount} naira to ${s.charge.memberName}`} /></Table.Td>
                <Table.Td>
                  <Text fw={600} c="green">{money(s.line.amount)}</Text>
                  <Text size="xs" c="dimmed" lineClamp={2}>{s.line.description}</Text>
                  <Text size="xs" c="dimmed">{day(s.line.date)}{s.line.reference ? ` · ${s.line.reference}` : ''}{s.source === 'transfer' ? ' · declared transfer' : ''}</Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>{s.charge.memberName}</Text>
                  <Text size="xs" c="dimmed">{s.charge.categoryName}{s.charge.referenceNumber ? ` · ${s.charge.referenceNumber}` : ''} · {s.charge.memberNumber}</Text>
                </Table.Td>
                <Table.Td>{money(s.charge.available)}</Table.Td>
                <Table.Td>
                  <Badge color={s.confidence >= 90 ? 'green' : s.confidence >= 60 ? 'blue' : 'gray'} variant="light">{confidenceLabel(s.confidence)} · {s.confidence}%</Badge>
                  <Text size="xs" c="dimmed" mt={4}>{s.reasons.join(' · ')}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {suggestions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="md">
                    {counts.unmatchedLines > 0 ? 'None of the money received matches a charge closely enough. Open Unmatched lines to choose the charge yourself.' : 'Nothing to match. Import a bank statement to see which charges the money paid.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Card>
      {suggestions.length > 0 ? (
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Nothing is recorded until another officer confirms.</Text>
          <Button disabled={chosen.length === 0} loading={apply.isPending} onClick={() => apply.mutate()}>
            {chosen.length === 0 ? 'Choose matches to propose' : `Propose ${chosen.length} ${chosen.length === 1 ? 'match' : 'matches'} · ${money(chosen.reduce((sum, s) => sum + Number(s.line.amount), 0))}`}
          </Button>
        </Group>
      ) : null}
    </Stack>
  );
}

export function Matches() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user?.id);
  const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'DISPUTED'>('PENDING');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<{ match: MatchRecord; action: 'CONFIRMED' | 'DISPUTED' } | null>(null);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['reconciliation', 'matches', status, page], queryFn: () => nigerianPaymentsApi.getReconciliations({ status, page, limit: 20 }), retry: false });

  const decide = useMutation({
    mutationFn: () => nigerianPaymentsApi.decideMatch(target!.match.id, target!.action, target!.action === 'DISPUTED' ? reason.trim() : undefined),
    onSuccess: () => {
      notifications.show({ title: target!.action === 'CONFIRMED' ? 'Payment recorded' : 'Match turned down', message: target!.action === 'CONFIRMED' ? 'The charge was updated.' : 'The line is free to be matched again.', color: 'green' });
      setTarget(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error) => notifications.show({ title: 'Could not do that', message: errorText(error, 'Try again.'), color: 'red' }),
  });

  const rows = query.data?.reconciliations ?? [];
  const name = (m: MatchRecord) => `${m.transaction.member.firstName} ${m.transaction.member.lastName}`.trim();

  return (
    <Stack gap="md">
      <SegmentedControl
        value={status}
        onChange={(v) => {
          setStatus(v as typeof status);
          setPage(1);
        }}
        data={[
          { value: 'PENDING', label: 'To confirm' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'DISPUTED', label: 'Turned down' },
        ]}
      />
      {query.isLoading ? <Loader /> : null}
      {query.isError ? <Alert color="red">{errorText(query.error, 'Could not load the matches.')}</Alert> : null}
      <Card withBorder padding="md" className="overflow-x-auto">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr><Table.Th>Member</Table.Th><Table.Th>The bank line</Table.Th><Table.Th ta="right">Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((m) => {
              const mine = m.createdBy !== null && m.createdBy === me;
              return (
                <Table.Tr key={m.id}>
                  <Table.Td>
                    <Link href={`/dashboard/finance/transactions/${m.transaction.id}`} className="underline decoration-dotted underline-offset-4">{name(m)}</Link>
                    <Text size="xs" c="dimmed">{m.transaction.category.name}{m.transaction.referenceNumber ? ` · ${m.transaction.referenceNumber}` : ''}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>{m.statementEntry ? m.statementEntry.description : m.bankTransfers[0] ? `Transfer ${m.bankTransfers[0].reference} from ${m.bankTransfers[0].senderBankName}` : 'A declared transfer'}</Text>
                    <Text size="xs" c="dimmed">{m.statementEntry ? day(m.statementEntry.transactionDate) : day(m.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>{money(m.matchedAmount)}</Table.Td>
                  <Table.Td><Badge color={STATUS[m.status].color} variant="light">{STATUS[m.status].label}</Badge></Table.Td>
                  <Table.Td>
                    {m.status === 'PENDING' ? (
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <Button size="xs" variant="default" onClick={() => setTarget({ match: m, action: 'DISPUTED' })}>Turn down</Button>
                        {mine ? null : <Button size="xs" onClick={() => setTarget({ match: m, action: 'CONFIRMED' })}>Confirm</Button>}
                      </Group>
                    ) : null}
                    {m.status === 'PENDING' && mine ? <Text size="xs" c="dimmed" ta="right">You proposed this, so another officer confirms it.</Text> : null}
                  </Table.Td>
                </Table.Tr>
              );
            })}
            {!query.isLoading && rows.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Nothing here.</Text></Table.Td></Table.Tr> : null}
          </Table.Tbody>
        </Table>
      </Card>
      {query.data && query.data.pagination.totalPages > 1 ? <Group justify="center"><Pagination total={query.data.pagination.totalPages} value={page} onChange={setPage} /></Group> : null}

      <Modal opened={target !== null} onClose={() => setTarget(null)} title={target?.action === 'CONFIRMED' ? 'Confirm this match?' : 'Turn this match down?'} centered>
        {target ? (
          <Stack>
            <Text size="sm">
              {target.action === 'CONFIRMED'
                ? `This records ${money(target.match.matchedAmount)} as paid by ${name(target.match)}, dated the day it reached the bank. It can’t be undone.`
                : 'The bank line goes back to Unmatched so it can be matched to the right charge. Nothing is recorded.'}
            </Text>
            {target.action === 'DISPUTED' ? <Textarea label="Why is it wrong?" value={reason} onChange={(e) => setReason(e.currentTarget.value)} minRows={2} placeholder="For example: a different member" /> : null}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setTarget(null)}>Not yet</Button>
              <Button loading={decide.isPending} disabled={target.action === 'DISPUTED' && reason.trim().length < 3} onClick={() => decide.mutate()}>
                {target.action === 'CONFIRMED' ? 'Confirm and record payment' : 'Turn it down'}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}

export function Lines() {
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<{ id: number; amount: number; description: string } | null>(null);
  const query = useQuery({ queryKey: ['reconciliation', 'lines', page], queryFn: () => nigerianPaymentsApi.getStatementEntries({ matchStatus: 'UNMATCHED', creditsOnly: true, page, limit: 20 }), retry: false });
  const rows = query.data?.entries ?? [];
  return (
    <Stack gap="md">
      {query.isLoading ? <Loader /> : null}
      {query.isError ? <Alert color="red">{errorText(query.error, 'Could not load the lines.')}</Alert> : null}
      <Card withBorder padding="md" className="overflow-x-auto">
        <Table highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Date</Table.Th><Table.Th>Description</Table.Th><Table.Th>Account</Table.Th><Table.Th ta="right">Money received</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {rows.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{day(e.transactionDate)}</Table.Td>
                <Table.Td><Text size="sm" lineClamp={2}>{e.description}</Text>{e.reference ? <Text size="xs" c="dimmed">{e.reference}</Text> : null}</Table.Td>
                <Table.Td>{e.import.bankAccount.bankName}</Table.Td>
                <Table.Td ta="right" fw={600} c="green">{money(e.creditAmount)}</Table.Td>
                <Table.Td ta="right"><Button size="xs" variant="light" onClick={() => setChosen({ id: e.id, amount: Number(e.creditAmount), description: e.description })}>Choose the charge</Button></Table.Td>
              </Table.Tr>
            ))}
            {!query.isLoading && rows.length === 0 ? <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Every line is matched.</Text></Table.Td></Table.Tr> : null}
          </Table.Tbody>
        </Table>
      </Card>
      {query.data && query.data.pagination.totalPages > 1 ? <Group justify="center"><Pagination total={query.data.pagination.totalPages} value={page} onChange={setPage} /></Group> : null}
      <ChooseCharge line={chosen} onClose={() => setChosen(null)} />
    </Stack>
  );
}

/** Choose by hand which charge a bank line paid. A charge that owes less than the line, or is already covered, can't be chosen. */
function ChooseCharge({ line, onClose }: { line: { id: number; amount: number; description: string } | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const charges = useQuery({
    queryKey: ['reconciliation', 'charges', search],
    queryFn: async () => {
      const response = await api.get('/finance/transactions', { params: { search: search || undefined, limit: 20 } });
      return (response.data.data.transactions ?? []) as Array<{ id: number; status: string; isVoided: boolean; balance: string | number; referenceNumber: string | null; member: { firstName: string; lastName: string }; category: { name: string } }>;
    },
    enabled: line !== null,
  });
  const propose = useMutation({
    mutationFn: (transactionId: number) => nigerianPaymentsApi.proposeMatch({ transactionId, statementEntryId: line!.id, matchType: 'MANUAL' }),
    onSuccess: () => {
      notifications.show({ title: 'Match proposed', message: 'Another officer confirms it.', color: 'green' });
      void queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
      onClose();
    },
    onError: (error) => notifications.show({ title: 'Could not match the line', message: errorText(error, 'Try again.'), color: 'red' }),
  });
  const open = (charges.data ?? []).filter((c) => !c.isVoided && ['pending', 'partial', 'overdue'].includes(c.status));

  return (
    <Modal opened={line !== null} onClose={onClose} title="Which charge did it pay?" size="lg" centered>
      {line ? (
        <Stack>
          <Text size="sm"><b>{money(line.amount)}</b> · {line.description}</Text>
          <TextInput aria-label="Search" placeholder="Search a member or a charge reference" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
          <Table highlightOnHover>
            <Table.Tbody>
              {open.map((c) => {
                const fits = Number(c.balance) >= line.amount;
                return (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text fw={500}>{c.member.firstName} {c.member.lastName}</Text><Text size="xs" c="dimmed">{c.category.name}{c.referenceNumber ? ` · ${c.referenceNumber}` : ''}</Text></Table.Td>
                    <Table.Td ta="right">{money(c.balance)}<Text size="xs" c={fits ? 'dimmed' : 'red'}>{fits ? 'owes' : 'owes less than the line'}</Text></Table.Td>
                    <Table.Td ta="right"><Button size="xs" disabled={!fits} loading={propose.isPending} onClick={() => propose.mutate(c.id)}>Match</Button></Table.Td>
                  </Table.Tr>
                );
              })}
              {!charges.isLoading && open.length === 0 ? <Table.Tr><Table.Td><Text c="dimmed" ta="center" py="md">No open charges found.</Text></Table.Td></Table.Tr> : null}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : null}
    </Modal>
  );
}
