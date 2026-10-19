'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Tabs, SimpleGrid, Grid, GridCol, Card, Text, Group, Stack,
  Badge, Button, Anchor, Modal, Select, Skeleton, Table,
  Divider, CopyButton, ActionIcon, Tooltip,
} from '@mantine/core';
import {
  IconBuilding, IconUsers, IconCurrencyDollar,
  IconActivity, IconCopy, IconCheck,
  IconShieldCheck, IconClock, IconExternalLink,
} from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ReasonField } from '@/components/ReasonField';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssociationDetail {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: string;
  status: string;
  logo: string | null;
  primaryColor: string | null;
  createdAt: string;
  users: { id: number; email: string; role: string }[];
  _count: { users: number; members: number; transactions: number; payments: number };
  subscriptions: Subscription[];
}

interface Subscription {
  id: number;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  plan: { name: string; priceMonthly: number };
  payments: Payment[];
}

interface Payment {
  amount: number;
  status: string;
  paidAt: string;
}

interface AssociationStats {
  activeMembers: number;
  totalRevenue: number;
  pendingTransactions: number;
}

interface EnabledModule {
  moduleId: string;
  moduleName: string;
  enabledAt: string;
  usageCount?: number;
}

interface AuditLog {
  id: number;
  action: string;
  tableName: string;
  createdAt: string;
  user: { email: string } | null;
}

interface DetailResponse {
  association: AssociationDetail;
  stats: AssociationStats;
  recentActivity: AuditLog[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

const TIER_COLOR: Record<string, string> = { ENTERPRISE: 'violet', PROFESSIONAL: 'blue', STARTER: 'gray' };

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

function OverviewTab({
  detail,
  stats,
}: {
  detail: AssociationDetail;
  stats: AssociationStats;
}) {
  const sub = detail.subscriptions?.[0];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
        <StatCard label="Users" value={detail._count.users} icon={<IconUsers size={16} />} />
        <StatCard label="Members" value={detail._count.members} icon={<IconUsers size={16} />} />
        <StatCard label="Active Members" value={stats.activeMembers} icon={<IconActivity size={16} />} />
        <StatCard label="Transactions" value={detail._count.transactions} icon={<IconCurrencyDollar size={16} />} />
        <StatCard label="Pending" value={stats.pendingTransactions} />
        <StatCard
          label="Revenue"
          value={fmtCurrency(stats.totalRevenue)}
          icon={<IconCurrencyDollar size={16} />}
        />
      </SimpleGrid>

      <Grid gutter="md">
        {/* Association info */}
        <GridCol span={{ base: 12, md: 6 }}>
          <Card
            style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
            p="lg"
            radius="lg"
            h="100%"
          >
            <Text fw={600} size="sm" mb="md">Association Details</Text>
            <Stack gap="sm">
              {[
                { label: 'ID', value: String(detail.id) },
                { label: 'Slug', value: detail.slug },
                { label: 'Created', value: fmtDate(detail.createdAt) },
              ].map(({ label, value }) => (
                <Group key={label} justify="space-between">
                  <Text size="sm" c="dimmed">{label}</Text>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>{value}</Text>
                    <CopyButton value={value} timeout={1500}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                          <ActionIcon size="xs" variant="subtle" color={copied ? 'green' : 'gray'} onClick={copy}>
                            {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </Group>
              ))}
              {/* Subdomain — clickable link */}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Subdomain</Text>
                <Anchor
                  href={`https://${detail.subdomain}.societyledger.com.ng`}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  fw={500}
                >
                  {detail.subdomain} <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                </Anchor>
              </Group>
              {detail.primaryColor && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Brand color</Text>
                  <Group gap="xs">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        backgroundColor: detail.primaryColor,
                        border: '1px solid var(--admin-border)',
                      }}
                    />
                    <Text size="sm" fw={500}>{detail.primaryColor}</Text>
                  </Group>
                </Group>
              )}
              {/* Admin contacts */}
              {detail.users?.length > 0 && (
                <>
                  <Divider my={4} />
                  <Text size="xs" fw={600} tt="uppercase" c="dimmed">Admin contacts</Text>
                  {detail.users.map((u) => (
                    <Group key={u.id} justify="space-between">
                      <Text size="sm" c="dimmed">Admin</Text>
                      <Anchor href={`mailto:${u.email}`} size="sm">{u.email}</Anchor>
                    </Group>
                  ))}
                </>
              )}
            </Stack>
          </Card>
        </GridCol>

        {/* Subscription summary */}
        <GridCol span={{ base: 12, md: 6 }}>
          <Card
            style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
            p="lg"
            radius="lg"
            h="100%"
          >
            <Text fw={600} size="sm" mb="md">Subscription Summary</Text>
            {sub ? (
              <Stack gap="sm">
                {[
                  { label: 'Plan', value: sub.plan.name },
                  { label: 'Billing', value: sub.billingCycle.toLowerCase() },
                  { label: 'Period ends', value: fmtDate(sub.currentPeriodEnd) },
                ].map(({ label, value }) => (
                  <Group key={label} justify="space-between">
                    <Text size="sm" c="dimmed">{label}</Text>
                    <Text size="sm" fw={500} tt="capitalize">{value}</Text>
                  </Group>
                ))}
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Status</Text>
                  <StatusBadge status={sub.status} size="sm" />
                </Group>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">No active subscription</Text>
            )}
          </Card>
        </GridCol>
      </Grid>
    </Stack>
  );
}

function BillingTab({ associationId }: { associationId: number }) {
  const q = useQuery({
    queryKey: ['assoc-detail', associationId],
    queryFn: () => bff<DetailResponse>(`admin/associations/${associationId}`),
  });

  if (q.isLoading) return <Skeleton h={200} radius="md" />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;

  const subs = q.data!.association.subscriptions ?? [];

  return (
    <Stack gap="lg">
      {subs.length === 0 ? (
        <Text size="sm" c="dimmed">No subscription records found.</Text>
      ) : (
        subs.map((sub) => (
          <Card
            key={sub.id}
            style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
            p="lg"
            radius="lg"
          >
            <Group justify="space-between" mb="md">
              <Stack gap={2}>
                <Text fw={600}>{sub.plan.name}</Text>
                <Text size="xs" c="dimmed">
                  {fmtCurrency(sub.plan.priceMonthly)} / month · {sub.billingCycle.toLowerCase()} billing
                </Text>
              </Stack>
              <StatusBadge status={sub.status} />
            </Group>
            <Divider mb="md" />
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="sm">Payment history</Text>
            {sub.payments?.length ? (
              <Table.ScrollContainer minWidth={360}>
                <Table fz="sm" withRowBorders={false} verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sub.payments.map((p, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{fmtDate(p.paidAt)}</Table.Td>
                        <Table.Td ta="right" fw={600}>{fmtCurrency(p.amount)}</Table.Td>
                        <Table.Td><StatusBadge status={p.status} size="xs" /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <Text size="sm" c="dimmed">No payment records.</Text>
            )}
          </Card>
        ))
      )}
    </Stack>
  );
}

function ModulesTab({ associationId }: { associationId: number }) {
  const q = useQuery({
    queryKey: ['assoc-modules', associationId],
    queryFn: () =>
      bff<{ modules: EnabledModule[] }>(`admin/associations/${associationId}/modules`),
  });

  if (q.isLoading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={60} radius="md" />)}
      </Stack>
    );
  }
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;

  const modules = q.data?.modules ?? [];

  return modules.length === 0 ? (
    <Text size="sm" c="dimmed">No modules enabled for this association.</Text>
  ) : (
    <Stack gap="sm">
      {modules.map((m) => (
        <Card
          key={m.moduleId}
          style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
          p="md"
          radius="md"
        >
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" fw={600}>{m.moduleName}</Text>
              <Text size="xs" c="dimmed">Enabled {fmtDate(m.enabledAt)}</Text>
            </Stack>
            {m.usageCount !== undefined && (
              <Text size="sm" c="dimmed">{m.usageCount.toLocaleString()} events</Text>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

function SecurityTab({ detail }: { detail: AssociationDetail }) {
  return (
    <Stack gap="md">
      <Card
        style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="lg"
        radius="lg"
      >
        <Text fw={600} size="sm" mb="md">Association Status</Text>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Platform status</Text>
            <StatusBadge status={detail.status} />
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Tier</Text>
            <Badge variant="light" color={TIER_COLOR[detail.tier] ?? 'gray'} size="sm" tt="capitalize">
              {detail.tier.toLowerCase()}
            </Badge>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Subdomain</Text>
            <Text size="sm" fw={500}>{detail.subdomain}</Text>
          </Group>
        </Stack>
      </Card>

      <Card
        style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="lg"
        radius="lg"
      >
        <Group gap="xs" mb="xs">
          <IconShieldCheck size={16} color="var(--mantine-color-green-6)" />
          <Text fw={600} size="sm">Security notes</Text>
        </Group>
        <Text size="sm" c="dimmed">
          Suspension blocks all authentication for this tenant. Impersonation sessions are
          time-limited (≤ 4 hours) and fully logged. Every destructive action requires a reason.
        </Text>
      </Card>
    </Stack>
  );
}

function ActivityTab({ associationId }: { associationId: number }) {
  const q = useQuery({
    queryKey: ['assoc-activity', associationId],
    queryFn: () =>
      bff<{ logs: AuditLog[] }>(`admin/associations/${associationId}/audit-logs`),
  });

  if (q.isLoading) return <Skeleton h={200} radius="md" />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;

  const logs = q.data?.logs ?? [];

  return logs.length === 0 ? (
    <Text size="sm" c="dimmed">No recent activity for this association.</Text>
  ) : (
    <Table.ScrollContainer minWidth={480}>
      <Table fz="sm" withTableBorder withColumnBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Action</Table.Th>
            <Table.Th>Table</Table.Th>
            <Table.Th>User</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {logs.map((log) => (
            <Table.Tr key={log.id}>
              <Table.Td fw={500}>{log.action}</Table.Td>
              <Table.Td c="dimmed">{log.tableName}</Table.Td>
              <Table.Td c="dimmed">{log.user?.email ?? 'System'}</Table.Td>
              <Table.Td c="dimmed">{fmtDate(log.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

// ── Impersonation modal ───────────────────────────────────────────────────────

function ImpersonateModal({
  associationId,
  associationName,
  opened,
  onClose,
}: {
  associationId: number;
  associationName: string;
  opened: boolean;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState<string | null>('1');

  const mut = useMutation({
    mutationFn: () =>
      bff<{ handoffCode: string; subdomain: string; expiresAt: string }>(
        `admin/associations/${associationId}/impersonate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, durationMinutes: Number(expiry) * 60 }),
        },
      ),
    onSuccess: (data) => {
      notifications.show({ message: `Impersonation session started for ${associationName}`, color: 'blue' });
      onClose();
      // Derive base domain from admin hostname (admin.foo.com → foo.com)
      const baseDomain = window.location.hostname.split('.').slice(1).join('.');
      const handoffUrl = `https://${data.subdomain}.${baseDomain}/auth/impersonate?code=${data.handoffCode}`;
      window.open(handoffUrl, '_blank', 'noopener,noreferrer');
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: 'red' });
    },
  });

  function handleClose() {
    setReason('');
    setExpiry('1');
    onClose();
  }

  const canSubmit = reason.trim().length > 0 && !!expiry;

  return (
    <Modal opened={opened} onClose={handleClose} title="Impersonate Association" centered size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          You will be redirected to <strong>{associationName}</strong> as an admin. The session is
          time-limited and logged. No platform credentials are transferred to the tenant.
        </Text>

        <ReasonField value={reason} onChange={setReason} label="Reason for impersonation" />

        <Select
          label="Session duration"
          data={[
            { value: '1', label: '1 hour' },
            { value: '2', label: '2 hours' },
            { value: '4', label: '4 hours (maximum)' },
          ]}
          value={expiry}
          onChange={setExpiry}
          allowDeselect={false}
          size="sm"
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="sm" onClick={handleClose} disabled={mut.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            leftSection={<IconExternalLink size={14} />}
            disabled={!canSubmit}
            loading={mut.isPending}
            onClick={() => mut.mutate()}
          >
            Start session
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page inner ────────────────────────────────────────────────────────────────

const TABS = ['overview', 'billing', 'modules', 'security', 'activity'] as const;

function AssociationDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const associationId = Number(params.id);
  const rawTab = searchParams.get('tab');
  const activeTab = TABS.includes(rawTab as (typeof TABS)[number]) ? rawTab! : 'overview';

  const [suspendOpened, { open: openSuspend, close: closeSuspend }] = useDisclosure(false);
  const [reactivateOpened, { open: openReactivate, close: closeReactivate }] = useDisclosure(false);
  const [impersonateOpened, { open: openImpersonate, close: closeImpersonate }] = useDisclosure(false);

  const q = useQuery({
    queryKey: ['assoc-detail', associationId],
    queryFn: () => bff<DetailResponse>(`admin/associations/${associationId}`),
    enabled: !!associationId,
  });

  const suspendMut = useMutation({
    mutationFn: (reason: string) =>
      bff(`admin/associations/${associationId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Association suspended', color: 'orange' });
      qc.invalidateQueries({ queryKey: ['assoc-detail', associationId] });
      qc.invalidateQueries({ queryKey: ['associations'] });
      closeSuspend();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const reactivateMut = useMutation({
    mutationFn: (reason: string) =>
      bff(`admin/associations/${associationId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Association reactivated', color: 'green' });
      qc.invalidateQueries({ queryKey: ['assoc-detail', associationId] });
      qc.invalidateQueries({ queryKey: ['associations'] });
      closeReactivate();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function setTab(tab: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  if (q.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton h={60} radius="md" />
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      </Stack>
    );
  }

  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }

  const { association, stats } = q.data!;

  return (
    <Stack gap="xl">
      <PageHeader
        title={
          <Group gap="sm" align="center">
            {association.name}
            <Badge
              variant="light"
              color={TIER_COLOR[association.tier] ?? 'gray'}
              size="md"
              tt="capitalize"
            >
              {association.tier.toLowerCase()}
            </Badge>
          </Group>
        }
        description={`${association.subdomain} · Created ${fmtDate(association.createdAt)}`}
        actions={
          <Group gap="xs">
            <Button
              component={Link}
              href="/associations"
              variant="subtle"
              size="sm"
              color="gray"
            >
              ← Back
            </Button>
            <Button
              variant="default"
              size="sm"
              leftSection={<IconShieldCheck size={14} />}
              onClick={openImpersonate}
            >
              Impersonate
            </Button>
            <StatusBadge status={association.status} />
            {association.status === 'ACTIVE' ? (
              <Button variant="light" color="orange" size="sm" onClick={openSuspend}>
                Suspend
              </Button>
            ) : association.status === 'SUSPENDED' ? (
              <Button variant="light" color="green" size="sm" onClick={openReactivate}>
                Reactivate
              </Button>
            ) : null}
          </Group>
        }
      />

      <Tabs value={activeTab} onChange={(v) => v && setTab(v)}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview" leftSection={<IconBuilding size={14} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="billing" leftSection={<IconCurrencyDollar size={14} />}>Subscription & billing</Tabs.Tab>
          <Tabs.Tab value="modules" leftSection={<IconActivity size={14} />}>Modules & features</Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconShieldCheck size={14} />}>Security</Tabs.Tab>
          <Tabs.Tab value="activity" leftSection={<IconClock size={14} />}>Activity</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <OverviewTab detail={association} stats={stats} />
        </Tabs.Panel>
        <Tabs.Panel value="billing">
          <BillingTab associationId={associationId} />
        </Tabs.Panel>
        <Tabs.Panel value="modules">
          <ModulesTab associationId={associationId} />
        </Tabs.Panel>
        <Tabs.Panel value="security">
          <SecurityTab detail={association} />
        </Tabs.Panel>
        <Tabs.Panel value="activity">
          <ActivityTab associationId={associationId} />
        </Tabs.Panel>
      </Tabs>

      {/* Modals */}
      <ConfirmDestructive
        opened={suspendOpened}
        onClose={closeSuspend}
        onConfirm={suspendMut.mutate}
        loading={suspendMut.isPending}
        title="Suspend Association"
        description={`Suspending "${association.name}" will immediately block all users on this tenant.`}
      />
      <ConfirmDestructive
        opened={reactivateOpened}
        onClose={closeReactivate}
        onConfirm={reactivateMut.mutate}
        loading={reactivateMut.isPending}
        title="Reactivate Association"
        description={`Reactivating "${association.name}" will restore access for all users on this tenant.`}
      />
      <ImpersonateModal
        associationId={associationId}
        associationName={association.name}
        opened={impersonateOpened}
        onClose={closeImpersonate}
      />
    </Stack>
  );
}

// ── Page export with Suspense boundary (required for useSearchParams) ─────────

export default function AssociationDetailPage() {
  return (
    <Suspense fallback={<Skeleton h={400} radius="md" />}>
      <AssociationDetailContent />
    </Suspense>
  );
}
