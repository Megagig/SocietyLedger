'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Badge, Button, Card, Checkbox, Group, Modal, NumberInput, Select, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { ReasonField } from '@/components/ReasonField';
import { formatDate, formatShortDate } from '@/lib/format';
import { billingKeys, formatKobo, send, type BuilderAddon, type BuilderPlan } from '@/lib/billing';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

interface Detail {
  association: { id: number; name: string; subdomain: string; status: string; tier: string };
  access: { allowed: boolean; reason: string; inGrace: boolean; graceEndsAt: string | null; periodEndsAt: string | null };
  subscriptions: { id: number; status: string; source: string; billingCycle: string; currentPeriodStart: string; currentPeriodEnd: string; trialEndsAt: string | null; cancelAtPeriodEnd: boolean; plan: { name: string; code: string }; planVersion: { version: number; priceMonthlyKobo: number; priceAnnualKobo: number } }[];
  terms: { id: number; kind: string; billingCycle: string; startsAt: string; endsAt: string; amountKobo: number; reason: string | null; actorId: number | null }[];
  payments: { id: number; amount: string | number; status: string; provider: string; reference: string | null; paidAt: string | null; purpose: string; needsReview: boolean; expectedAmountKobo: number | null; createdAt: string }[];
  addons: { id: number; status: string; name: string; version: number; startsAt: string; endsAt: string; source: string; amountPaidKobo: number; cancelAtPeriodEnd: boolean }[];
  entitlements: { planCode: string | null; modules: { code: string; source: string }[]; features: { code: string; source: string }[]; limits: Record<string, number | null> };
  history: { id: number; actionType: string; actorId: number; actorRole: string; reason: string | null; createdAt: string; afterState: unknown }[];
}

type Action = 'activate' | 'extend' | 'suspend' | 'reactivate' | 'addon' | null;

const ACTION_LABEL: Record<string, string> = {
  SUBSCRIPTION_MANUALLY_ACTIVATED: 'Activated by hand',
  SUBSCRIPTION_COMPLIMENTARY_GRANTED: 'Complimentary access granted',
  SUBSCRIPTION_EXTENDED: 'Extended',
  SUBSCRIPTION_SUSPENDED: 'Suspended',
  SUBSCRIPTION_REACTIVATED: 'Reactivated',
  SUBSCRIPTION_PAYMENT_VERIFIED: 'Payment verified',
  SUBSCRIPTION_PAYMENT_MISMATCH: 'Payment did not match the quote',
  SUBSCRIPTION_PAYMENT_REVIEW_CLOSED: 'Payment review closed',
  SUBSCRIPTION_MIGRATED: 'Moved to a newer plan version',
  SUBSCRIPTION_DOWNGRADE_SCHEDULED: 'Plan change scheduled',
  SUBSCRIPTION_REMINDER_SENT: 'Reminder sent',
  ADDON_PURCHASED: 'Add-on bought',
  ADDON_GRANTED: 'Add-on granted',
};

export default function SubscriptionDetailPage({ params }: { params: { associationId: string } }) {
  const associationId = Number(params.associationId);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: billingKeys.subscription(associationId), queryFn: () => bff<Detail>(`admin/billing/subscriptions/${associationId}`) });
  const plansQ = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans') });
  const addonsQ = useQuery({ queryKey: billingKeys.addons, queryFn: () => bff<BuilderAddon[]>('admin/billing/addons') });

  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<string>('MONTHLY');
  const [days, setDays] = useState<number | ''>(30);
  const [complimentary, setComplimentary] = useState(false);
  const [addonId, setAddonId] = useState<string | null>(null);

  const close = () => { setAction(null); setReason(''); };
  const base = `admin/billing/subscriptions/${associationId}`;
  const run = useMutation({
    mutationFn: () => {
      switch (action) {
        case 'activate': return send(`${base}/activate`, 'POST', { planId: Number(planId), billingCycle: cycle, days: Number(days) || undefined, complimentary, reason });
        case 'extend': return send(`${base}/extend`, 'POST', { days: Number(days), reason });
        case 'suspend': return send(`${base}/suspend`, 'POST', { reason });
        case 'reactivate': return send(`${base}/reactivate`, 'POST', { reason });
        case 'addon': return send(`${base}/addons`, 'POST', { addonId: Number(addonId), reason });
        default: return Promise.reject(new Error('No action chosen'));
      }
    },
    onSuccess: () => { notifications.show({ color: 'green', message: 'Done. The change is recorded in the audit trail.' }); close(); void qc.invalidateQueries({ queryKey: ['billing'] }); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });

  if (q.isLoading) return <Skeleton h={400} radius="lg" />;
  if (q.isError || !q.data) return <ErrorState message={q.error ? err(q.error) : 'Not found'} onRetry={() => q.refetch()} />;
  const d = q.data;
  const sub = d.subscriptions[0];
  const reasonOk = reason.trim().length >= 10;
  const canRun = reasonOk && (action !== 'activate' || (!!planId && Number(days) > 0)) && (action !== 'extend' || Number(days) > 0) && (action !== 'addon' || !!addonId);
  const publishedPlans = (plansQ.data ?? []).filter((p) => !p.isArchived && p.versions.some((v) => v.status === 'PUBLISHED'));
  const publishedAddons = (addonsQ.data ?? []).filter((a) => !a.isArchived && a.versions.some((v) => v.status === 'PUBLISHED'));

  return (
    <Stack gap="xl">
      <Button component={Link} href="/subscriptions" variant="subtle" leftSection={<IconArrowLeft size={14} />} w="fit-content" size="xs">Back to Subscriptions</Button>
      <PageHeader
        title={d.association.name}
        description={`${d.association.subdomain} · association ${d.association.status.toLowerCase()}`}
        actions={
          <Group>
            <Button variant="light" onClick={() => setAction('activate')}>Activate a plan</Button>
            <Button variant="light" onClick={() => { setDays(30); setAction('extend'); }} disabled={!sub}>Extend</Button>
            <Button variant="light" onClick={() => setAction('addon')} disabled={!sub}>Grant add-on</Button>
            {d.access.allowed ? <Button variant="light" color="red" onClick={() => setAction('suspend')} disabled={!sub}>Suspend</Button> : <Button variant="light" color="green" onClick={() => setAction('reactivate')} disabled={!sub}>Reactivate</Button>}
          </Group>
        }
      />

      <Alert color={d.access.allowed ? (d.access.inGrace ? 'yellow' : 'green') : 'red'} icon={<IconAlertCircle size={16} />}>
        {d.access.allowed
          ? d.access.inGrace ? `In the grace period until ${d.access.graceEndsAt ? formatShortDate(d.access.graceEndsAt) : '?'}. Their access ends after that.` : 'Has access.'
          : `Locked out (${d.access.reason.toLowerCase().replace('_', ' ')}). Their data is untouched; they can only reach billing and support until they resubscribe.`}
      </Alert>

      {sub ? (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Card style={card} p="xl" radius="lg">
            <Stack gap={6}>
              <Text fw={600}>Current subscription</Text>
              <Text>{sub.plan.name} <Text span c="dimmed" size="sm">version {sub.planVersion.version}</Text></Text>
              <Group gap="xs"><Badge variant="light">{sub.status}</Badge><Badge variant="outline" color="gray">{sub.source === 'PURCHASE' ? 'Paid' : sub.source === 'ONBOARDING' ? 'Welcome subscription' : sub.source === 'COMPLIMENTARY' ? 'Complimentary' : 'Activated by hand'}</Badge></Group>
              <Text size="sm">{sub.billingCycle === 'ANNUAL' ? 'Annual' : 'Monthly'} · {sub.source === 'PURCHASE' ? formatKobo(sub.billingCycle === 'ANNUAL' ? sub.planVersion.priceAnnualKobo : sub.planVersion.priceMonthlyKobo) : 'no charge this period'}</Text>
              <Text size="sm">Started {formatShortDate(sub.currentPeriodStart)} · {sub.status === 'TRIALING' && sub.trialEndsAt ? 'trial ends' : 'ends'} {formatShortDate(sub.trialEndsAt && sub.status === 'TRIALING' ? sub.trialEndsAt : sub.currentPeriodEnd)}</Text>
              {sub.cancelAtPeriodEnd && <Text size="sm" c="orange">Set to cancel at the end of the period</Text>}
            </Stack>
          </Card>
          <Card style={card} p="xl" radius="lg">
            <Stack gap={6}>
              <Text fw={600}>What they can use</Text>
              <Text size="sm">Modules: {d.entitlements.modules.map((m) => m.code).join(', ') || 'none'}</Text>
              <Text size="sm">Members limit: {typeof d.entitlements.limits.members === 'number' ? d.entitlements.limits.members.toLocaleString('en-NG') : 'unlimited'}</Text>
              <Text size="xs" c="dimmed">From the plan version they bought, their add-ons and any per-association overrides.</Text>
            </Stack>
          </Card>
        </SimpleGrid>
      ) : (
        <Alert color="yellow">This association has no subscription yet.</Alert>
      )}

      {d.addons.length > 0 && (
        <Card style={card} p="md" radius="lg">
          <Text fw={600} mb="sm" px="sm">Add-ons</Text>
          <Table withRowBorders><Table.Thead><Table.Tr><Table.Th>Add-on</Table.Th><Table.Th>Status</Table.Th><Table.Th>Source</Table.Th><Table.Th>Paid</Table.Th><Table.Th>Ends</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{d.addons.map((a) => (
              <Table.Tr key={a.id}><Table.Td>{a.name} <Text span size="xs" c="dimmed">v{a.version}</Text></Table.Td><Table.Td>{a.status === 'ACTIVE' ? (a.cancelAtPeriodEnd ? 'Ending' : 'Active') : 'Ended'}</Table.Td><Table.Td>{a.source === 'PURCHASE' ? 'Bought' : 'Granted'}</Table.Td><Table.Td>{formatKobo(a.amountPaidKobo)}</Table.Td><Table.Td>{formatShortDate(a.endsAt)}</Table.Td></Table.Tr>
            ))}</Table.Tbody></Table>
        </Card>
      )}

      <Card style={card} p="md" radius="lg">
        <Text fw={600} mb="sm" px="sm">Periods granted</Text>
        <Table withRowBorders fz="sm"><Table.Thead><Table.Tr><Table.Th>Type</Table.Th><Table.Th>From</Table.Th><Table.Th>To</Table.Th><Table.Th>Charged</Table.Th><Table.Th>Reason</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{d.terms.map((t) => (
            <Table.Tr key={t.id}><Table.Td>{t.kind.replace('_', ' ').toLowerCase()}</Table.Td><Table.Td>{formatShortDate(t.startsAt)}</Table.Td><Table.Td>{formatShortDate(t.endsAt)}</Table.Td><Table.Td>{t.amountKobo > 0 ? formatKobo(t.amountKobo) : 'nothing'}</Table.Td><Table.Td><Text size="xs" c="dimmed">{t.reason ?? ''}</Text></Table.Td></Table.Tr>
          ))}</Table.Tbody></Table>
      </Card>

      <Card style={card} p="md" radius="lg">
        <Text fw={600} mb="sm" px="sm">Payments</Text>
        {d.payments.length === 0 ? <Text size="sm" c="dimmed" px="sm" pb="sm">No payments yet.</Text> : (
          <Table withRowBorders fz="sm"><Table.Thead><Table.Tr><Table.Th>When</Table.Th><Table.Th>For</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Reference</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{d.payments.map((p) => (
              <Table.Tr key={p.id}><Table.Td>{formatDate(p.createdAt)}</Table.Td><Table.Td>{p.purpose === 'ADDON' ? 'Add-on' : p.purpose === 'PLAN_CHANGE' ? 'Plan change' : 'Subscription'}</Table.Td><Table.Td>{formatKobo(Math.round(Number(p.amount) * 100))}</Table.Td><Table.Td>{p.needsReview ? <Badge color="yellow" variant="light" size="sm">Needs review</Badge> : p.status === 'SUCCESS' ? 'Paid' : p.status.toLowerCase()}</Table.Td><Table.Td><Text size="xs" ff="monospace">{p.reference}</Text></Table.Td></Table.Tr>
            ))}</Table.Tbody></Table>
        )}
      </Card>

      <Card style={card} p="md" radius="lg">
        <Text fw={600} mb="sm" px="sm">Change history</Text>
        {d.history.length === 0 ? <Text size="sm" c="dimmed" px="sm" pb="sm">Nothing recorded yet.</Text> : (
          <Table withRowBorders fz="sm"><Table.Thead><Table.Tr><Table.Th>When</Table.Th><Table.Th>What</Table.Th><Table.Th>Who</Table.Th><Table.Th>Reason</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{d.history.map((h) => (
              <Table.Tr key={h.id}><Table.Td>{formatDate(h.createdAt)}</Table.Td><Table.Td>{ACTION_LABEL[h.actionType] ?? h.actionType.toLowerCase().replace(/_/g, ' ')}</Table.Td><Table.Td>{h.actorId === 0 ? 'System' : `${h.actorRole.toLowerCase().replace('_', ' ')} #${h.actorId}`}</Table.Td><Table.Td><Text size="xs" c="dimmed">{h.reason ?? ''}</Text></Table.Td></Table.Tr>
            ))}</Table.Tbody></Table>
        )}
      </Card>

      <Modal opened={action !== null} onClose={close} title={{ activate: 'Activate a plan without a payment', extend: 'Extend the subscription', suspend: 'Suspend the subscription', reactivate: 'Reactivate the subscription', addon: 'Grant an add-on' }[action ?? 'activate']} size="md">
        <Stack>
          {action === 'activate' && (
            <>
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>No payment or invoice is created. The period is recorded as unpaid, with your name and reason.</Alert>
              <Select label="Plan" data={publishedPlans.map((p) => ({ value: String(p.id), label: p.name }))} value={planId} onChange={setPlanId} />
              <Select label="Billing" data={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'ANNUAL', label: 'Annual' }]} value={cycle} onChange={(v) => setCycle(v ?? 'MONTHLY')} allowDeselect={false} />
              <NumberInput label="Number of days" value={days} onChange={(v) => setDays(v === '' ? '' : Number(v))} min={1} max={1100} />
              <Checkbox label="Record as complimentary (a gift, not a manual payment)" checked={complimentary} onChange={(e) => setComplimentary(e.currentTarget.checked)} />
            </>
          )}
          {action === 'extend' && <NumberInput label="Extend by (days)" value={days} onChange={(v) => setDays(v === '' ? '' : Number(v))} min={1} max={366} />}
          {action === 'suspend' && <Alert color="red" icon={<IconAlertCircle size={16} />}>Their access stops now. Records and add-ons are untouched.</Alert>}
          {action === 'reactivate' && <Text size="sm">Restores access if paid time remains. If the period has ended, extend or activate a plan instead.</Text>}
          {action === 'addon' && <Select label="Add-on" data={publishedAddons.map((a) => ({ value: String(a.id), label: a.name }))} value={addonId} onChange={setAddonId} />}
          <ReasonField value={reason} onChange={setReason} label="Reason (at least 10 characters, kept in the audit trail)" />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button onClick={() => run.mutate()} loading={run.isPending} disabled={!canRun} color={action === 'suspend' ? 'red' : undefined}>Confirm</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
