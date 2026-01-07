'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Badge,
  LoadingOverlay,
  Alert,
  SimpleGrid,
  Table,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Clock,
  Play,
  AlertCircle,
  CheckCircle,
  Activity,
  DollarSign,
  Bell,
  Calendar,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cronApi, type CronJobStatus } from '@/lib/api/cron';

interface CronJob {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => Promise<any>;
}

export default function CronJobsPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CronJobStatus | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, any>>({});

  const cronJobs: CronJob[] = [
    {
      id: 'trial-expiry',
      name: 'Trial Expiry Check',
      description: 'Check for expiring and expired trial subscriptions',
      icon: <Calendar size={20} />,
      color: 'blue',
      action: cronApi.runTrialExpiry,
    },
    {
      id: 'renewal-reminders',
      name: 'Renewal Reminders',
      description: 'Send renewal reminders for expiring subscriptions',
      icon: <Bell size={20} />,
      color: 'orange',
      action: cronApi.runRenewalReminders,
    },
    {
      id: 'late-fees',
      name: 'Late Fees Processing',
      description: 'Process late fees for overdue payments',
      icon: <DollarSign size={20} />,
      color: 'red',
      action: cronApi.runLateFees,
    },
    {
      id: 'update-overdue',
      name: 'Update Overdue Status',
      description: 'Update overdue status for pending payments',
      icon: <Clock size={20} />,
      color: 'yellow',
      action: cronApi.runUpdateOverdue,
    },
  ];

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await cronApi.getStatus();
      setStatus(res.data);
    } catch (err: any) {
      console.error('Error loading cron status:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load cron job status',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const runJob = async (job: CronJob) => {
    try {
      setRunningJob(job.id);
      const result = await job.action();

      setLastResults((prev) => ({
        ...prev,
        [job.id]: {
          ...result,
          timestamp: new Date().toISOString(),
        },
      }));

      notifications.show({
        title: 'Job Completed',
        message: `${job.name} completed successfully`,
        color: 'green',
      });

      loadStatus();
    } catch (err: any) {
      console.error(`Error running job ${job.id}:`, err);
      notifications.show({
        title: 'Job Failed',
        message: err.message || `Failed to run ${job.name}`,
        color: 'red',
      });
    } finally {
      setRunningJob(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <Can
      permission={PERMISSIONS.CRON_VIEW}
      fallback={
        <Alert color="red">You don't have permission to manage cron jobs</Alert>
      }
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Cron Jobs Management</Title>
            <Text size="sm" c="dimmed">
              Manage and manually trigger scheduled background jobs
            </Text>
          </div>
          <Button
            variant="light"
            leftSection={<Activity size={16} />}
            onClick={loadStatus}
            loading={loading}
          >
            Refresh Status
          </Button>
        </Group>

        {/* System Status */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          <Group justify="space-between" mb="md">
            <Title order={4}>System Status</Title>
            {status && (
              <Badge
                color={status.jobsRunning ? 'green' : 'red'}
                size="lg"
                leftSection={
                  status.jobsRunning ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )
                }
              >
                {status.jobsRunning ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </Group>

          {status && (
            <Stack gap="sm">
              <Group>
                <Text size="sm" c="dimmed">
                  Last Checked:
                </Text>
                <Text size="sm" fw={500}>
                  {formatDate(status.lastChecked)}
                </Text>
              </Group>

              <Divider />

              <Title order={5}>Subscription Statistics</Title>
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                {Object.entries(status.subscriptionStats).map(([status, count]) => (
                  <div key={status}>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      {status}
                    </Text>
                    <Text size="lg" fw={700}>
                      {count}
                    </Text>
                  </div>
                ))}
              </SimpleGrid>
            </Stack>
          )}
        </Card>

        {/* Cron Jobs */}
        <Title order={4}>Available Cron Jobs</Title>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {cronJobs.map((job) => {
            const result = lastResults[job.id];

            return (
              <Card key={job.id} withBorder padding="lg">
                <Stack gap="md">
                  <Group>
                    <div
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: `var(--mantine-color-${job.color}-1)`,
                        color: `var(--mantine-color-${job.color}-6)`,
                      }}
                    >
                      {job.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>
                        {job.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {job.description}
                      </Text>
                    </div>
                  </Group>

                  {result && (
                    <Alert color="blue" icon={<CheckCircle size={16} />}>
                      <Text size="xs" fw={500}>
                        Last Run: {formatDate(result.timestamp)}
                      </Text>
                      {result.data && (
                        <Text size="xs" mt={4}>
                          {JSON.stringify(result.data, null, 2)}
                        </Text>
                      )}
                    </Alert>
                  )}

                  <Button
                    fullWidth
                    variant="light"
                    color={job.color}
                    leftSection={<Play size={16} />}
                    onClick={() => runJob(job)}
                    loading={runningJob === job.id}
                    disabled={runningJob !== null && runningJob !== job.id}
                  >
                    Run Now
                  </Button>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>

        {/* Important Notice */}
        <Alert icon={<AlertCircle size={16} />} color="yellow">
          <Text size="sm" fw={500}>
            Important Notice
          </Text>
          <Text size="sm" mt={4}>
            These jobs run automatically on a schedule in production. Manual triggers are for
            testing and emergency situations only. Running jobs manually may cause duplicate
            processing.
          </Text>
        </Alert>

        {/* Scheduled Jobs Info */}
        <Card withBorder padding="lg">
          <Title order={4} mb="md">
            Automatic Schedule
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Job</Table.Th>
                <Table.Th>Schedule</Table.Th>
                <Table.Th>Description</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Trial Expiry Check</Table.Td>
                <Table.Td>
                  <Badge>Daily at 00:00</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">Checks for trials expiring within 3 days</Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Renewal Reminders</Table.Td>
                <Table.Td>
                  <Badge>Daily at 09:00</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">Sends reminders 7 days before renewal</Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Late Fees Processing</Table.Td>
                <Table.Td>
                  <Badge>Daily at 01:00</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">Applies late fees to overdue payments</Text>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Update Overdue Status</Table.Td>
                <Table.Td>
                  <Badge>Every 6 hours</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">Updates overdue flags for payments</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>
      </Stack>
    </Can>
  );
}
