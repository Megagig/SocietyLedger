'use client';

import { useQuery } from '@tanstack/react-query';
import {
  SimpleGrid, Grid, GridCol, Card, Text, Group, Stack,
  Progress, Button, Table, Skeleton, Anchor, Badge,
} from '@mantine/core';
import {
  IconBuilding, IconUsers, IconCurrencyDollar,
  IconTrendingUp, IconActivity, IconArrowRight, IconChartBar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/StatusBadge';
import { bff } from '@/lib/bff';

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  overview: {
    totalAssociations: number;
    activeAssociations: number;
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    monthlyRevenue: number;
  };
  growth: {
    newAssociationsThisMonth: number;
    newUsersThisMonth: number;
    revenueGrowth: number;
  };
  subscriptions: {
    active: number;
    trialing: number;
    pastDue: number;
    cancelled: number;
  };
  tiers: Array<{
    tier: string;
    count: number;
    percentage: number;
  }>;
  revenue: {
    mrr: number;
    arr: number;
    currency: string;
  };
}

interface PendingApproval {
  id: string;
  associationName: string;
  adminEmail: string;
  adminName: string;
  createdAt: string;
  status: string;
}

interface ActionLog {
  id: number;
  actionType: string;
  targetType: string | null;
  targetName: string | null;
  performedAt: string;
  admin: { id: number; email: string } | null;
  association: { id: number; name: string; subdomain: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAction(raw: string) {
  return raw.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

// ── Quick links ───────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Associations', href: '/associations', desc: 'Manage platform tenants' },
  { label: 'Approvals', href: '/approvals', desc: 'Review pending sign-ups' },
  { label: 'Settlements', href: '/settlements', desc: 'Daily financial settlements' },
  { label: 'Webhooks', href: '/webhooks', desc: 'Event delivery & retry' },
  { label: 'Platform Settings', href: '/settings', desc: 'Configuration & limits' },
  { label: 'Support Desk', href: '/support', desc: 'Open support tickets' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      style={{
        backgroundColor: 'var(--admin-surface)',
        border: '1px solid var(--admin-border)',
      }}
      p="lg"
      radius="lg"
      h="100%"
    >
      <Group justify="space-between" mb="md">
        <Text fw={600} size="sm">{title}</Text>
        {href && linkLabel && (
          <Anchor component={Link} href={href} size="xs" c="dimmed">
            {linkLabel} <IconArrowRight size={11} style={{ verticalAlign: 'middle' }} />
          </Anchor>
        )}
      </Group>
      {children}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const statsQ = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => bff<Stats>('admin/stats'),
  });

  const approvalsQ = useQuery({
    queryKey: ['admin-approvals-widget'],
    queryFn: () =>
      bff<{ approvals: PendingApproval[]; total: number }>('admin/approvals?limit=5&status=pending'),
  });

  const logsQ = useQuery({
    queryKey: ['admin-action-logs-widget'],
    queryFn: () =>
      bff<{ logs: ActionLog[]; total: number }>('admin/action-logs?limit=10'),
  });

  const s = statsQ.data;

  // total subscription count for progress bar ratios
  const subTotal = s
    ? s.subscriptions.active + s.subscriptions.trialing + s.subscriptions.pastDue + s.subscriptions.cancelled
    : 0;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Platform Dashboard"
        description="Overview of SocietyLedger platform health and activity"
        actions={
          <Button
            component={Link}
            href="/analytics"
            variant="default"
            size="sm"
            leftSection={<IconChartBar size={14} />}
          >
            View Analytics
          </Button>
        }
      />

      {/* KPI grid */}
      {statsQ.isError ? (
        <ErrorState
          title="Failed to load statistics"
          message={(statsQ.error as Error).message}
          onRetry={() => statsQ.refetch()}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {statsQ.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} h={110} radius="lg" />
            ))
          ) : s ? (
            <>
              <StatCard
                label="Total Associations"
                value={s.overview.totalAssociations.toLocaleString()}
                icon={<IconBuilding size={16} />}
                trend={`+${s.growth.newAssociationsThisMonth} this month`}
                trendPositive={s.growth.newAssociationsThisMonth > 0}
              />
              <StatCard
                label="Active Associations"
                value={s.overview.activeAssociations.toLocaleString()}
                icon={<IconBuilding size={16} />}
              />
              <StatCard
                label="Total Users"
                value={s.overview.totalUsers.toLocaleString()}
                icon={<IconUsers size={16} />}
                trend={`+${s.growth.newUsersThisMonth} this month`}
                trendPositive={s.growth.newUsersThisMonth > 0}
              />
              <StatCard
                label="Active Users"
                value={s.overview.activeUsers.toLocaleString()}
                icon={<IconActivity size={16} />}
              />
              <StatCard
                label="Monthly Revenue"
                value={fmtCurrency(s.overview.monthlyRevenue, s.revenue.currency)}
                icon={<IconCurrencyDollar size={16} />}
                trend={
                  s.growth.revenueGrowth > 0
                    ? `+${s.growth.revenueGrowth}% vs last month`
                    : `${s.growth.revenueGrowth}% vs last month`
                }
                trendPositive={s.growth.revenueGrowth > 0}
              />
              <StatCard
                label="ARR"
                value={fmtCurrency(s.revenue.arr, s.revenue.currency)}
                icon={<IconTrendingUp size={16} />}
                trend={`MRR ${fmtCurrency(s.revenue.mrr, s.revenue.currency)}`}
              />
            </>
          ) : null}
        </SimpleGrid>
      )}

      {/* Subscription breakdown + Tier distribution + Approvals */}
      <Grid gutter="md">
        <GridCol span={{ base: 12, md: 4 }}>
          <SectionCard title="Subscription Health">
            {statsQ.isLoading ? (
              <Stack gap="sm">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={28} radius="sm" />)}
              </Stack>
            ) : s && subTotal > 0 ? (
              <Stack gap="sm">
                {[
                  { label: 'Active', value: s.subscriptions.active, color: 'green' },
                  { label: 'Trialing', value: s.subscriptions.trialing, color: 'blue' },
                  { label: 'Past Due', value: s.subscriptions.pastDue, color: 'orange' },
                  { label: 'Cancelled', value: s.subscriptions.cancelled, color: 'red' },
                ].map(({ label, value, color }) => (
                  <Stack key={label} gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">{label}</Text>
                      <Text size="xs" fw={600}>{value.toLocaleString()}</Text>
                    </Group>
                    <Progress
                      value={(value / subTotal) * 100}
                      color={color}
                      size="sm"
                      radius="xl"
                    />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">No subscription data</Text>
            )}
          </SectionCard>
        </GridCol>

        <GridCol span={{ base: 12, md: 4 }}>
          <SectionCard title="Tier Distribution">
            {statsQ.isLoading ? (
              <Stack gap="sm">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={28} radius="sm" />)}
              </Stack>
            ) : s && s.tiers.length > 0 ? (
              <Stack gap="sm">
                {s.tiers.map(({ tier, count, percentage }) => (
                  <Stack key={tier} gap={4}>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="capitalize">{tier.toLowerCase()}</Text>
                      <Text size="xs" fw={600}>
                        {count.toLocaleString()}{' '}
                        <Text component="span" c="dimmed" fw={400}>({percentage}%)</Text>
                      </Text>
                    </Group>
                    <Progress value={percentage} color="ledger" size="sm" radius="xl" />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">No tier data</Text>
            )}
          </SectionCard>
        </GridCol>

        <GridCol span={{ base: 12, md: 4 }}>
          <SectionCard title="Pending Approvals" href="/approvals" linkLabel="View all">
            {approvalsQ.isLoading ? (
              <Stack gap="xs">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={36} radius="sm" />)}
              </Stack>
            ) : approvalsQ.isError ? (
              <Text size="sm" c="red">Failed to load approvals</Text>
            ) : approvalsQ.data?.approvals.length === 0 ? (
              <Text size="sm" c="dimmed">No pending approvals</Text>
            ) : (
              <Stack gap="xs">
                {approvalsQ.data?.approvals.map((a) => (
                  <Group key={a.id} justify="space-between" wrap="nowrap">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={600} truncate>{a.associationName}</Text>
                      <Text size="xs" c="dimmed" truncate>{a.adminEmail}</Text>
                    </Stack>
                    <Stack align="flex-end" gap={2}>
                      <StatusBadge status={a.status} size="xs" />
                      <Text size="xs" c="dimmed">{fmtDate(a.createdAt)}</Text>
                    </Stack>
                  </Group>
                ))}
                {(approvalsQ.data?.total ?? 0) > 5 && (
                  <Text size="xs" c="dimmed" ta="center">
                    +{(approvalsQ.data?.total ?? 0) - 5} more
                  </Text>
                )}
              </Stack>
            )}
          </SectionCard>
        </GridCol>
      </Grid>

      {/* Recent action logs */}
      <SectionCard title="Recent Platform Activity" href="/logs/actions" linkLabel="View all">
        {logsQ.isLoading ? (
          <Stack gap="xs">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={36} radius="sm" />)}
          </Stack>
        ) : logsQ.isError ? (
          <Text size="sm" c="red">Failed to load activity log</Text>
        ) : logsQ.data?.logs.length === 0 ? (
          <Text size="sm" c="dimmed">No recent activity</Text>
        ) : (
          <Table.ScrollContainer minWidth={480}>
            <Table fz="sm" withRowBorders={false} verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Performed by</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logsQ.data?.logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <Badge variant="light" size="sm" color="ledger" radius="sm">
                        {fmtAction(log.actionType)}
                      </Badge>
                    </Table.Td>
                    <Table.Td c="dimmed">{log.admin?.email ?? 'System'}</Table.Td>
                    <Table.Td c="dimmed">{log.targetType ?? '—'}</Table.Td>
                    <Table.Td c="dimmed">{fmtDate(log.performedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </SectionCard>

      {/* Quick links */}
      <Stack gap="sm">
        <Text fw={600} size="sm">Quick access</Text>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          {QUICK_LINKS.map(({ label, href, desc }) => (
            <Card
              key={href}
              component={Link}
              href={href}
              style={{
                backgroundColor: 'var(--admin-surface)',
                border: '1px solid var(--admin-border)',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
              p="md"
              radius="md"
            >
              <Text fw={600} size="xs">{label}</Text>
              <Text size="xs" c="dimmed" mt={2}>{desc}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
