'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, Progress, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { IconCoin, IconUsers, IconBuildingCommunity } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { StatCard } from '@/components/StatCard';
import { formatDate } from '@/lib/format';
import { formatKobo } from '@/lib/billing';
import { MODEL_LABEL, ajoKeys, type AjoAnalytics } from '@/lib/ajo-admin';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)));
}

export default function AjoAnalyticsPage() {
  const q = useQuery({ queryKey: ajoKeys.analytics, queryFn: () => bff<AjoAnalytics>('admin/ajo-oversight/analytics') });

  if (q.isLoading) return <Skeleton h={420} radius="lg" />;
  if (q.isError || !q.data) return <ErrorState message={q.error instanceof Error ? q.error.message : 'Failed to load the analytics'} onRetry={() => q.refetch()} />;
  const a = q.data;
  const change = a.contributors.active - a.contributors.previousWindow;
  const maxLevy = Math.max(1, ...a.revenue.levySeries.map((m) => m.kobo));
  const levyEarned = a.revenue.levy.accruedKobo + a.revenue.levy.billedKobo + a.revenue.levy.paidKobo;
  const statusEntries = Object.entries(a.adoption.groups.byStatus);

  return (
    <Stack gap="md">
      <PageHeader title="Ajo analytics" description={`Adoption, who really contributes, and what Ajo earns. As of ${formatDate(a.asOf)}.`} />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard label="Groups with an Ajo tier" value={a.adoption.holders} icon={<IconBuildingCommunity size={16} />} trend={`${a.adoption.paying} paying`} />
        <StatCard
          label={`Active contributors, last ${a.contributors.windowDays} days`}
          value={a.contributors.active}
          icon={<IconUsers size={16} />}
          trend={`${change >= 0 ? '+' : ''}${change} against the 30 days before`}
          trendPositive={change >= 0}
        />
        <StatCard label="Tier subscriptions each month" value={formatKobo(a.revenue.subscriptionMonthlyKobo)} icon={<IconCoin size={16} />} trend="Paying groups only" />
        <StatCard label="Platform levy earned" value={formatKobo(levyEarned)} icon={<IconCoin size={16} />} trend={`${formatKobo(a.revenue.levy.paidKobo)} paid`} />
      </SimpleGrid>

      <Card style={card} p="lg" radius="lg">
        <Text fw={600} mb="sm">Adoption by tier</Text>
        {a.adoption.tiers.length === 0 ? (
          <Text size="sm" c="dimmed">No group holds an Ajo tier yet.</Text>
        ) : (
          <Table withRowBorders>
            <Table.Thead><Table.Tr><Table.Th>Tier</Table.Th><Table.Th>Groups</Table.Th><Table.Th>Paying</Table.Th><Table.Th>Standalone</Table.Th><Table.Th>Each month</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {a.adoption.tiers.map((t) => (
                <Table.Tr key={t.code}>
                  <Table.Td>{t.name}</Table.Td><Table.Td>{t.holders}</Table.Td><Table.Td>{t.paying}</Table.Td><Table.Td>{t.standalone}</Table.Td><Table.Td>{formatKobo(t.monthlyRecurringKobo)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Text size="xs" c="dimmed" mt="sm">
          {a.adoption.owners.associations} association{a.adoption.owners.associations === 1 ? '' : 's'} and {a.adoption.owners.standalone} standalone thrift group{a.adoption.owners.standalone === 1 ? '' : 's'} have created a circle.
          {statusEntries.length > 0 && ` Circles: ${statusEntries.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ')}.`}
          {Object.keys(a.adoption.groups.byModel).length > 0 && ` ${Object.entries(a.adoption.groups.byModel).map(([m, n]) => `${n} ${MODEL_LABEL[m as keyof typeof MODEL_LABEL] ?? m}`.toLowerCase()).join(', ')}.`}
        </Text>
      </Card>

      <Card style={card} p="lg" radius="lg">
        <Text fw={600} mb={4}>Platform levy, last 6 months</Text>
        <Text size="xs" c="dimmed" mb="md">Assessed in the month, not yet waived or voided. Billed to the group admin on the add-on invoice, never taken from contribution money.</Text>
        <Stack gap="sm">
          {a.revenue.levySeries.map((m) => (
            <div key={m.month}>
              <Text size="sm" fw={500}>{monthLabel(m.month)}: {formatKobo(m.kobo)}</Text>
              <Progress value={(m.kobo / maxLevy) * 100} size="sm" radius="xl" mt={4} aria-label={`${monthLabel(m.month)} levy`} />
            </div>
          ))}
        </Stack>
        <SimpleGrid cols={{ base: 2, sm: 4 }} mt="lg">
          <Stat label="Accrued" kobo={a.revenue.levy.accruedKobo} />
          <Stat label="Billed" kobo={a.revenue.levy.billedKobo} />
          <Stat label="Paid" kobo={a.revenue.levy.paidKobo} />
          <Stat label="Waived" kobo={a.revenue.levy.waivedKobo} />
        </SimpleGrid>
      </Card>
    </Stack>
  );
}

function Stat({ label, kobo }: { label: string; kobo: number }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">{label}</Text>
      <Text size="sm" fw={500}>{formatKobo(kobo)}</Text>
    </Stack>
  );
}
