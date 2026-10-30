'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Group, Pagination, Skeleton, Stack, Table, Tabs, Text } from '@mantine/core';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatShortDate } from '@/lib/format';
import { ajoKeys, type VerificationList } from '@/lib/ajo-admin';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const PAGE_SIZE = 25;

type Status = 'PENDING' | 'VERIFIED' | 'REJECTED';

function Queue({ status }: { status: Status }) {
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ status, take: String(PAGE_SIZE), skip: String((page - 1) * PAGE_SIZE) }).toString();
  const q = useQuery({ queryKey: ajoKeys.verifications(qs), queryFn: () => bff<VerificationList>(`admin/ajo/verifications?${qs}`) });

  if (q.isLoading) return <Skeleton h={240} radius="lg" />;
  if (q.isError) return <ErrorState message="Failed to load the verification queue" onRetry={() => q.refetch()} />;
  const data = q.data;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title={status === 'PENDING' ? 'Nothing waiting for review' : 'Nothing here yet'}
        description={status === 'PENDING' ? 'People appear here after their group approves them.' : 'Decided reviews will be listed here.'}
      />
    );
  }

  return (
    <Card style={card} p="md" radius="lg">
      <Table withRowBorders highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Person</Table.Th>
            <Table.Th>Group</Table.Th>
            <Table.Th>Payout account</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Put forward</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><Text fw={500} size="sm">{r.name}</Text></Table.Td>
              <Table.Td>{r.association.name}</Table.Td>
              <Table.Td>
                {r.payoutAccount ? <Text size="sm">{r.payoutAccount.bankName} {r.payoutAccount.masked}</Text> : <Text size="sm" c="dimmed">Not entered yet</Text>}
              </Table.Td>
              <Table.Td><StatusBadge status={r.status} /></Table.Td>
              <Table.Td>{formatShortDate(r.createdAt)}</Table.Td>
              <Table.Td><Button component={Link} href={`/ajo/verifications/${r.id}`} size="xs" variant="light">{r.status === 'PENDING' ? 'Review' : 'Open'}</Button></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {data.total > PAGE_SIZE && (
        <Group justify="center" mt="md"><Pagination total={Math.ceil(data.total / PAGE_SIZE)} value={page} onChange={setPage} size="sm" /></Group>
      )}
    </Card>
  );
}

export default function VerificationQueuePage() {
  return (
    <Stack gap="md">
      <PageHeader title="Ajo verification" description="The second step of joining a circle. Check each person against the short checklist, then verify them or reject with a reason the group admin will see." />
      <Tabs defaultValue="PENDING" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="PENDING">Waiting</Tabs.Tab>
          <Tabs.Tab value="VERIFIED">Verified</Tabs.Tab>
          <Tabs.Tab value="REJECTED">Rejected</Tabs.Tab>
        </Tabs.List>
        {(['PENDING', 'VERIFIED', 'REJECTED'] as const).map((s) => (
          <Tabs.Panel key={s} value={s}><Queue status={s} /></Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
