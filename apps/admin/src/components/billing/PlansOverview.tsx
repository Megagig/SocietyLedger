'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Badge, Button, Card, Group, Modal, SimpleGrid, Skeleton, Stack, Table, Tabs, Text, TextInput, Switch } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { billingKeys, currentVersion, draftVersion, formatKobo, nairaToKobo, send, type BuilderAddon, type BuilderPlan } from '@/lib/billing';
import { MigrationsTab } from './MigrationsTab';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

function StatusBadges({ item }: { item: { isArchived: boolean; isPublic: boolean; isActive: boolean; isRecommended?: boolean; isOnboardingPlan?: boolean } }) {
  return (
    <Group gap={4}>
      <Badge size="sm" variant="light" color={item.isArchived ? 'gray' : item.isPublic && item.isActive ? 'green' : 'yellow'}>
        {item.isArchived ? 'Archived' : item.isPublic && item.isActive ? 'On sale' : item.isActive ? 'Hidden' : 'Deactivated'}
      </Badge>
      {item.isRecommended && <Badge size="sm" variant="outline">Recommended</Badge>}
      {item.isOnboardingPlan && <Badge size="sm" variant="outline" color="blue">New associations</Badge>}
    </Group>
  );
}

function NewItemModal({ kind, opened, onClose }: { kind: 'plan' | 'addon'; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: '', name: '', monthly: '', annual: '' });
  const monthly = nairaToKobo(form.monthly);
  const annual = nairaToKobo(form.annual);
  const create = useMutation({
    mutationFn: () => send(`admin/billing/${kind === 'plan' ? 'plans' : 'addons'}`, 'POST', { code: form.code, name: form.name, priceMonthlyKobo: monthly, priceAnnualKobo: annual }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: `${kind === 'plan' ? 'Plan' : 'Add-on'} created as a draft. Open it to choose what it includes, then publish.` });
      setForm({ code: '', name: '', monthly: '', annual: '' });
      onClose();
      void qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });
  return (
    <Modal opened={opened} onClose={onClose} title={`New ${kind === 'plan' ? 'plan' : 'add-on'}`}>
      <Stack>
        <TextInput label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} required />
        <TextInput label="Code" description="Lower-case letters, numbers and dashes. It cannot be changed later." value={form.code} onChange={(e) => setForm({ ...form, code: e.currentTarget.value.toLowerCase() })} required />
        <TextInput label="Monthly price (₦)" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.currentTarget.value })} error={form.monthly && monthly === null ? 'Enter an amount like 10000' : undefined} required />
        <TextInput label="Annual price (₦)" value={form.annual} onChange={(e) => setForm({ ...form, annual: e.currentTarget.value })} error={form.annual && annual === null ? 'Enter an amount like 100000' : undefined} required />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!form.name.trim() || !form.code.trim() || monthly === null || annual === null}>Create draft</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function PlansTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans') });
  const [creating, setCreating] = useState(false);
  const [dup, setDup] = useState<BuilderPlan | null>(null);
  const [dupForm, setDupForm] = useState({ code: '', name: '' });
  const [archiving, setArchiving] = useState<BuilderPlan | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ['billing'] });

  const duplicate = useMutation({
    mutationFn: () => send(`admin/billing/plans/${dup!.id}/duplicate`, 'POST', dupForm),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Duplicated as a draft.' }); setDup(null); void done(); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });
  const archive = useMutation({
    mutationFn: (reason: string) => send(`admin/billing/plans/${archiving!.id}/${archiving!.isArchived ? 'restore' : 'archive'}`, 'POST', { reason }),
    onSuccess: () => { notifications.show({ color: 'green', message: archiving?.isArchived ? 'Plan restored.' : 'Plan archived. Existing subscribers are not affected.' }); setArchiving(null); void done(); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });

  if (q.isLoading) return <Skeleton h={260} radius="lg" />;
  if (q.isError) return <ErrorState message="Failed to load plans" onRetry={() => q.refetch()} />;
  const plans = q.data ?? [];

  return (
    <Stack gap="md">
      <Group justify="flex-end"><Button leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>New plan</Button></Group>
      {plans.length === 0 ? (
        <EmptyState title="No plans yet" description="Create the first plan. Customers see a plan only after you publish it." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Plan</Table.Th><Table.Th>Status</Table.Th><Table.Th>Monthly</Table.Th><Table.Th>Annual</Table.Th><Table.Th>Version</Table.Th><Table.Th>Subscribers</Table.Th><Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {plans.map((p) => {
                const live = currentVersion(p);
                const draft = draftVersion(p);
                const subscribers = p.versions.reduce((n, v) => n + (v.subscribers ?? 0), 0);
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">{p.name}</Text>
                      <Text size="xs" c="dimmed">{p.code}</Text>
                    </Table.Td>
                    <Table.Td><StatusBadges item={p} /></Table.Td>
                    <Table.Td>{live ? formatKobo(live.priceMonthlyKobo) : <Text size="sm" c="dimmed">Not published</Text>}</Table.Td>
                    <Table.Td>{live ? formatKobo(live.priceAnnualKobo) : '-'}</Table.Td>
                    <Table.Td>
                      {live ? `v${live.version}` : '-'} {draft && <Badge size="xs" color="blue" variant="light" ml={4}>draft</Badge>}
                    </Table.Td>
                    <Table.Td>{subscribers.toLocaleString('en-NG')}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Button component={Link} href={`/plans/${p.id}`} size="xs" variant="light">Edit</Button>
                        <Button size="xs" variant="subtle" onClick={() => { setDup(p); setDupForm({ code: `${p.code}-copy`, name: `${p.name} copy` }); }}>Duplicate</Button>
                        <Button size="xs" variant="subtle" color={p.isArchived ? 'blue' : 'red'} onClick={() => setArchiving(p)} disabled={p.isOnboardingPlan && !p.isArchived}>{p.isArchived ? 'Restore' : 'Archive'}</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <NewItemModal kind="plan" opened={creating} onClose={() => setCreating(false)} />
      <Modal opened={!!dup} onClose={() => setDup(null)} title={`Duplicate ${dup?.name ?? ''}`}>
        <Stack>
          <TextInput label="New name" value={dupForm.name} onChange={(e) => setDupForm({ ...dupForm, name: e.currentTarget.value })} />
          <TextInput label="New code" value={dupForm.code} onChange={(e) => setDupForm({ ...dupForm, code: e.currentTarget.value.toLowerCase() })} />
          <Text size="sm" c="dimmed">The copy starts as a hidden draft with the same prices and contents.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDup(null)}>Cancel</Button>
            <Button onClick={() => duplicate.mutate()} loading={duplicate.isPending} disabled={!dupForm.name.trim() || !dupForm.code.trim()}>Duplicate</Button>
          </Group>
        </Stack>
      </Modal>
      <ConfirmDestructive
        opened={!!archiving}
        onClose={() => setArchiving(null)}
        onConfirm={async (reason) => { await archive.mutateAsync(reason); }}
        title={archiving?.isArchived ? 'Restore plan' : 'Archive plan'}
        description={archiving?.isArchived ? 'The plan comes back as a hidden plan. Turn it on when you want to sell it again.' : 'The plan is hidden and can no longer be bought. Associations already on it keep working, and their history stays intact.'}
        confirmLabel={archiving?.isArchived ? 'Restore' : 'Archive'}
        loading={archive.isPending}
      />
    </Stack>
  );
}

function AddonsTab() {
  const q = useQuery({ queryKey: billingKeys.addons, queryFn: () => bff<BuilderAddon[]>('admin/billing/addons') });
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<BuilderAddon | null>(null);
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: (reason: string) => send(`admin/billing/addons/${archiving!.id}/archive`, 'POST', { reason }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Add-on archived. Holders keep it until it ends.' }); setArchiving(null); void qc.invalidateQueries({ queryKey: ['billing'] }); },
    onError: (e) => notifications.show({ color: 'red', message: err(e) }),
  });
  if (q.isLoading) return <Skeleton h={200} radius="lg" />;
  if (q.isError) return <ErrorState message="Failed to load add-ons" onRetry={() => q.refetch()} />;
  const addons = q.data ?? [];
  return (
    <Stack gap="md">
      <Group justify="flex-end"><Button leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>New add-on</Button></Group>
      {addons.length === 0 ? (
        <EmptyState title="No add-ons yet" description="Add-ons are optional extras (for example more members). They renew with the plan they are added to." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Add-on</Table.Th><Table.Th>Status</Table.Th><Table.Th>Monthly</Table.Th><Table.Th>Annual</Table.Th><Table.Th>Available on</Table.Th><Table.Th>Holders</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {addons.map((a) => {
                const live = currentVersion(a);
                return (
                  <Table.Tr key={a.id}>
                    <Table.Td><Text fw={500} size="sm">{a.name}</Text><Text size="xs" c="dimmed">{a.code}</Text></Table.Td>
                    <Table.Td><StatusBadges item={a} /></Table.Td>
                    <Table.Td>{live ? formatKobo(live.priceMonthlyKobo) : <Text size="sm" c="dimmed">Not published</Text>}</Table.Td>
                    <Table.Td>{live ? formatKobo(live.priceAnnualKobo) : '-'}</Table.Td>
                    <Table.Td>{a.eligiblePlans.length ? a.eligiblePlans.map((e) => e.plan.name).join(', ') : 'Every plan'}</Table.Td>
                    <Table.Td>{a.versions.reduce((n, v) => n + (v.holders ?? 0), 0)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Button component={Link} href={`/plans/addons/${a.id}`} size="xs" variant="light">Edit</Button>
                        {!a.isArchived && <Button size="xs" variant="subtle" color="red" onClick={() => setArchiving(a)}>Archive</Button>}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      <NewItemModal kind="addon" opened={creating} onClose={() => setCreating(false)} />
      <ConfirmDestructive opened={!!archiving} onClose={() => setArchiving(null)} onConfirm={async (r) => { await archive.mutateAsync(r); }} title="Archive add-on" description="It can no longer be bought. Associations that already hold it keep it until it ends." confirmLabel="Archive" loading={archive.isPending} />
    </Stack>
  );
}

interface PreviewPlan {
  id: number; name: string; description: string | null; badgeLabel: string | null; isRecommended: boolean; isDraft: boolean; isPublic: boolean; isActive: boolean;
  prices: { monthly: string; annual: string; annualSavings: string; annualSavingsKobo: number };
  limits: { members?: number | null }; highlights: string[]; modules: { name: string; isCore: boolean }[];
}

function PreviewTab() {
  const q = useQuery({ queryKey: billingKeys.preview, queryFn: () => bff<PreviewPlan[]>('admin/billing/plans/preview') });
  const [annual, setAnnual] = useState(false);
  if (q.isLoading) return <Skeleton h={260} radius="lg" />;
  if (q.isError) return <ErrorState message="Failed to build the preview" onRetry={() => q.refetch()} />;
  const plans = q.data ?? [];
  return (
    <Stack gap="md">
      <Alert color="blue" icon={<IconAlertCircle size={16} />}>
        This is how the pricing page would look if every draft were published now. Drafts are marked. Nothing here is visible to customers until you publish.
      </Alert>
      <Switch label="Show annual prices" checked={annual} onChange={(e) => setAnnual(e.currentTarget.checked)} />
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {plans.map((p) => (
          <Card key={p.id} style={{ ...card, opacity: p.isPublic && p.isActive ? 1 : 0.6 }} p="xl" radius="lg">
            <Group justify="space-between" mb="xs">
              <Text fw={700} size="lg">{p.name}</Text>
              <Group gap={4}>
                {p.isDraft && <Badge color="blue" variant="light">Draft</Badge>}
                {!(p.isPublic && p.isActive) && <Badge color="yellow" variant="light">Not shown to customers</Badge>}
                {(p.badgeLabel || p.isRecommended) && <Badge>{p.badgeLabel ?? 'Recommended'}</Badge>}
              </Group>
            </Group>
            <Text size="xl" fw={700}>{annual ? p.prices.annual : p.prices.monthly}<Text span size="sm" c="dimmed"> {annual ? '/year' : '/month'}</Text></Text>
            {annual && p.prices.annualSavingsKobo > 0 && <Text size="xs" c="green">Save {p.prices.annualSavings} a year</Text>}
            {p.description && <Text size="sm" c="dimmed" mt="xs">{p.description}</Text>}
            <Stack gap={4} mt="md">
              <Text size="sm">{typeof p.limits.members === 'number' ? `Up to ${p.limits.members.toLocaleString('en-NG')} members` : 'Unlimited members'}</Text>
              {(p.highlights.length ? p.highlights : p.modules.filter((m) => !m.isCore).map((m) => m.name)).map((h) => <Text key={h} size="sm">• {h}</Text>)}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export function PlansOverview() {
  return (
    <Stack gap="xl">
      <PageHeader
        title="Plans & Pricing"
        description="Everything customers can buy, managed here. Changes you publish appear on the website, the pricing page and checkout at once. Existing subscribers keep the terms they bought until you migrate them."
      />
      <Tabs defaultValue="plans" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="plans">Plans</Tabs.Tab>
          <Tabs.Tab value="addons">Add-ons</Tabs.Tab>
          <Tabs.Tab value="preview">Pricing preview</Tabs.Tab>
          <Tabs.Tab value="migrations">Migrations</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plans"><PlansTab /></Tabs.Panel>
        <Tabs.Panel value="addons"><AddonsTab /></Tabs.Panel>
        <Tabs.Panel value="preview"><PreviewTab /></Tabs.Panel>
        <Tabs.Panel value="migrations"><MigrationsTab /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
