'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Badge, Button, Card, Group, Pagination, Select, Skeleton, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { formatDate, formatShortDate } from '@/lib/format';
import { billingKeys, formatKobo, send, type BuilderPlan } from '@/lib/billing';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

interface SubRow {
  id: number;
  association: { id: number; name: string; subdomain: string; status: string };
  plan: { id: number; name: string; code: string };
  planVersion: number;
  source: string;
  status: string;
  billingCycle: string;
  priceKobo: number;
  startedAt: string;
  endsAt: string;
  trialEndsAt: string | null;
}
interface SubList { total: number; page: number; limit: number; items: SubRow[] }

function statusBadge(row: SubRow) {
  const ended = new Date(row.endsAt).getTime() < Date.now() && row.status !== 'TRIALING';
  const label = row.status === 'TRIALING' ? 'Free trial' : row.source === 'COMPLIMENTARY' && row.status === 'ACTIVE' ? 'Complimentary' : ended || row.status === 'EXPIRED' ? 'Ended' : row.status === 'PAST_DUE' ? 'In grace' : row.status === 'CANCELLED' ? 'Cancelled' : 'Active';
  const color = label === 'Ended' || label === 'Cancelled' ? 'red' : label === 'In grace' ? 'yellow' : label === 'Free trial' ? 'blue' : 'green';
  return <Badge size="sm" variant="light" color={color}>{label}</Badge>;
}

function SubscriptionsTable({ mode }: { mode: 'all' | 'expired' | 'ending7' | 'ending30' }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const plansQ = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans') });

  const params = new URLSearchParams({ page: String(page), limit: '25' });
  if (debounced) params.set('search', debounced);
  if (planId) params.set('planId', planId);
  if (mode === 'expired') params.set('status', 'EXPIRED');
  if (mode === 'ending7') params.set('endingInDays', '7');
  if (mode === 'ending30') params.set('endingInDays', '30');

  const q = useQuery({ queryKey: billingKeys.subscriptions(params.toString()), queryFn: () => bff<SubList>(`admin/billing/subscriptions?${params.toString()}`) });

  return (
    <Stack gap="md">
      <Group>
        <TextInput
          placeholder="Search association or address…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setDebounced(search.trim()); setPage(1); } }}
          onBlur={() => { setDebounced(search.trim()); setPage(1); }}
          maw={320}
        />
        <Select placeholder="All plans" clearable data={(plansQ.data ?? []).map((p) => ({ value: String(p.id), label: p.name }))} value={planId} onChange={(v) => { setPlanId(v); setPage(1); }} w={200} />
      </Group>
      {q.isLoading ? (
        <Skeleton h={260} radius="lg" />
      ) : q.isError ? (
        <ErrorState message="Failed to load subscriptions" onRetry={() => q.refetch()} />
      ) : q.data && q.data.items.length === 0 ? (
        <EmptyState title="No subscriptions found" description="Try a different search or filter." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr><Table.Th>Association</Table.Th><Table.Th>Plan</Table.Th><Table.Th>Status</Table.Th><Table.Th>Billing</Table.Th><Table.Th>Price</Table.Th><Table.Th>Started</Table.Th><Table.Th>Ends</Table.Th><Table.Th /></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data?.items.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td><Text fw={500} size="sm">{s.association.name}</Text><Text size="xs" c="dimmed">{s.association.subdomain}</Text></Table.Td>
                  <Table.Td>{s.plan.name} <Text span size="xs" c="dimmed">v{s.planVersion}</Text></Table.Td>
                  <Table.Td>{statusBadge(s)}</Table.Td>
                  <Table.Td>{s.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}</Table.Td>
                  <Table.Td>{s.source === 'PURCHASE' ? formatKobo(s.priceKobo) : <Text size="xs" c="dimmed">No charge</Text>}</Table.Td>
                  <Table.Td>{formatShortDate(s.startedAt)}</Table.Td>
                  <Table.Td>{formatShortDate(s.trialEndsAt && s.status === 'TRIALING' ? s.trialEndsAt : s.endsAt)}</Table.Td>
                  <Table.Td><Button component={Link} href={`/subscriptions/${s.association.id}`} size="xs" variant="light">Open</Button></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {q.data && q.data.total > q.data.limit && (
            <Group justify="center" mt="md"><Pagination total={Math.ceil(q.data.total / q.data.limit)} value={page} onChange={setPage} size="sm" /></Group>
          )}
        </Card>
      )}
    </Stack>
  );
}

interface PaymentRow {
  id: number; reference: string | null; provider: string; purpose: string; status: string; amount: string | number; expectedAmountKobo: number | null; needsReview: boolean; createdAt: string;
  association: { id: number; name: string; subdomain: string };
}

function PaymentsTable() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'REVIEW' | 'FAILED' | 'PENDING'>('REVIEW');
  const [closing, setClosing] = useState<PaymentRow | null>(null);
  const q = useQuery({ queryKey: billingKeys.payments(filter), queryFn: () => bff<{ total: number; items: PaymentRow[] }>(`admin/billing/payments?filter=${filter}`) });
  const close = useMutation({
    mutationFn: (reason: string) => send(`admin/billing/payments/${closing!.id}/close-review`, 'POST', { reason }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Review closed. Nothing was activated.' }); setClosing(null); void qc.invalidateQueries({ queryKey: ['billing'] }); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });
  return (
    <Stack gap="md">
      <Group>
        <Select data={[{ value: 'REVIEW', label: 'Needs review (amount did not match)' }, { value: 'FAILED', label: 'Failed' }, { value: 'PENDING', label: 'Pending' }]} value={filter} onChange={(v) => setFilter((v as typeof filter) ?? 'REVIEW')} allowDeselect={false} w={320} />
      </Group>
      {q.isLoading ? <Skeleton h={200} radius="lg" /> : q.isError ? <ErrorState message="Failed to load payments" onRetry={() => q.refetch()} /> : (q.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Nothing here" description="No payments in this state." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders>
            <Table.Thead><Table.Tr><Table.Th>When</Table.Th><Table.Th>Association</Table.Th><Table.Th>For</Table.Th><Table.Th>Quoted</Table.Th><Table.Th>Received</Table.Th><Table.Th>Reference</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {q.data?.items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{formatDate(p.createdAt)}</Table.Td>
                  <Table.Td><Text component={Link} href={`/subscriptions/${p.association.id}`} size="sm">{p.association.name}</Text></Table.Td>
                  <Table.Td>{p.purpose === 'ADDON' ? 'Add-on' : p.purpose === 'PLAN_CHANGE' ? 'Plan change' : 'Subscription'}</Table.Td>
                  <Table.Td>{p.expectedAmountKobo !== null ? formatKobo(p.expectedAmountKobo) : 'No quote'}</Table.Td>
                  <Table.Td>{formatKobo(Math.round(Number(p.amount) * 100))}</Table.Td>
                  <Table.Td><Text size="xs" ff="monospace">{p.reference}</Text></Table.Td>
                  <Table.Td>{p.needsReview && <Button size="xs" variant="subtle" onClick={() => setClosing(p)}>Close review</Button>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {filter === 'REVIEW' && <Text size="xs" c="dimmed" mt="sm" px="sm">A payment lands here when the amount Paystack confirmed differs from the price quoted at checkout. Nothing was activated. To give the association access, activate their subscription manually with a reason; refund the payment in Paystack if it should not stand; then close the review.</Text>}
        </Card>
      )}
      <ConfirmDestructive opened={!!closing} onClose={() => setClosing(null)} onConfirm={async (r) => { await close.mutateAsync(r); }} title="Close payment review" description="Records that you looked at this payment and dealt with it elsewhere. Nothing is activated by closing it." confirmLabel="Close review" loading={close.isPending} />
    </Stack>
  );
}

export default function SubscriptionsPage() {
  return (
    <Stack gap="xl">
      <PageHeader title="Subscriptions" description="Every association's plan, status and payments. Open one to extend, activate, suspend or grant an add-on, each with a reason that is kept in the audit trail." />
      <Tabs defaultValue="all" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="all">All</Tabs.Tab>
          <Tabs.Tab value="expired">Expired</Tabs.Tab>
          <Tabs.Tab value="ending7">Renewals in 7 days</Tabs.Tab>
          <Tabs.Tab value="ending30">Renewals in 30 days</Tabs.Tab>
          <Tabs.Tab value="payments">Payments needing attention</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="all"><SubscriptionsTable mode="all" /></Tabs.Panel>
        <Tabs.Panel value="expired"><SubscriptionsTable mode="expired" /></Tabs.Panel>
        <Tabs.Panel value="ending7"><SubscriptionsTable mode="ending7" /></Tabs.Panel>
        <Tabs.Panel value="ending30"><SubscriptionsTable mode="ending30" /></Tabs.Panel>
        <Tabs.Panel value="payments"><PaymentsTable /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
