'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, SimpleGrid, Card, Group, Text, Button, Badge,
  Skeleton, Progress, Alert,
} from '@mantine/core';
import {
  IconRefresh, IconPlayerPlay, IconClock, IconCheck, IconX,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronJobStatus {
  jobsRunning: boolean;
  lastChecked: string;
  subscriptionStats: Record<string, number>;
}

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  status: 'active' | 'paused' | 'error';
  lastRunAt: string | null;
  nextRunAt: string | null;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

function fmtRelativeFuture(iso: string | null) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Overdue';
  if (diff < 60_000) return 'In less than a minute';
  if (diff < 3_600_000) return `In ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `In ${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString('en-GB');
}

const STATUS_COLOR = { active: 'green', paused: 'gray', error: 'red' } as const;

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, onTrigger, triggering }: {
  job: CronJob;
  onTrigger: (id: string) => void;
  triggering: boolean;
}) {
  const successRate = job.executionCount > 0
    ? (job.successCount / job.executionCount) * 100
    : 100;

  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="lg"
      radius="lg"
    >
      <Group justify="space-between" mb="sm" align="flex-start">
        <Stack gap={2} style={{ flex: 1 }}>
          <Text fw={700} size="sm">{job.name}</Text>
          <Text size="xs" c="dimmed">{job.description}</Text>
        </Stack>
        <Badge variant="light" size="sm" color={STATUS_COLOR[job.status]}>
          {job.status}
        </Badge>
      </Group>

      <Text size="xs" ff="monospace" c="dimmed" mb="md">{job.schedule}</Text>

      <Stack gap="xs" mb="md">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Success rate</Text>
          <Text size="xs" fw={600} c={successRate < 95 ? 'orange' : 'green'}>
            {successRate.toFixed(1)}%
          </Text>
        </Group>
        <Progress value={successRate} color={successRate < 95 ? 'orange' : 'green'} size="sm" radius="xl" />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            <Text component="span" c="green" fw={600}>{job.successCount}</Text> ok ·{' '}
            <Text component="span" c="red" fw={600}>{job.failureCount}</Text> failed
          </Text>
          <Text size="xs" c="dimmed">avg {job.averageDuration.toFixed(1)}s</Text>
        </Group>
      </Stack>

      <Group justify="space-between" mb="md">
        <Stack gap={0}>
          <Text size="xs" c="dimmed">Last run</Text>
          <Text size="xs">{fmtRelative(job.lastRunAt)}</Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="dimmed">Next run</Text>
          <Text size="xs">{fmtRelativeFuture(job.nextRunAt)}</Text>
        </Stack>
      </Group>

      <Button
        fullWidth
        variant="light"
        size="xs"
        leftSection={<IconPlayerPlay size={12} />}
        loading={triggering}
        onClick={() => onTrigger(job.id)}
      >
        Run now
      </Button>
    </Card>
  );
}

// ── Static job definitions (API returns status/counts, not structure) ──────────

const JOBS: CronJob[] = [
  {
    id: 'trial-expiry',
    name: 'Trial Expiry Check',
    description: 'Marks expired trials and notifies associations expiring within 3 days',
    schedule: '0 0 * * * (daily midnight)',
    status: 'active',
    lastRunAt: null,
    nextRunAt: null,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    averageDuration: 2.5,
  },
  {
    id: 'renewal-reminders',
    name: 'Renewal Reminders',
    description: 'Sends subscription renewal reminders for subscriptions expiring in 7 days',
    schedule: '0 9 * * * (daily 9 AM)',
    status: 'active',
    lastRunAt: null,
    nextRunAt: null,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    averageDuration: 3.2,
  },
  {
    id: 'late-fees',
    name: 'Late Fees Processing',
    description: 'Applies late fee penalties to overdue transactions based on penalty rules',
    schedule: '0 8 * * * (daily 8 AM)',
    status: 'active',
    lastRunAt: null,
    nextRunAt: null,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    averageDuration: 15.8,
  },
  {
    id: 'update-overdue',
    name: 'Overdue Status Update',
    description: 'Updates pending transactions to overdue status when past due date',
    schedule: '0 */6 * * * (every 6h)',
    status: 'active',
    lastRunAt: null,
    nextRunAt: null,
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    averageDuration: 1.2,
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const qc = useQueryClient();
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const statusQ = useQuery({
    queryKey: ['cron-status'],
    queryFn: () => bff<CronJobStatus>('admin/cron/status'),
    refetchInterval: 60_000,
  });

  const triggerMut = useMutation({
    mutationFn: (jobId: string) =>
      bff<{ message: string }>(`admin/cron/trigger/${jobId}`, { method: 'POST' }),
    onSuccess: (data, jobId) => {
      notifications.show({ message: data.message ?? 'Job triggered successfully', color: 'green' });
      qc.invalidateQueries({ queryKey: ['cron-status'] });
      setTriggeringJob(null);
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: 'red' });
      setTriggeringJob(null);
    },
  });

  function handleTrigger(jobId: string) {
    setTriggeringJob(jobId);
    triggerMut.mutate(jobId);
  }

  const status = statusQ.data;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Scheduled Jobs"
        description="Monitor and manually trigger background cron jobs"
        actions={
          <Button
            variant="default"
            size="sm"
            leftSection={<IconRefresh size={14} />}
            loading={statusQ.isFetching}
            onClick={() => statusQ.refetch()}
          >
            Refresh
          </Button>
        }
      />

      {status && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <StatCard
            label="Scheduler"
            value={status.jobsRunning ? 'Running' : 'Stopped'}
            icon={<IconClock size={16} />}
          />
          <StatCard label="Active subs" value={status.subscriptionStats['ACTIVE'] ?? 0} />
          <StatCard label="Trialing" value={status.subscriptionStats['TRIALING'] ?? 0} />
          <StatCard label="Scheduled jobs" value={JOBS.length} />
        </SimpleGrid>
      )}

      {statusQ.isError && (
        <ErrorState message="Failed to load scheduler status" onRetry={() => statusQ.refetch()} />
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {JOBS.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onTrigger={handleTrigger}
            triggering={triggeringJob === job.id}
          />
        ))}
      </SimpleGrid>

      <Alert icon={<IconAlertTriangle size={16} />} color="blue" variant="light">
        <Text size="sm">
          Jobs run automatically on their schedule. Use "Run now" for manual triggers or testing.
          Avoid triggering jobs like late-fees or trial-expiry outside normal windows.
        </Text>
      </Alert>
    </Stack>
  );
}

