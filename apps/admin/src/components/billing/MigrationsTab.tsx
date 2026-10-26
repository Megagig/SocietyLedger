'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Badge, Button, Card, Group, Select, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { ErrorState } from '@/components/ErrorState';
import { ReasonField } from '@/components/ReasonField';
import { formatDate } from '@/lib/format';
import { billingKeys, formatKobo, send, type BuilderPlan } from '@/lib/billing';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

interface MigrationPreview {
  planName: string;
  from: { id: number; version: number };
  to: { id: number; version: number };
  affectedSubscriptions: number;
  priceChange: { monthlyKobo: { from: number; to: number }; annualKobo: { from: number; to: number } };
  modulesGained: string[];
  modulesLost: string[];
  featuresGained: string[];
  featuresLost: string[];
  sample: { associationId: number; associationName: string; billingCycle: string; currentPriceKobo: number; newPriceKobo: number; periodEnd: string }[];
}

interface MigrationRow {
  id: number;
  status: 'SCHEDULED' | 'APPLIED' | 'CANCELLED';
  effectiveAt: string;
  reason: string;
  affectedCount: number;
  createdAt: string;
  appliedAt: string | null;
  plan: { name: string };
  fromVersion: { version: number };
  toVersion: { version: number };
}

/** Moving existing subscribers from one version of a plan to another: preview, schedule with a date and reason, and the history. */
export function MigrationsTab() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans') });
  const listQ = useQuery({ queryKey: billingKeys.migrations, queryFn: () => bff<MigrationRow[]>('admin/billing/migrations') });

  const [planId, setPlanId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [effective, setEffective] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const plan = plansQ.data?.find((p) => String(p.id) === planId);
  const versionOptions = useMemo(
    () => (plan?.versions ?? []).filter((v) => v.status !== 'DRAFT').map((v) => ({ value: String(v.id), label: `v${v.version} - ${formatKobo(v.priceMonthlyKobo)}/month (${v.subscribers ?? 0} subscribers)` })),
    [plan],
  );

  const previewQ = useQuery({
    queryKey: ['billing', 'migration-preview', planId, fromId, toId],
    queryFn: () => send<MigrationPreview>('admin/billing/migrations/preview', 'POST', { planId: Number(planId), fromVersionId: Number(fromId), toVersionId: Number(toId) }),
    enabled: !!planId && !!fromId && !!toId && fromId !== toId,
    retry: false,
  });

  const schedule = useMutation({
    mutationFn: () => send('admin/billing/migrations', 'POST', { planId: Number(planId), fromVersionId: Number(fromId), toVersionId: Number(toId), effectiveAt: new Date(`${effective}T00:00:00`).toISOString(), reason }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Migration scheduled. The affected subscribers have been told.' });
      setReason('');
      void qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => send(`admin/billing/migrations/${id}/cancel`, 'POST', { reason: 'Cancelled from the Plans page by the platform owner' }),
    onSuccess: () => { notifications.show({ color: 'gray', message: 'Migration cancelled.' }); void qc.invalidateQueries({ queryKey: ['billing'] }); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });

  if (plansQ.isLoading || listQ.isLoading) return <Skeleton h={260} radius="lg" />;
  if (plansQ.isError || listQ.isError) return <ErrorState message="Failed to load migrations" onRetry={() => { plansQ.refetch(); listQ.refetch(); }} />;
  const p = previewQ.data;

  return (
    <Stack gap="lg">
      <Alert color="blue" icon={<IconAlertCircle size={16} />}>
        Publishing a new plan version never changes anyone who already subscribed. Use this to deliberately move current subscribers onto newer terms. Their access to modules and features changes when the migration is applied; the new price starts at their next renewal, so nothing they already paid for changes.
      </Alert>

      <Card style={card} p="xl" radius="lg">
        <Stack gap="md">
          <Text fw={600}>Plan a migration</Text>
          <Group grow align="flex-start">
            <Select label="Plan" data={(plansQ.data ?? []).filter((x) => x.versions.some((v) => v.status !== 'DRAFT')).map((x) => ({ value: String(x.id), label: x.name }))} value={planId} onChange={(v) => { setPlanId(v); setFromId(null); setToId(null); }} placeholder="Choose a plan" />
            <Select label="Move subscribers from" data={versionOptions} value={fromId} onChange={setFromId} disabled={!planId} placeholder="Version" />
            <Select label="Onto" data={versionOptions.filter((o) => o.value !== fromId)} value={toId} onChange={setToId} disabled={!planId} placeholder="Version" />
          </Group>

          {previewQ.isLoading && <Skeleton h={80} />}
          {previewQ.isError && <Alert color="red" icon={<IconAlertCircle size={16} />}>{err(previewQ.error)}</Alert>}
          {p && (
            <Stack gap="xs">
              <Text size="sm"><b>{p.affectedSubscriptions}</b> current subscriber(s) on v{p.from.version} would move to v{p.to.version}.</Text>
              <Text size="sm">Monthly price: {formatKobo(p.priceChange.monthlyKobo.from)} to <b>{formatKobo(p.priceChange.monthlyKobo.to)}</b>. Annual price: {formatKobo(p.priceChange.annualKobo.from)} to <b>{formatKobo(p.priceChange.annualKobo.to)}</b>.</Text>
              {p.modulesGained.length > 0 && <Text size="sm">Gain modules: {p.modulesGained.join(', ')}</Text>}
              {p.modulesLost.length > 0 && <Text size="sm" c="red">Lose modules: {p.modulesLost.join(', ')}</Text>}
              {p.featuresLost.length > 0 && <Text size="sm" c="red">Lose features: {p.featuresLost.join(', ')}</Text>}
              {p.sample.length > 0 && (
                <Table fz="xs" withRowBorders>
                  <Table.Thead><Table.Tr><Table.Th>Association</Table.Th><Table.Th>Billing</Table.Th><Table.Th>Pays now</Table.Th><Table.Th>Will pay</Table.Th><Table.Th>Period ends</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {p.sample.slice(0, 10).map((s) => (
                      <Table.Tr key={s.associationId}><Table.Td>{s.associationName}</Table.Td><Table.Td>{s.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'}</Table.Td><Table.Td>{formatKobo(s.currentPriceKobo)}</Table.Td><Table.Td>{formatKobo(s.newPriceKobo)}</Table.Td><Table.Td>{formatDate(s.periodEnd)}</Table.Td></Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
              <TextInput type="date" label="Effective date" value={effective} onChange={(e) => setEffective(e.currentTarget.value)} w={220} />
              <ReasonField label="Reason (required, kept in the audit trail and shown to the subscribers' record)" value={reason} onChange={setReason} />
              <Group>
                <Button onClick={() => schedule.mutate()} loading={schedule.isPending} disabled={reason.trim().length < 10 || p.affectedSubscriptions === 0}>Schedule migration</Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Card>

      <Card style={card} p="md" radius="lg">
        <Text fw={600} mb="sm" px="sm">History</Text>
        {(listQ.data ?? []).length === 0 ? (
          <Text size="sm" c="dimmed" px="sm" pb="sm">No migrations yet.</Text>
        ) : (
          <Table withRowBorders>
            <Table.Thead><Table.Tr><Table.Th>Plan</Table.Th><Table.Th>Move</Table.Th><Table.Th>Effective</Table.Th><Table.Th>Subscribers</Table.Th><Table.Th>Status</Table.Th><Table.Th>Reason</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(listQ.data ?? []).map((m) => (
                <Table.Tr key={m.id}>
                  <Table.Td>{m.plan.name}</Table.Td>
                  <Table.Td>v{m.fromVersion.version} to v{m.toVersion.version}</Table.Td>
                  <Table.Td>{formatDate(m.effectiveAt)}</Table.Td>
                  <Table.Td>{m.affectedCount}</Table.Td>
                  <Table.Td><Badge size="sm" variant="light" color={m.status === 'APPLIED' ? 'green' : m.status === 'SCHEDULED' ? 'blue' : 'gray'}>{m.status === 'APPLIED' ? 'Applied' : m.status === 'SCHEDULED' ? 'Scheduled' : 'Cancelled'}</Badge></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed" maw={260}>{m.reason}</Text></Table.Td>
                  <Table.Td>{m.status === 'SCHEDULED' && <Button size="xs" variant="subtle" color="red" onClick={() => cancel.mutate(m.id)} loading={cancel.isPending}>Cancel</Button>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
