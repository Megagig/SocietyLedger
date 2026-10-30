'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Pagination, Select, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { formatKobo } from '@/lib/billing';
import { KIND_LABEL, MODEL_LABEL, ajoKeys, type GroupList } from '@/lib/ajo-admin';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;
const PAGE_SIZE = 25;

export default function AjoGroupsPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String((page - 1) * PAGE_SIZE) });
  if (applied) params.set('search', applied);
  if (kind) params.set('kind', kind);
  if (model) params.set('model', model);
  if (status) params.set('status', status);
  const qs = params.toString();

  const q = useQuery({ queryKey: ajoKeys.groups(qs), queryFn: () => bff<GroupList>(`admin/ajo-oversight/groups?${qs}`) });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <Stack gap="md">
      <PageHeader title="Ajo groups" description="Every circle on the platform, for associations and standalone thrift groups. Open one to see its members, payouts and cases." />
      <Group>
        <TextInput
          placeholder="Search by association or group name…"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setApplied(search.trim()); setPage(1); } }}
          onBlur={() => { setApplied(search.trim()); setPage(1); }}
          maw={320}
        />
        <Select placeholder="All owners" clearable value={kind} onChange={reset(setKind)} w={210} data={[{ value: 'ASSOCIATION', label: KIND_LABEL.ASSOCIATION }, { value: 'THRIFT_GROUP', label: KIND_LABEL.THRIFT_GROUP }]} />
        <Select placeholder="All types" clearable value={model} onChange={reset(setModel)} w={170} data={[{ value: 'ROTATING_POT', label: MODEL_LABEL.ROTATING_POT }, { value: 'COLLECTOR_THRIFT', label: MODEL_LABEL.COLLECTOR_THRIFT }]} />
        <Select placeholder="Any status" clearable value={status} onChange={reset(setStatus)} w={150} data={['DRAFT', 'OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
      </Group>

      {q.isLoading ? (
        <Skeleton h={300} radius="lg" />
      ) : q.isError ? (
        <ErrorState message="Failed to load the groups" onRetry={() => q.refetch()} />
      ) : !q.data || q.data.items.length === 0 ? (
        <EmptyState title="No groups found" description="Try a different search or filter." />
      ) : (
        <Card style={card} p="md" radius="lg">
          <Table withRowBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Group</Table.Th>
                <Table.Th>Owner</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>People</Table.Th>
                <Table.Th>Contribution</Table.Th>
                <Table.Th>Tier</Table.Th>
                <Table.Th>Needs a look</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {q.data.items.map((g) => (
                <Table.Tr key={g.id}>
                  <Table.Td><Text fw={500} size="sm">{g.name}</Text></Table.Td>
                  <Table.Td>
                    <Text size="sm">{g.association.name}</Text>
                    <Text size="xs" c="dimmed">{KIND_LABEL[g.association.kind]}</Text>
                  </Table.Td>
                  <Table.Td>{MODEL_LABEL[g.model]}</Table.Td>
                  <Table.Td><StatusBadge status={g.status} /></Table.Td>
                  <Table.Td>{g.participants} of {g.maxParticipants}</Table.Td>
                  <Table.Td>{formatKobo(g.contributionKobo)}</Table.Td>
                  <Table.Td>{g.tier ? g.tier.name : <Text size="sm" c="dimmed">None</Text>}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {g.openPayouts > 0 && <Badge size="sm" variant="light" color="blue">{g.openPayouts} open payout{g.openPayouts === 1 ? '' : 's'}</Badge>}
                      {g.overLimit && <Badge size="sm" variant="light" color="red">Over tier limit</Badge>}
                      {g.openCases > 0 && <Badge size="sm" variant="light" color="orange">{g.openCases} default case{g.openCases === 1 ? '' : 's'}</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td><Button component={Link} href={`/ajo/groups/${g.id}`} size="xs" variant="light">Open</Button></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {q.data.total > PAGE_SIZE && (
            <Group justify="center" mt="md"><Pagination total={Math.ceil(q.data.total / PAGE_SIZE)} value={page} onChange={setPage} size="sm" /></Group>
          )}
        </Card>
      )}
    </Stack>
  );
}
