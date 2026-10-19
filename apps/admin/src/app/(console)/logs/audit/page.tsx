'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import {
  Stack, Group, Button, Text, Pagination, Badge, Collapse,
  Card, Skeleton,
} from '@mantine/core';
import { IconDownload, IconChevronDown, IconChevronRight, IconShield } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { FilterBar } from '@/components/FilterBar';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  actorType: 'ADMIN' | 'USER' | 'SYSTEM';
  actorId: number | null;
  actorEmail: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  occurredAt: string;
  association: { id: number; name: string; subdomain: string } | null;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  INFO: 'blue', WARNING: 'orange', ERROR: 'red', CRITICAL: 'red',
} as const;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function exportCsv(logs: AuditLog[]) {
  const rows = [
    ['ID', 'Time', 'Severity', 'Event', 'Actor', 'Target', 'IP', 'Association'],
    ...logs.map((l) => [
      l.id, fmtDateTime(l.occurredAt), l.severity, l.eventType,
      l.actorEmail ?? l.actorType,
      l.targetName ?? l.targetId ?? '—',
      l.ipAddress ?? '—',
      l.association?.subdomain ?? '—',
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Expandable row ─────────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="sm"
      radius="md"
    >
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap="xs" wrap="wrap" style={{ flex: 1 }}>
          <Badge
            variant="filled"
            size="xs"
            color={SEVERITY_COLOR[log.severity]}
            tt="uppercase"
          >
            {log.severity}
          </Badge>
          <Text size="sm" fw={500}>{log.eventType}</Text>
          <Text size="xs" c="dimmed">
            {log.actorEmail ?? log.actorType}
            {log.targetName ? ` → ${log.targetName}` : ''}
          </Text>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {fmtDateTime(log.occurredAt)}
          </Text>
          {log.details && (
            <Button
              variant="subtle"
              size="compact-xs"
              color="gray"
              rightSection={expanded ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />}
              onClick={() => setExpanded((v) => !v)}
            >
              Details
            </Button>
          )}
        </Group>
      </Group>

      <Collapse in={expanded} mt="xs">
        <Card
          style={{ backgroundColor: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
          p="sm"
          radius="sm"
        >
          <Group gap="xl" wrap="wrap" mb="xs">
            {log.ipAddress && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={500}>IP</Text>
                <Text size="xs" ff="monospace">{log.ipAddress}</Text>
              </Stack>
            )}
            {log.association && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={500}>Association</Text>
                <Text size="xs">{log.association.name} ({log.association.subdomain})</Text>
              </Stack>
            )}
            {log.targetType && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={500}>Target type</Text>
                <Text size="xs">{log.targetType}</Text>
              </Stack>
            )}
            {log.targetId && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={500}>Target ID</Text>
                <Text size="xs" ff="monospace">{log.targetId}</Text>
              </Stack>
            )}
          </Group>
          {log.details && (
            <pre style={{ margin: 0, fontSize: 11, color: 'var(--mantine-color-dimmed)', overflow: 'auto' }}>
              {JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </Card>
      </Collapse>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [severity, setSeverity] = useState<string | null>(null);
  const [eventType, setEventType] = useState<string | null>(null);
  const [actorType, setActorType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const logsQ = useQuery({
    queryKey: ['audit-logs', page, debouncedSearch, severity, eventType, actorType, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (severity) params.set('severity', severity);
      if (eventType) params.set('eventType', eventType);
      if (actorType) params.set('actorType', actorType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return bff<AuditLogsResponse>(`admin/audit-logs?${params}`);
    },
  });

  const logs = logsQ.data?.logs ?? [];
  const totalPages = logsQ.data?.totalPages ?? 1;
  const hasActiveFilters = !!(debouncedSearch || severity || eventType || actorType || startDate || endDate);

  return (
    <Stack gap="xl">
      <PageHeader
        title="Audit Log"
        description="Immutable security-relevant event log across all tenants"
        actions={
          <Button
            variant="default"
            size="sm"
            leftSection={<IconDownload size={14} />}
            disabled={logs.length === 0}
            onClick={() => exportCsv(logs)}
          >
            Export CSV
          </Button>
        }
      />

      <Group gap="sm" wrap="wrap">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search events…"
          filters={[
            {
              key: 'severity',
              label: 'Severity',
              value: severity,
              onChange: (v) => { setSeverity(v); setPage(1); },
              options: [
                { value: 'INFO', label: 'Info' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'ERROR', label: 'Error' },
                { value: 'CRITICAL', label: 'Critical' },
              ],
            },
            {
              key: 'actorType',
              label: 'Actor',
              value: actorType,
              onChange: (v) => { setActorType(v); setPage(1); },
              options: [
                { value: 'ADMIN', label: 'Admin' },
                { value: 'USER', label: 'User' },
                { value: 'SYSTEM', label: 'System' },
              ],
            },
          ]}
          hasActiveFilters={hasActiveFilters}
          onReset={() => { setSearch(''); setSeverity(null); setEventType(null); setActorType(null); setStartDate(''); setEndDate(''); setPage(1); }}
        />
        <Group gap="xs" align="flex-end">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>From</Text>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--admin-border)',
                borderRadius: 6,
                background: 'var(--admin-surface)',
                color: 'inherit',
                fontSize: 13,
              }}
            />
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>To</Text>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--admin-border)',
                borderRadius: 6,
                background: 'var(--admin-surface)',
                color: 'inherit',
                fontSize: 13,
              }}
            />
          </Stack>
        </Group>
      </Group>

      {logsQ.isError ? (
        <ErrorState message={(logsQ.error as Error).message} onRetry={() => logsQ.refetch()} />
      ) : logsQ.isLoading ? (
        <Stack gap="xs">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} h={48} radius="md" />)}
        </Stack>
      ) : logs.length === 0 ? (
        <Card
          style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
          p="xl"
          radius="lg"
          ta="center"
        >
          <IconShield size={32} style={{ color: 'var(--mantine-color-dimmed)', marginBottom: 8 }} />
          <Text c="dimmed">No audit events found</Text>
        </Card>
      ) : (
        <Stack gap="xs">
          {logs.map((log) => <AuditRow key={log.id} log={log} />)}
        </Stack>
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
