import {
  Card,
  Stack,
  Text,
  Group,
  Button,
  Switch,
  Badge,
  Skeleton,
} from '@mantine/core';
import { 
  IconClock, 
  IconRefresh, 
  IconCheck,
  IconAlertCircle,
  IconPlayerPlay,
  IconPlayerStop
} from '@tabler/icons-react';
import { JobStatusIndicator } from './JobStatusIndicator';
import { CronJob } from '@/lib/api/cron';

interface JobCardProps {
  job: CronJob;
  onTrigger?: (jobId: string) => void;
  onToggle?: (jobId: string, enabled: boolean) => void;
  loading?: boolean;
}

export function JobCard({ job, onTrigger, onToggle, loading }: JobCardProps) {
  const successRate = job.executionCount > 0
    ? Math.round((job.successCount / job.executionCount) * 100)
    : 100;

  return (
    <Card withBorder p="lg" shadow="sm">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="sm">
            <Text size="lg" fw={600}>
              {job.name}
            </Text>
            <JobStatusIndicator status={job.status} size="sm" />
          </Group>
          {onToggle && (
            <Switch
              checked={job.status !== 'disabled'}
              onChange={(e) => onToggle(job.id, e.currentTarget.checked)}
              label={job.status !== 'disabled' ? 'Enabled' : 'Disabled'}
              size="sm"
              disabled={loading}
            />
          )}
        </Group>

        {/* Description */}
        {job.description && (
          <Text size="sm" c="dimmed">
            {job.description}
          </Text>
        )}

        {/* Stats */}
        <Group gap="xl">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Schedule</Text>
            <Text size="sm" fw={500}>
              {job.schedule}
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Last Run</Text>
            {job.lastRunAt ? (
              <Text size="sm" fw={500}>
                {new Date(job.lastRunAt).toLocaleString()}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">Never</Text>
            )}
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Next Run</Text>
            {job.nextRunAt ? (
              <Text size="sm" fw={500}>
                {new Date(job.nextRunAt).toLocaleString()}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">Not scheduled</Text>
            )}
          </Stack>
        </Group>

        {/* Execution Stats */}
        <Group gap="xl">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Total Runs</Text>
            <Text size="sm" fw={500}>
              {job.executionCount}
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Success Rate</Text>
            <Badge
              color={successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red'}
              variant="light"
            >
              {successRate}%
            </Badge>
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Avg Duration</Text>
            <Text size="sm" fw={500}>
              {job.averageDuration > 0 ? `${job.averageDuration.toFixed(2)}s` : 'N/A'}
            </Text>
          </Stack>
        </Group>

        {/* Actions */}
        {onTrigger && (
          <Group justify="flex-end">
            <Button
              variant="light"
              size="sm"
              leftSection={<IconRefresh size={16} />}
              onClick={() => onTrigger(job.id)}
              loading={loading}
            >
              Run Now
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

export function JobCardSkeleton() {
  return (
    <Card withBorder p="lg" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Skeleton height={24} width={150} />
            <Skeleton height={20} width={80} />
          </Group>
          <Skeleton height={20} width={100} />
        </Group>
        <Skeleton height={16} width="100%" />
        <Group gap="xl">
          <Stack gap={4}>
            <Skeleton height={12} width={60} />
            <Skeleton height={16} width={100} />
          </Stack>
          <Stack gap={4}>
            <Skeleton height={12} width={60} />
            <Skeleton height={16} width={120} />
          </Stack>
          <Stack gap={4}>
            <Skeleton height={12} width={60} />
            <Skeleton height={16} width={120} />
          </Stack>
        </Group>
        <Group gap="xl">
          <Stack gap={4}>
            <Skeleton height={12} width={60} />
            <Skeleton height={16} width={50} />
          </Stack>
          <Stack gap={4}>
            <Skeleton height={12} width={70} />
            <Skeleton height={20} width={50} />
          </Stack>
          <Stack gap={4}>
            <Skeleton height={12} width={80} />
            <Skeleton height={16} width={50} />
          </Stack>
        </Group>
        <Group justify="flex-end">
          <Skeleton height={32} width={100} />
        </Group>
      </Stack>
    </Card>
  );
}
