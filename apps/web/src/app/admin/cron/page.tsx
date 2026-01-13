'use client';

import {
  Stack,
  Title,
  Text,
  Group,
  SimpleGrid,
  Card,
  Skeleton,
  Alert,
  Button,
  Badge,
} from '@mantine/core';
import { 
  IconClock, 
  IconRefresh,
  IconAlertTriangle,
  IconSettings,
  IconFileText
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { cronApi, CronJobStats } from '@/lib/api/cron';
import { JobCard, JobCardSkeleton } from '@/components/cron/JobCard';
import { notifications } from '@mantine/notifications';

// Define cron jobs based on backend implementation
const CRON_JOBS = [
  {
    id: 'trial-expiry',
    name: 'Trial Expiry Check',
    description: 'Checks for trials expiring in the next 3 days and marks expired trials',
    schedule: '0 0 * * *', // Daily at midnight
    status: 'active' as const,
    lastRunAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    executionCount: 150,
    successCount: 148,
    failureCount: 2,
    averageDuration: 2.5,
  },
  {
    id: 'renewal-reminders',
    name: 'Subscription Renewal Reminders',
    description: 'Sends renewal reminders for subscriptions expiring in 7 days',
    schedule: '0 9 * * *', // Daily at 9 AM
    status: 'active' as const,
    lastRunAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    executionCount: 200,
    successCount: 198,
    failureCount: 2,
    averageDuration: 3.2,
  },
  {
    id: 'late-fees',
    name: 'Late Fees Processing',
    description: 'Applies late fee penalties to overdue transactions based on penalty rules',
    schedule: '0 8 * * *', // Daily at 8 AM
    status: 'active' as const,
    lastRunAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
    executionCount: 120,
    successCount: 115,
    failureCount: 5,
    averageDuration: 15.8,
  },
  {
    id: 'update-overdue',
    name: 'Overdue Status Update',
    description: 'Updates pending transactions to overdue status when past due date',
    schedule: '0 */6 * * *', // Every 6 hours
    status: 'active' as const,
    lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextRunAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    executionCount: 480,
    successCount: 480,
    failureCount: 0,
    averageDuration: 1.2,
  },
];

export default function CronJobsDashboardPage() {
  const [stats, setStats] = useState<CronJobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cronApi.getStatus();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cron job statistics');
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch cron job statistics',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTriggerJob = async (jobId: string) => {
    try {
      setTriggeringJob(jobId);
      
      let result;
      switch (jobId) {
        case 'trial-expiry':
          result = await cronApi.triggerTrialExpiry();
          break;
        case 'renewal-reminders':
          result = await cronApi.triggerRenewalReminders();
          break;
        case 'late-fees':
          result = await cronApi.triggerLateFees();
          break;
        case 'update-overdue':
          result = await cronApi.triggerUpdateOverdue();
          break;
        default:
          throw new Error('Unknown job type');
      }

      notifications.show({
        title: 'Success',
        message: result.message || 'Job triggered successfully',
        color: 'green'
      });
      
      await fetchStats();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to trigger job',
        color: 'red'
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    try {
      await cronApi.toggleJob(jobId, enabled);
      notifications.show({
        title: 'Success',
        message: `Job ${enabled ? 'enabled' : 'disabled'} successfully`,
        color: 'green'
      });
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to toggle job',
        color: 'red'
      });
    }
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Cron Jobs Management</Title>
          <Text c="dimmed">Monitor and manage scheduled background jobs</Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={20} />}
            onClick={fetchStats}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="light"
            leftSection={<IconSettings size={20} />}
            component="a"
            href="/admin/cron/config"
          >
            Configuration
          </Button>
          <Button
            variant="light"
            leftSection={<IconFileText size={20} />}
            component="a"
            href="/admin/cron/logs"
          >
            View Logs
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Stats Overview */}
      {stats && (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
          <Card withBorder p="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Jobs Running</Text>
              <Group gap="xs">
                <IconClock size={20} className="text-blue-500" />
                <Text size="xl" fw={600}>
                  {stats.jobsRunning ? 'Active' : 'Inactive'}
                </Text>
              </Group>
            </Stack>
          </Card>
          <Card withBorder p="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Active Subscriptions</Text>
              <Text size="xl" fw={600}>
                {stats.subscriptionStats.ACTIVE || 0}
              </Text>
            </Stack>
          </Card>
          <Card withBorder p="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Trialing</Text>
              <Text size="xl" fw={600}>
                {stats.subscriptionStats.TRIALING || 0}
              </Text>
            </Stack>
          </Card>
          <Card withBorder p="md">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">Last Checked</Text>
              <Text size="sm" fw={500}>
                {new Date(stats.lastChecked).toLocaleString()}
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      )}

      {/* Jobs List */}
      <div>
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600}>
            Scheduled Jobs
          </Text>
          <Badge variant="light" size="lg">
            {CRON_JOBS.length} Jobs
          </Badge>
        </Group>
        
        {loading ? (
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <JobCardSkeleton key={i} />
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            {CRON_JOBS.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onTrigger={handleTriggerJob}
                onToggle={handleToggleJob}
                loading={triggeringJob === job.id}
              />
            ))}
          </SimpleGrid>
        )}
      </div>

      {/* Info Alert */}
      <Alert icon={<IconAlertTriangle size={16} />} color="blue" variant="light">
        <Text size="sm">
          <strong>Note:</strong> Cron jobs run automatically based on their schedule. 
          Use the "Run Now" button to manually trigger a job for testing or immediate execution. 
          Job execution logs are available in the Logs section.
        </Text>
      </Alert>
    </Stack>
  );
}
