'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Text, Button, Badge, Pagination, Card,
  SimpleGrid, Alert,
} from '@mantine/core';
import { IconShield, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImpersonationSession {
  id: number;
  adminId: number;
  adminEmail: string;
  associationId: number;
  associationName: string;
  subdomain: string;
  reason: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

interface ImpersonationResponse {
  sessions: ImpersonationSession[];
  total: number;
  totalPages: number;
}

interface ImpersonationStats {
  activeSessions: number;
  sessionsToday: number;
  totalSessions: number;
  uniqueAdmins: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ImpersonationPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);

  const statsQ = useQuery({
    queryKey: ['impersonation-stats'],
    queryFn: () => bff<ImpersonationStats>('admin/impersonation/stats'),
  });

  const sessionsQ = useQuery({
    queryKey: ['impersonation-sessions', page, activeOnly],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeOnly) params.set('activeOnly', 'true');
      return bff<ImpersonationResponse>(`admin/impersonation/sessions?${params}`);
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) =>
      bff(`admin/impersonation/sessions/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => {
      notifications.show({ message: 'Session revoked', color: 'orange' });
      qc.invalidateQueries({ queryKey: ['impersonation-sessions'] });
      qc.invalidateQueries({ queryKey: ['impersonation-stats'] });
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const sessions = sessionsQ.data?.sessions ?? [];
  const totalPages = sessionsQ.data?.totalPages ?? 1;
  const stats = statsQ.data;
  const activeSessions = sessions.filter((s) => s.isActive && !isExpired(s.expiresAt));

  return (
    <Stack gap="xl">
      <PageHeader
        title="Impersonation Log"
        description="Audit trail of all admin impersonation sessions — who accessed which tenant, when, and why"
      />

      {stats && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard
            label="Active sessions"
            value={stats.activeSessions}
            icon={<IconShield size={16} />}
          />
          <StatCard label="Sessions today" value={stats.sessionsToday} />
          <StatCard label="Total sessions" value={stats.totalSessions} />
          <StatCard label="Unique admins" value={stats.uniqueAdmins} />
        </SimpleGrid>
      )}

      {activeSessions.length > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          <Text size="sm" fw={700} mb="xs">
            {activeSessions.length} active impersonation session{activeSessions.length !== 1 ? 's' : ''}
          </Text>
          <Stack gap="xs">
            {activeSessions.map((s) => (
              <Group key={s.id} justify="space-between" wrap="wrap">
                <Text size="sm">
                  <Text component="span" fw={600}>{s.adminEmail}</Text>
                  {' → '}
                  <Text component="span" fw={600}>{s.associationName}</Text>
                  {' · expires '}
                  {fmtDateTime(s.expiresAt)}
                </Text>
                <Button
                  variant="light"
                  color="red"
                  size="xs"
                  leftSection={<IconX size={12} />}
                  loading={revokeMut.isPending && revokeMut.variables === s.id}
                  onClick={() => revokeMut.mutate(s.id)}
                >
                  Revoke
                </Button>
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      <Group>
        <Button
          variant={activeOnly ? 'filled' : 'default'}
          size="sm"
          onClick={() => { setActiveOnly((v) => !v); setPage(1); }}
        >
          {activeOnly ? 'Active only' : 'All sessions'}
        </Button>
      </Group>

      {sessionsQ.isError ? (
        <ErrorState message={(sessionsQ.error as Error).message} onRetry={() => sessionsQ.refetch()} />
      ) : (
        <DataTable
          loading={sessionsQ.isLoading}
          rows={sessions}
          rowKey={(r) => r.id}
          emptyMessage="No impersonation sessions found"
          columns={[
            {
              key: 'admin',
              header: 'Admin',
              render: (r) => <Text size="sm">{r.adminEmail}</Text>,
            },
            {
              key: 'association',
              header: 'Association',
              render: (r) => (
                <Stack gap={0}>
                  <Text size="sm" fw={500}>{r.associationName}</Text>
                  <Text size="xs" c="dimmed">{r.subdomain}</Text>
                </Stack>
              ),
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (r) => <Text size="sm" lineClamp={2}>{r.reason}</Text>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => {
                if (r.revokedAt) return <Badge color="gray" size="sm" variant="light">Revoked</Badge>;
                if (isExpired(r.expiresAt)) return <Badge color="gray" size="sm" variant="light">Expired</Badge>;
                if (r.isActive) return <Badge color="orange" size="sm" variant="filled">Active</Badge>;
                return <Badge color="blue" size="sm" variant="light">Completed</Badge>;
              },
            },
            {
              key: 'expires',
              header: 'Expires / Expired',
              render: (r) => (
                <Text size="xs" c="dimmed">{fmtDateTime(r.expiresAt)}</Text>
              ),
            },
            {
              key: 'started',
              header: 'Started',
              render: (r) => (
                <Text size="xs" c="dimmed">{fmtDateTime(r.createdAt)}</Text>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                r.isActive && !isExpired(r.expiresAt) && !r.revokedAt ? (
                  <Button
                    variant="light"
                    color="red"
                    size="compact-xs"
                    leftSection={<IconX size={12} />}
                    loading={revokeMut.isPending && revokeMut.variables === r.id}
                    onClick={() => revokeMut.mutate(r.id)}
                  >
                    Revoke
                  </Button>
                ) : null,
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
