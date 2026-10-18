'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Tabs, SimpleGrid, Card, Text, Group, Stack,
  Progress, Table, Select, Button, Skeleton, Badge, Anchor,
} from '@mantine/core';
import {
  IconDownload, IconBuilding, IconUsers,
  IconCurrencyDollar, IconTrendingDown,
} from '@tabler/icons-react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';
import { bff } from '@/lib/bff';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyticsOverview {
  totalRevenue: number;
  activeSubscriptions: number;
  churnRate: number;
  averageRevenuePerUser: number;
  currency?: string;
}

interface ModuleAdoption {
  moduleId: string;
  moduleName: string;
  activeCount: number;
  totalEnabled: number;
  adoptionRate: number;
}

interface ChurnData {
  month: string;
  churned: number;
  churnRate: number;
  recovered: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  subscriptions: number;
  newRevenue: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? '')).join(','),
    ),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OverviewTab({ months }: { months: number }) {
  const q = useQuery({
    queryKey: ['analytics-overview', months],
    queryFn: () => bff<AnalyticsOverview>(`admin/analytics/overview?months=${months}`),
  });

  if (q.isLoading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
      </SimpleGrid>
    );
  }
  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }
  const d = q.data!;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      <StatCard
        label="Total Revenue"
        value={fmtCurrency(d.totalRevenue, d.currency)}
        icon={<IconCurrencyDollar size={16} />}
      />
      <StatCard
        label="Active Subscriptions"
        value={d.activeSubscriptions.toLocaleString()}
        icon={<IconBuilding size={16} />}
      />
      <StatCard
        label="Churn Rate"
        value={fmtPct(d.churnRate)}
        icon={<IconTrendingDown size={16} />}
        trendPositive={false}
      />
      <StatCard
        label="Avg Revenue / User"
        value={fmtCurrency(d.averageRevenuePerUser, d.currency)}
        icon={<IconUsers size={16} />}
      />
    </SimpleGrid>
  );
}

function ModuleAdoptionTab() {
  const q = useQuery({
    queryKey: ['analytics-module-adoption'],
    queryFn: () => bff<{ modules: ModuleAdoption[] }>('admin/analytics/module-adoption'),
  });

  if (q.isLoading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={44} radius="sm" />)}
      </Stack>
    );
  }
  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }

  const modules = q.data?.modules ?? [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{modules.length} modules tracked</Text>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconDownload size={13} />}
          onClick={() =>
            exportCsv(
              modules as unknown as Record<string, unknown>[],
              'module-adoption.csv',
            )
          }
        >
          Export CSV
        </Button>
      </Group>
      <Stack gap="sm">
        {modules
          .sort((a, b) => b.adoptionRate - a.adoptionRate)
          .map((m) => (
            <Card
              key={m.moduleId}
              style={{
                backgroundColor: 'var(--admin-surface)',
                border: '1px solid var(--admin-border)',
              }}
              p="sm"
              radius="md"
            >
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={600}>{m.moduleName}</Text>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    {m.activeCount.toLocaleString()} / {m.totalEnabled.toLocaleString()}
                  </Text>
                  <Badge variant="light" size="sm" color={m.adoptionRate >= 60 ? 'green' : m.adoptionRate >= 30 ? 'orange' : 'red'}>
                    {fmtPct(m.adoptionRate)}
                  </Badge>
                </Group>
              </Group>
              <Progress value={m.adoptionRate} size="sm" radius="xl" color="ledger" />
            </Card>
          ))}
      </Stack>
    </Stack>
  );
}

function ChurnTab({ months }: { months: number }) {
  const q = useQuery({
    queryKey: ['analytics-churn', months],
    queryFn: () => bff<{ data: ChurnData[] }>(`admin/analytics/churn?months=${months}`),
  });

  if (q.isLoading) {
    return <Skeleton h={240} radius="md" />;
  }
  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }

  const rows = q.data?.data ?? [];

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          variant="default"
          size="xs"
          leftSection={<IconDownload size={13} />}
          onClick={() => exportCsv(rows as unknown as Record<string, unknown>[], 'churn-data.csv')}
        >
          Export CSV
        </Button>
      </Group>
      <Table.ScrollContainer minWidth={480}>
        <Table fz="sm" withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              <Table.Th ta="right">Churned</Table.Th>
              <Table.Th ta="right">Churn Rate</Table.Th>
              <Table.Th ta="right">Recovered</Table.Th>
              <Table.Th ta="right">Net</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">No churn data available</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td>{row.month}</Table.Td>
                  <Table.Td ta="right" c={row.churned > 0 ? 'red' : 'inherit'}>
                    {row.churned.toLocaleString()}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Badge
                      variant="light"
                      size="sm"
                      color={row.churnRate < 2 ? 'green' : row.churnRate < 5 ? 'orange' : 'red'}
                    >
                      {fmtPct(row.churnRate)}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right" c="green">{row.recovered.toLocaleString()}</Table.Td>
                  <Table.Td
                    ta="right"
                    fw={600}
                    c={row.recovered - row.churned >= 0 ? 'green' : 'red'}
                  >
                    {row.recovered - row.churned >= 0 ? '+' : ''}
                    {(row.recovered - row.churned).toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

function RevenueTab({ months }: { months: number }) {
  const q = useQuery({
    queryKey: ['analytics-revenue', months],
    queryFn: () => bff<{ data: RevenueData[]; currency?: string }>(`admin/analytics/revenue?months=${months}`),
  });

  if (q.isLoading) {
    return <Skeleton h={240} radius="md" />;
  }
  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }

  const rows = q.data?.data ?? [];
  const currency = q.data?.currency ?? 'NGN';
  const maxRevenue = rows.length ? Math.max(...rows.map((r) => r.revenue)) : 1;

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          variant="default"
          size="xs"
          leftSection={<IconDownload size={13} />}
          onClick={() => exportCsv(rows as unknown as Record<string, unknown>[], 'revenue-data.csv')}
        >
          Export CSV
        </Button>
      </Group>

      {/* Sparkline-style bar chart using Progress */}
      {rows.length > 0 && (
        <Card
          style={{
            backgroundColor: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
          }}
          p="md"
          radius="md"
        >
          <Text size="xs" c="dimmed" mb="sm">Monthly revenue trend</Text>
          <Stack gap={4}>
            {rows.slice(-6).map((row) => (
              <Stack key={row.month} gap={2}>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed" w={60}>{row.month}</Text>
                  <Text size="xs" fw={600}>{fmtCurrency(row.revenue, currency)}</Text>
                </Group>
                <Progress
                  value={(row.revenue / maxRevenue) * 100}
                  size="md"
                  radius="xs"
                  color="ledger"
                />
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      <Table.ScrollContainer minWidth={560}>
        <Table fz="sm" withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Month</Table.Th>
              <Table.Th ta="right">Revenue</Table.Th>
              <Table.Th ta="right">New Revenue</Table.Th>
              <Table.Th ta="right">Subscriptions</Table.Th>
              <Table.Th ta="right">ARPU</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text size="sm" c="dimmed" ta="center" py="md">No revenue data available</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td>{row.month}</Table.Td>
                  <Table.Td ta="right" fw={600}>{fmtCurrency(row.revenue, currency)}</Table.Td>
                  <Table.Td ta="right" c="green">
                    {row.newRevenue > 0 ? '+' : ''}{fmtCurrency(row.newRevenue, currency)}
                  </Table.Td>
                  <Table.Td ta="right">{row.subscriptions.toLocaleString()}</Table.Td>
                  <Table.Td ta="right" c="dimmed">
                    {row.subscriptions > 0
                      ? fmtCurrency(Math.round(row.revenue / row.subscriptions), currency)
                      : '—'}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const MONTHS_OPTIONS = [
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [months, setMonths] = useState('6');

  return (
    <Stack gap="xl">
      <PageHeader
        title="Platform Analytics"
        description="Revenue, adoption, and churn trends across the platform"
        actions={
          <Select
            data={MONTHS_OPTIONS}
            value={months}
            onChange={(v) => v && setMonths(v)}
            size="sm"
            w={160}
            allowDeselect={false}
          />
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="modules">Module Adoption</Tabs.Tab>
          <Tabs.Tab value="churn">Churn</Tabs.Tab>
          <Tabs.Tab value="revenue">Revenue</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <OverviewTab months={parseInt(months, 10)} />
        </Tabs.Panel>

        <Tabs.Panel value="modules">
          <ModuleAdoptionTab />
        </Tabs.Panel>

        <Tabs.Panel value="churn">
          <ChurnTab months={parseInt(months, 10)} />
        </Tabs.Panel>

        <Tabs.Panel value="revenue">
          <RevenueTab months={parseInt(months, 10)} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
