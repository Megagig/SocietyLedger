'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { billingKeys, formatKobo, type BuilderAddon, type BuilderVersion } from '@/lib/billing';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;

const published = (a: BuilderAddon): BuilderVersion | undefined => a.versions.find((v) => v.status === 'PUBLISHED');
const draft = (a: BuilderAddon): BuilderVersion | undefined => a.versions.find((v) => v.status === 'DRAFT');

function contributors(v: BuilderVersion | undefined): string {
  if (!v) return '-';
  const n = v.limits?.ajoContributors;
  return n === null || n === undefined ? 'Unlimited' : String(n);
}

/**
 * Ajo pricing (T9). The Ajo tiers are ordinary add-ons in the 'ajo' family, so prices are changed in the Plan Builder's add-on editor
 * (draft, preview, publish). This page lists only those tiers and links into that flow; it has no editor of its own, so a price change
 * keeps the same safeguards: people already on a tier stay on the version they bought until they are migrated.
 */
export default function AjoPricingPage() {
  const q = useQuery({ queryKey: billingKeys.addons, queryFn: () => bff<BuilderAddon[]>('admin/billing/addons') });
  const tiers = (q.data ?? []).filter((a) => a.family === 'ajo').sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Stack gap="md">
      <PageHeader
        title="Ajo pricing"
        description="The price and size of each Ajo tier. Open a tier to draft a change, preview it and publish. Groups already on a tier keep the version they bought."
        actions={<Button component={Link} href="/plans" variant="default" size="sm">All plans and add-ons</Button>}
      />
      {q.isLoading ? (
        <Skeleton h={260} radius="lg" />
      ) : q.isError ? (
        <ErrorState message="Failed to load the Ajo tiers" onRetry={() => q.refetch()} />
      ) : tiers.length === 0 ? (
        <EmptyState title="No Ajo tiers found" description="The Ajo add-on tiers are created when the server starts. Check the seed has run." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Monthly</Table.Th>
                <Table.Th>Annual</Table.Th>
                <Table.Th>Active contributors</Table.Th>
                <Table.Th>Groups on it</Table.Th>
                <Table.Th>State</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tiers.map((a) => {
                const p = published(a);
                const d = draft(a);
                return (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">{a.name}</Text>
                      <Text size="xs" c="dimmed">{a.code}{p ? ` · v${p.version}` : ''}</Text>
                    </Table.Td>
                    <Table.Td>{p ? formatKobo(p.priceMonthlyKobo) : '-'}</Table.Td>
                    <Table.Td>{p ? formatKobo(p.priceAnnualKobo) : '-'}</Table.Td>
                    <Table.Td>{contributors(p)}</Table.Td>
                    <Table.Td>{p?.holders ?? 0}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        {!a.isPublic && <Badge size="sm" variant="light" color="gray">Not on the price list</Badge>}
                        {d && <Badge size="sm" variant="light" color="blue">Draft v{d.version}</Badge>}
                        {!p && <Badge size="sm" variant="light" color="orange">Nothing published</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td><Button component={Link} href={`/plans/addons/${a.id}`} size="xs" variant="light">Edit price</Button></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
