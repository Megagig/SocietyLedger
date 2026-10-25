'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import { Badge, Group, Pagination, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconClock, IconInbox, IconUserOff } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { DataTable } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { FilterBar } from '@/components/FilterBar';
import { StatCard } from '@/components/StatCard';
import {
  OPEN_STATUSES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  CATEGORY_LABELS,
  personName,
  type PlatformStats,
  type PlatformTicketList,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/support';

const PAGE_SIZE = 20;

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The inbox: Tier 2 tickets from association admins across every association. */
export function TicketsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<string | null>('open');
  const [priority, setPriority] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);

  const statsQ = useQuery({ queryKey: ['platform-ticket-stats'], queryFn: () => bff<PlatformStats>('admin/support/stats'), refetchInterval: 60_000 });

  const ticketsQ = useQuery({
    queryKey: ['platform-tickets', page, debouncedSearch, status, priority, category, assigned],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status === 'open') OPEN_STATUSES.forEach((s) => params.append('status', s));
      else if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (category) params.set('category', category);
      if (assigned === 'unassigned') params.set('unassigned', 'true');
      return bff<PlatformTicketList>(`admin/support/tickets?${params}`);
    },
    refetchInterval: 60_000,
  });

  const stats = statsQ.data;
  const tickets = ticketsQ.data?.tickets ?? [];
  const totalPages = Math.max(1, Math.ceil((ticketsQ.data?.total ?? 0) / PAGE_SIZE));
  const reset = () => {
    setSearch('');
    setStatus('open');
    setPriority(null);
    setCategory(null);
    setAssigned(null);
    setPage(1);
  };
  const change = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <Stack gap="lg">
      {statsQ.isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : stats ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Open tickets" value={stats.open} icon={<IconInbox size={16} />} />
          <StatCard label="Waiting on us" value={stats.waitingOnStaff} icon={<IconClock size={16} />} />
          <StatCard label="Unassigned" value={stats.unassigned} icon={<IconUserOff size={16} />} />
          <StatCard label="Resolved" value={stats.resolved} icon={<IconAlertTriangle size={16} />} />
        </SimpleGrid>
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={change(setSearch)}
        searchPlaceholder="Search subject, ticket number or association…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: change(setStatus),
            options: [
              { value: 'open', label: 'All open' },
              ...(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
            ],
          },
          {
            key: 'priority',
            label: 'Priority',
            value: priority,
            onChange: change(setPriority),
            options: (Object.keys(PRIORITY_LABELS) as TicketPriority[]).map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
          },
          {
            key: 'category',
            label: 'Category',
            value: category,
            onChange: change(setCategory),
            options: (Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          },
          {
            key: 'assigned',
            label: 'Assigned',
            value: assigned,
            onChange: change(setAssigned),
            options: [{ value: 'unassigned', label: 'Unassigned' }],
          },
        ]}
        hasActiveFilters={status !== 'open' || !!priority || !!category || !!assigned || !!search}
        onReset={reset}
      />

      {ticketsQ.isError ? (
        <ErrorState message={(ticketsQ.error as Error).message} onRetry={() => ticketsQ.refetch()} />
      ) : (
        <>
          <DataTable
            loading={ticketsQ.isLoading}
            rows={tickets}
            rowKey={(t) => t.id}
            emptyMessage="No tickets match these filters"
            columns={[
              {
                key: 'ticket',
                header: 'Ticket',
                render: (t) => (
                  <Stack gap={2}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed" ff="monospace">{t.ticketNumber}</Text>
                      {t.isEscalation && <Badge size="xs" variant="light" color="grape">Escalated</Badge>}
                    </Group>
                    <Text component={Link} href={`/support/tickets/${t.id}`} size="sm" fw={500} c="blue" lineClamp={1}>
                      {t.subject}
                    </Text>
                  </Stack>
                ),
              },
              { key: 'association', header: 'Association', render: (t) => <Text size="sm">{t.association.name}</Text> },
              { key: 'opener', header: 'Opened by', render: (t) => <Text size="sm">{personName(t.user)}</Text> },
              { key: 'category', header: 'Category', render: (t) => <Text size="sm">{CATEGORY_LABELS[t.category]}</Text> },
              {
                key: 'priority',
                header: 'Priority',
                render: (t) => <Badge size="sm" radius="sm" variant="light" color={PRIORITY_COLORS[t.priority]}>{PRIORITY_LABELS[t.priority]}</Badge>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (t) => <Badge size="sm" radius="sm" variant="light" color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>,
              },
              {
                key: 'assigned',
                header: 'Assigned',
                render: (t) => (t.assignedTo ? <Text size="sm">{personName(t.assignedTo)}</Text> : <Text size="sm" c="dimmed">Unassigned</Text>),
              },
              { key: 'updated', header: 'Updated', render: (t) => <Text size="sm" c="dimmed">{relativeTime(t.updatedAt)}</Text> },
            ]}
          />
          {totalPages > 1 && (
            <Group justify="center">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}
