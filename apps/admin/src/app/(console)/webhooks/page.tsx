'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, SimpleGrid, Group, Text, Button, Badge,
  Skeleton, Modal, Card, Progress, Pagination,
} from '@mantine/core';
import {
  IconRefresh, IconPlayerPlay, IconTrash, IconWebhook,
  IconCheck, IconX, IconClock,
} from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WebhookChannel {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  failureRate: number;
  lastEventTime: string | null;
}

interface WebhookStats {
  paystack: WebhookChannel;
  custom: WebhookChannel;
  overall: WebhookChannel;
  recentEvents: WebhookEvent[];
}

interface WebhookEvent {
  id: number;
  eventType: string;
  source: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  statusCode: number | null;
  duration: number | null;
  errorMessage: string | null;
  payload: unknown;
  timestamp: string;
}

interface WebhookEventsResponse {
  events: WebhookEvent[];
  total: number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR = { success: 'green', failed: 'red', pending: 'blue', retrying: 'orange' } as const;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Channel card ──────────────────────────────────────────────────────────────

function ChannelCard({ title, channel, color }: { title: string; channel: WebhookChannel; color: string }) {
  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="lg"
      radius="lg"
    >
      <Group justify="space-between" mb="md">
        <Text fw={600} size="sm">{title}</Text>
        <Badge variant="light" color={color} size="sm">
          {channel.totalEvents.toLocaleString()} total
        </Badge>
      </Group>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" c="green">Success rate</Text>
          <Text size="xs" fw={600} c="green">{channel.successRate.toFixed(1)}%</Text>
        </Group>
        <Progress value={channel.successRate} color="green" size="sm" radius="xl" />
        <Group justify="space-between">
          <Group gap="xs">
            <IconCheck size={12} color="var(--mantine-color-green-5)" />
            <Text size="xs" c="dimmed">{channel.successfulEvents.toLocaleString()}</Text>
          </Group>
          <Group gap="xs">
            <Text size="xs" c="dimmed">{channel.failedEvents.toLocaleString()}</Text>
            <IconX size={12} color="var(--mantine-color-red-5)" />
          </Group>
        </Group>
        {channel.lastEventTime && (
          <Text size="xs" c="dimmed">
            Last: {fmtDateTime(channel.lastEventTime)}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ── Event detail modal ─────────────────────────────────────────────────────────

function EventDetailModal({ event, opened, onClose }: {
  event: WebhookEvent | null;
  opened: boolean;
  onClose: () => void;
}) {
  if (!event) return null;
  return (
    <Modal opened={opened} onClose={onClose} title={`Webhook Event #${event.id}`} size="lg">
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="sm">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Event type</Text>
            <Text size="sm" fw={500} ff="monospace">{event.eventType}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Source</Text>
            <Text size="sm">{event.source}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Status</Text>
            <Badge variant="light" size="sm" color={STATUS_COLOR[event.status]}>{event.status}</Badge>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Response code</Text>
            <Text size="sm" ff="monospace">{event.statusCode ?? '—'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Duration</Text>
            <Text size="sm">{event.duration != null ? `${event.duration}ms` : '—'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Time</Text>
            <Text size="sm">{fmtDateTime(event.timestamp)}</Text>
          </Stack>
        </SimpleGrid>
        {event.errorMessage && (
          <Card
            style={{ backgroundColor: 'var(--mantine-color-red-0)', border: '1px solid var(--mantine-color-red-3)' }}
            p="sm" radius="sm"
          >
            <Text size="sm" c="red" fw={500}>Error: {event.errorMessage}</Text>
          </Card>
        )}
        {event.payload != null && (
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>Payload</Text>
            <pre style={{ margin: 0, fontSize: 11, color: 'var(--mantine-color-dimmed)', overflow: 'auto', maxHeight: 300 }}>
              {JSON.stringify(event.payload as Record<string, unknown>, null, 2)}
            </pre>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [eventType, setEventType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const statsQ = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: () => bff<WebhookStats>('admin/webhooks/stats'),
    refetchInterval: 30_000,
  });

  const eventsQ = useQuery({
    queryKey: ['webhook-events', page, debouncedSearch, eventType, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (eventType) params.set('eventType', eventType);
      if (status) params.set('status', status);
      return bff<WebhookEventsResponse>(`admin/webhooks/events?${params}`);
    },
  });

  const retryFailedMut = useMutation({
    mutationFn: () => bff('admin/webhooks/retry-failed', { method: 'POST' }),
    onSuccess: () => {
      notifications.show({ message: 'Failed events queued for retry', color: 'green' });
      qc.invalidateQueries({ queryKey: ['webhook-stats'] });
      qc.invalidateQueries({ queryKey: ['webhook-events'] });
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const retryOneMut = useMutation({
    mutationFn: (id: number) => bff(`admin/webhooks/events/${id}/retry`, { method: 'POST' }),
    onSuccess: () => {
      notifications.show({ message: 'Event queued for retry', color: 'green' });
      qc.invalidateQueries({ queryKey: ['webhook-events'] });
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const events = eventsQ.data?.events ?? [];
  const totalPages = eventsQ.data?.totalPages ?? 1;
  const failedCount = statsQ.data?.overall.failedEvents ?? 0;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Webhooks"
        description="Monitor incoming webhook events and delivery health"
        actions={
          <Group gap="sm">
            <Button
              variant="default"
              size="sm"
              leftSection={<IconRefresh size={14} />}
              loading={statsQ.isFetching}
              onClick={() => statsQ.refetch()}
            >
              Refresh
            </Button>
            {failedCount > 0 && (
              <Button
                size="sm"
                color="orange"
                leftSection={<IconPlayerPlay size={14} />}
                loading={retryFailedMut.isPending}
                onClick={() => retryFailedMut.mutate()}
              >
                Retry {failedCount} failed
              </Button>
            )}
          </Group>
        }
      />

      {statsQ.isLoading ? (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={160} radius="lg" />)}
        </SimpleGrid>
      ) : statsQ.data ? (
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <ChannelCard title="Paystack" channel={statsQ.data.paystack} color="green" />
          <ChannelCard title="Custom" channel={statsQ.data.custom} color="blue" />
          <ChannelCard title="All webhooks" channel={statsQ.data.overall} color="violet" />
        </SimpleGrid>
      ) : statsQ.isError ? (
        <ErrorState message="Failed to load webhook stats" onRetry={() => statsQ.refetch()} />
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by event type or ID…"
        filters={[
          {
            key: 'eventType',
            label: 'Event type',
            value: eventType,
            onChange: (v) => { setEventType(v); setPage(1); },
            options: [
              { value: 'payment.success', label: 'Payment Success' },
              { value: 'payment.failed', label: 'Payment Failed' },
              { value: 'subscription.created', label: 'Subscription Created' },
              { value: 'subscription.renewed', label: 'Subscription Renewed' },
              { value: 'subscription.cancelled', label: 'Subscription Cancelled' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: (v) => { setStatus(v); setPage(1); },
            options: [
              { value: 'success', label: 'Success' },
              { value: 'failed', label: 'Failed' },
              { value: 'pending', label: 'Pending' },
              { value: 'retrying', label: 'Retrying' },
            ],
          },
        ]}
        hasActiveFilters={!!(debouncedSearch || eventType || status)}
        onReset={() => { setSearch(''); setEventType(null); setStatus(null); setPage(1); }}
      />

      {eventsQ.isError ? (
        <ErrorState message={(eventsQ.error as Error).message} onRetry={() => eventsQ.refetch()} />
      ) : (
        <DataTable
          loading={eventsQ.isLoading}
          rows={events}
          rowKey={(r) => r.id}
          emptyMessage="No webhook events found"
          columns={[
            {
              key: 'id',
              header: '#',
              render: (r) => <Text size="xs" ff="monospace" c="dimmed">{r.id}</Text>,
            },
            {
              key: 'type',
              header: 'Event type',
              render: (r) => <Text size="sm" ff="monospace">{r.eventType}</Text>,
            },
            {
              key: 'source',
              header: 'Source',
              render: (r) => <Badge variant="light" size="xs">{r.source}</Badge>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant="light" size="sm" color={STATUS_COLOR[r.status]}>
                  {r.status}
                </Badge>
              ),
            },
            {
              key: 'code',
              header: 'Code',
              render: (r) => (
                <Text size="xs" ff="monospace" c={r.statusCode && r.statusCode >= 400 ? 'red' : 'dimmed'}>
                  {r.statusCode ?? '—'}
                </Text>
              ),
            },
            {
              key: 'duration',
              header: 'Duration',
              render: (r) => <Text size="xs" c="dimmed">{r.duration != null ? `${r.duration}ms` : '—'}</Text>,
            },
            {
              key: 'time',
              header: 'Time',
              render: (r) => <Text size="xs" c="dimmed">{fmtDateTime(r.timestamp)}</Text>,
            },
            {
              key: 'actions',
              header: '',
              render: (r) => (
                <Group gap="xs" wrap="nowrap">
                  <Button
                    variant="subtle" size="compact-xs" color="blue"
                    onClick={() => { setSelectedEvent(r); openDetail(); }}
                  >
                    View
                  </Button>
                  {r.status === 'failed' && (
                    <Button
                      variant="subtle" size="compact-xs" color="orange"
                      leftSection={<IconPlayerPlay size={10} />}
                      loading={retryOneMut.isPending && retryOneMut.variables === r.id}
                      onClick={() => retryOneMut.mutate(r.id)}
                    >
                      Retry
                    </Button>
                  )}
                </Group>
              ),
            },
          ]}
        />
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      <EventDetailModal event={selectedEvent} opened={detailOpened} onClose={closeDetail} />
    </Stack>
  );
}
