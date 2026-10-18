'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import {
  Stack, Group, Button, Text, Pagination, SimpleGrid,
  Skeleton, Badge,
} from '@mantine/core';
import { IconDownload, IconActivity, IconUsers, IconShield } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionLog {
  id: number;
  actionType: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  performedAt: string;
  admin: { id: number; email: string } | null;
  association: { id: number; name: string; subdomain: string } | null;
}

interface ActionLogsResponse {
  logs: ActionLog[];
  total: number;
  totalPages: number;
}

interface ActionLogStats {
  totalActions: number;
  actionsToday: number;
  uniqueAdmins: number;
  mostCommonAction: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red',
  SUSPEND: 'orange', REACTIVATE: 'teal', IMPERSONATE: 'violet',
  APPROVE: 'green', REJECT: 'red', EXPORT: 'gray',
};

function actionColor(type: string): string {
  const key = Object.keys(ACTION_COLOR).find((k) => type.toUpperCase().includes(k));
  return key ? ACTION_COLOR[key] : 'gray';
}

function exportCsv(logs: ActionLog[]) {
  const rows = [
    ['ID', 'Time', 'Admin', 'Action', 'Target Type', 'Target', 'Association', 'Description'],
    ...logs.map((l) => [
      l.id,
      fmtDateTime(l.performedAt),
      l.admin?.email ?? '—',
      l.actionType,
      l.targetType,
      l.targetName ?? l.targetId ?? '—',
      l.association?.subdomain ?? '—',
      l.description,
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `action-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ActionLogsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [actionType, setActionType] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  const statsQ = useQuery({
    queryKey: ['action-log-stats'],
    queryFn: () => bff<ActionLogStats>('admin/action-logs/stats'),
  });

  const logsQ = useQuery({
    queryKey: ['action-logs', page, debouncedSearch, actionType, targetType, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (actionType) params.set('actionType', actionType);
      if (targetType) params.set('targetType', targetType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return bff<ActionLogsResponse>(`admin/action-logs?${params}`);
    },
  });

  const logs = logsQ.data?.logs ?? [];
  const totalPages = logsQ.data?.totalPages ?? 1;
  const hasActiveFilters = !!(debouncedSearch || actionType || targetType || startDate || endDate);

  return (
    <Stack gap="xl">
      <PageHeader
        title="Action Logs"
        description="Platform-level administrative actions performed by platform admins"
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

      {statsQ.isLoading ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={110} radius="lg" />)}
        </SimpleGrid>
      ) : statsQ.data ? (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard label="Total Actions" value={statsQ.data.totalActions.toLocaleString()} icon={<IconActivity size={16} />} />
          <StatCard label="Actions Today" value={statsQ.data.actionsToday.toLocaleString()} />
          <StatCard label="Unique Admins" value={statsQ.data.uniqueAdmins} icon={<IconUsers size={16} />} />
          <StatCard label="Most Common" value={statsQ.data.mostCommonAction ?? '—'} icon={<IconShield size={16} />} />
        </SimpleGrid>
      ) : null}

      <Group gap="sm" wrap="wrap">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search description or target…"
          filters={[
            {
              key: 'actionType',
              label: 'Action type',
              value: actionType,
              onChange: (v) => { setActionType(v); setPage(1); },
              options: [
                { value: 'CREATE', label: 'Create' },
                { value: 'UPDATE', label: 'Update' },
                { value: 'DELETE', label: 'Delete' },
                { value: 'SUSPEND', label: 'Suspend' },
                { value: 'REACTIVATE', label: 'Reactivate' },
                { value: 'IMPERSONATE', label: 'Impersonate' },
                { value: 'APPROVE', label: 'Approve' },
                { value: 'REJECT', label: 'Reject' },
              ],
            },
            {
              key: 'targetType',
              label: 'Target type',
              value: targetType,
              onChange: (v) => { setTargetType(v); setPage(1); },
              options: [
                { value: 'ASSOCIATION', label: 'Association' },
                { value: 'USER', label: 'User' },
                { value: 'PLAN', label: 'Plan' },
                { value: 'SETTINGS', label: 'Settings' },
                { value: 'BLOG', label: 'Blog' },
                { value: 'WEBHOOK', label: 'Webhook' },
              ],
            },
          ]}
          hasActiveFilters={hasActiveFilters}
          onReset={() => { setSearch(''); setActionType(null); setTargetType(null); setStartDate(''); setEndDate(''); setPage(1); }}
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
      ) : (
        <DataTable
          loading={logsQ.isLoading}
          rows={logs}
          rowKey={(r) => r.id}
          emptyMessage="No action logs found"
          columns={[
            {
              key: 'time',
              header: 'Time',
              render: (r) => (
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {fmtDateTime(r.performedAt)}
                </Text>
              ),
            },
            {
              key: 'admin',
              header: 'Admin',
              render: (r) => (
                <Text size="sm">{r.admin?.email ?? <Text size="sm" c="dimmed">System</Text>}</Text>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              render: (r) => (
                <Badge variant="light" size="sm" color={actionColor(r.actionType)}>
                  {r.actionType}
                </Badge>
              ),
            },
            {
              key: 'target',
              header: 'Target',
              render: (r) => (
                <Stack gap={0}>
                  <Text size="sm" fw={500}>{r.targetName ?? r.targetId ?? '—'}</Text>
                  <Text size="xs" c="dimmed">{r.targetType}</Text>
                </Stack>
              ),
            },
            {
              key: 'association',
              header: 'Association',
              render: (r) =>
                r.association ? (
                  <Stack gap={0}>
                    <Text size="sm">{r.association.name}</Text>
                    <Text size="xs" c="dimmed">{r.association.subdomain}</Text>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'description',
              header: 'Description',
              render: (r) => <Text size="sm">{r.description}</Text>,
            },
          ]}
        />
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
