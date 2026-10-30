'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Badge, Button, Card, Group, Modal, Select, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ReasonField } from '@/components/ReasonField';
import { formatDate, formatShortDate } from '@/lib/format';
import { formatKobo } from '@/lib/billing';
import { KIND_LABEL, MODEL_LABEL, OVERRIDE_ROLES, ajoKeys, errMessage, jsonPost, useAdminRole, type GroupDetail, type TierPreview } from '@/lib/ajo-admin';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const MIN_REASON = 10;

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">{label}</Text>
      <Text size="sm" fw={500}>{value}</Text>
    </Stack>
  );
}

function ChangeTierModal({ group, opened, onClose }: { group: GroupDetail; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const preview = useQuery({
    queryKey: ['ajo', 'tier-preview', group.id, target],
    queryFn: () => bff<TierPreview>(`admin/ajo-oversight/groups/${group.id}/tier-preview?targetAddonId=${target}`),
    enabled: opened && !!target,
  });
  const p = preview.data;

  const change = useMutation({
    mutationFn: () => bff<{ applied: string }>(`admin/ajo-oversight/groups/${group.id}/tier`, jsonPost({ targetAddonId: Number(target), reason })),
    onSuccess: (r) => {
      notifications.show({ color: 'green', message: r.applied === 'NOW' ? 'The tier has been changed.' : r.applied === 'PERIOD_END' ? 'The downgrade is scheduled for the end of the paid period.' : 'The waiting downgrade was cancelled.' });
      void qc.invalidateQueries({ queryKey: ajoKeys.group(group.id) });
      void qc.invalidateQueries({ queryKey: ['ajo', 'groups'] });
      handleClose();
    },
    onError: (e) => notifications.show({ color: 'red', message: errMessage(e) }),
  });

  function handleClose() {
    setTarget(null);
    setReason('');
    onClose();
  }

  const current = group.tier.current;
  const canSubmit = !!target && !!p && p.blockers.length === 0 && reason.trim().length >= MIN_REASON;

  return (
    <Modal opened={opened} onClose={handleClose} title="Change Ajo tier" size="md" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Now on {current ? current.name : 'no tier'}, with {group.tier.activeContributors} active contributor{group.tier.activeContributors === 1 ? '' : 's'}.
        </Text>
        <Select
          label="Move to"
          placeholder="Choose a tier"
          value={target}
          onChange={setTarget}
          data={group.tier.options.map((o) => ({
            value: String(o.addonId),
            label: `${o.name} · ${formatKobo(o.priceMonthlyKobo)}/month · ${o.contributorLimit === null ? 'unlimited' : `up to ${o.contributorLimit}`} contributors`,
          }))}
        />
        {target && preview.isLoading && <Skeleton h={48} radius="md" />}
        {target && preview.isError && <Alert color="red">{errMessage(preview.error)}</Alert>}
        {p && p.blockers.length > 0 && <Alert color="red" title="This change is blocked">{p.blockers.join(' ')}</Alert>}
        {p && p.blockers.length === 0 && p.direction === 'SAME' && (
          <Alert color="blue">{group.tier.current?.pendingAddonId ? 'This is the tier the group has now. Confirming cancels the downgrade that is waiting.' : 'The group is already on this tier.'}</Alert>
        )}
        {p && p.blockers.length === 0 && p.direction === 'UPGRADE' && (
          <Alert color="blue">Upgrades start now. Nothing is charged today: the new tier runs to the end of the current period and the group pays its price at renewal.</Alert>
        )}
        {p && p.blockers.length === 0 && p.direction === 'DOWNGRADE' && (
          <Alert color="blue">
            {p.timing === 'PERIOD_END' && p.effectiveAt
              ? `The group keeps ${p.from} until ${formatShortDate(p.effectiveAt)}, then renews as ${p.to}.`
              : `This tier was not paid for, so the group moves to ${p.to} now.`}
          </Alert>
        )}
        <ReasonField value={reason} onChange={setReason} label={`Reason (at least ${MIN_REASON} characters)`} />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={change.isPending}>Cancel</Button>
          <Button disabled={!canSubmit || (p?.direction === 'SAME' && !group.tier.current?.pendingAddonId)} loading={change.isPending} onClick={() => change.mutate()}>Confirm</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default function AjoGroupDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { role } = useAdminRole();
  const canOverride = role !== null && (OVERRIDE_ROLES as readonly string[]).includes(role);
  const [tierOpen, setTierOpen] = useState(false);
  const [voiding, setVoiding] = useState<number | null>(null);

  const q = useQuery({ queryKey: ajoKeys.group(id), queryFn: () => bff<GroupDetail>(`admin/ajo-oversight/groups/${id}`), enabled: Number.isFinite(id) });

  const voidPayout = useMutation({
    mutationFn: (v: { payoutId: number; reason: string }) => bff(`admin/ajo-oversight/payouts/${v.payoutId}/void`, jsonPost({ reason: v.reason })),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'The payout has been cancelled.' });
      setVoiding(null);
      void qc.invalidateQueries({ queryKey: ajoKeys.group(id) });
    },
    onError: (e) => notifications.show({ color: 'red', message: errMessage(e) }),
  });

  if (q.isLoading) return <Skeleton h={360} radius="lg" />;
  if (q.isError || !q.data) return <ErrorState message="Failed to load this group" onRetry={() => q.refetch()} />;
  const g = q.data;
  const tier = g.tier.current;
  const pending = tier?.pendingAddonId ? g.tier.options.find((o) => o.addonId === tier.pendingAddonId) : undefined;
  const open = (s: string) => s === 'PREPARED' || s === 'APPROVED';
  const levyTotals = Object.entries(g.levy.totals);

  return (
    <Stack gap="md">
      <PageHeader
        title={g.name}
        description={<>{MODEL_LABEL[g.model]} in <Link href={`/associations/${g.association.id}`}>{g.association.name}</Link> ({KIND_LABEL[g.association.kind]}). <Link href="/ajo/groups">Back to all groups</Link></>}
        actions={<StatusBadge status={g.status} size="md" />}
      />

      <Card style={card} p="lg" radius="lg">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stat label="Contribution" value={`${formatKobo(g.contributionKobo)} ${g.frequency.toLowerCase()}`} />
          <Stat label="Started" value={g.startedAt ? formatShortDate(g.startedAt) : `Starts ${formatShortDate(g.startDate)}`} />
          <Stat label="People" value={Object.entries(g.members).map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ') || 'None yet'} />
          <Stat label="Owner status" value={<StatusBadge status={g.association.status} />} />
        </SimpleGrid>
        {g.cancelReason && <Alert color="orange" mt="md" title="Cancelled">{g.cancelReason}</Alert>}
      </Card>

      <Card style={card} p="lg" radius="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={600}>Ajo tier</Text>
            {tier ? (
              <>
                <Text size="sm">
                  {tier.name}
                  {tier.contributorLimit !== null ? ` · up to ${tier.contributorLimit} contributors` : ' · unlimited contributors'} · {g.tier.activeContributors} in use
                </Text>
                <Text size="xs" c="dimmed">Runs to {formatShortDate(tier.endsAt)} · {tier.paid ? 'paid for' : 'not paid for (trial, complimentary or granted)'}</Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">This owner holds no Ajo tier right now.</Text>
            )}
            {pending && <Badge variant="light" color="orange">Moves to {pending.name} at renewal</Badge>}
          </Stack>
          {canOverride && <Button variant="light" onClick={() => setTierOpen(true)}>Change tier…</Button>}
        </Group>
        <Text size="xs" c="dimmed" mt="sm">The tier belongs to the whole owner ({g.association.name}), so this applies to all of its groups. To suspend the owner, use <Link href={`/associations/${g.association.id}`}>its page</Link>.</Text>
      </Card>

      <Card style={card} p="lg" radius="lg">
        <Text fw={600} mb="sm">Payouts</Text>
        {g.payouts.length === 0 ? (
          <Text size="sm" c="dimmed">No payouts have been prepared yet.</Text>
        ) : (
          <Table withRowBorders>
            <Table.Thead><Table.Tr><Table.Th>Person</Table.Th><Table.Th>Round</Table.Th><Table.Th>Amount</Table.Th><Table.Th>Status</Table.Th><Table.Th>Prepared</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {g.payouts.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.name}</Table.Td>
                  <Table.Td>{p.round ?? `Cycle ${p.cycleNo}`}</Table.Td>
                  <Table.Td>{formatKobo(p.netKobo)}</Table.Td>
                  <Table.Td><StatusBadge status={p.status} />{p.voidReason && <Text size="xs" c="dimmed">{p.voidReason}</Text>}</Table.Td>
                  <Table.Td>{formatDate(p.preparedAt)}</Table.Td>
                  <Table.Td>{canOverride && open(p.status) && <Button size="xs" color="red" variant="light" onClick={() => setVoiding(p.id)}>Cancel payout…</Button>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card style={card} p="lg" radius="lg">
        <Text fw={600} mb="sm">Default cases</Text>
        {g.cases.length === 0 ? (
          <Text size="sm" c="dimmed">No default cases.</Text>
        ) : (
          <Table withRowBorders>
            <Table.Thead><Table.Tr><Table.Th>Person</Table.Th><Table.Th>Owed</Table.Th><Table.Th>Status</Table.Th><Table.Th>Opened</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {g.cases.map((c) => (
                <Table.Tr key={c.id}><Table.Td>{c.name}</Table.Td><Table.Td>{formatKobo(c.outstandingKobo)}</Table.Td><Table.Td><StatusBadge status={c.status} /></Table.Td><Table.Td>{formatShortDate(c.openedAt)}</Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card style={card} p="lg" radius="lg">
        <Text fw={600} mb="sm">Platform levy for {g.association.name}</Text>
        {levyTotals.length === 0 ? (
          <Text size="sm" c="dimmed">No levy has been assessed.</Text>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {levyTotals.map(([status, t]) => <Stat key={status} label={status.toLowerCase()} value={formatKobo(Number(t.kobo))} />)}
          </SimpleGrid>
        )}
      </Card>

      <ChangeTierModal group={g} opened={tierOpen} onClose={() => setTierOpen(false)} />
      <ConfirmDestructive
        opened={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Cancel this payout"
        description="The round goes back to pending and the group's admins are told. A payout already recorded as paid cannot be cancelled here. Write at least 10 characters."
        loading={voidPayout.isPending}
        onConfirm={async (reason) => {
          if (voiding !== null) await voidPayout.mutateAsync({ payoutId: voiding, reason }).catch(() => undefined);
        }}
      />
    </Stack>
  );
}
