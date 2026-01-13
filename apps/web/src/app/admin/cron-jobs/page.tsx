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
  Anchor,
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
  FileText,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { cronApi, type CronJobStats } from '@/lib/api/cron';
import { API_ROUTES } from '@/utils/constants';

interface CronJob {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => Promise<any>;
}

export default function SuperAdminCronJobsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CronJobStats | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, any>>({});

  // Super Admin access control
  if (user?.platformRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Super admin access required for cron job management.</p>
        </div>
      </div>
    );
  }

  const cronJobs: CronJob[] = [
    {
      id: 'trial-expiry',
      name: 'Trial Expiry Check',
      description: 'Check for expiring and expired trial subscriptions',
      icon: <Calendar size={20} />,
      color: 'blue',
      action: cronApi.triggerTrialExpiry,
    },
    {
      id: 'renewal-reminders',
      name: 'Renewal Reminders',
      description: 'Send renewal reminders for expiring subscriptions',
      icon: <Bell size={20} />,
      color: 'orange',
      action: cronApi.triggerRenewalReminders,
    },
    {
      id: 'late-fees',
      name: 'Late Fees Processing',
      description: 'Process late fees for overdue payments',
      icon: <DollarSign size={20} />,
      color: 'red',
      action: cronApi.triggerLateFees,
    },
    {
      id: 'update-overdue',
      name: 'Update Overdue Status',
      description: 'Update overdue status for pending payments',
      icon: <Clock size={20} />,
      color: 'yellow',
      action: cronApi.triggerUpdateOverdue,
    },
  ];

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      console.log('[Cron] Attempting to load status from cron API');
      const res = await cronApi.getStatus();
      console.log('[Cron] Status response:', res);
      
      // Handle the response structure - the API returns CronJobStats directly
      setStatus(res);
    } catch (err: any) {
      console.error('Error loading cron status:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        response: err.response,
      });
      notifications.show({
        title: 'Error',
        message: `Failed to load cron job status: ${err.message}`,
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
      
      // Handle specific Super Admin context error
      if (err.response?.data?.message?.includes('Association not found')) {
        notifications.show({
          title: 'Backend Configuration Required',
          message: 'Cron API endpoints need to be updated to support Super Admin access.',
          color: 'orange',
          autoClose: false,
        });
      } else {
        notifications.show({
          title: 'Job Failed',
          message: err.message || `Failed to run ${job.name}`,
          color: 'red',
        });
      }
    } finally {
      setRunningJob(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Cron Jobs Management</Title>
          <Text size="sm" c="dimmed">
            Manage and manually trigger scheduled background jobs (Super Admin Only)
          </Text>
        </div>
        <Group>
          <Button
            component={Link}
            href="/admin/cron-jobs/logs"
            variant="light"
            leftSection={<FileText size={16} />}
          >
            View Logs
          </Button>
          <Button
            component={Link}
            href="/admin/cron-jobs/config"
            variant="light"
            leftSection={<Settings size={16} />}
          >
            Configure
          </Button>
          <Button
            variant="light"
            leftSection={<Activity size={16} />}
            onClick={loadStatus}
            loading={loading}
          >
            Refresh Status
          </Button>
        </Group>
      </Group>

      {/* Navigation Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="lg" component={Link} href="/admin/cron-jobs" style={{ textDecoration: 'none', backgroundColor: 'var(--mantine-color-blue-1)' }}>
          <Group>
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: 'var(--mantine-color-blue-6)',
                color: 'white',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <Text size="sm" fw={600} c="var(--mantine-color-blue-9)">
                Dashboard
              </Text>
              <Text size="xs" c="var(--mantine-color-blue-7)">
                Job status & manual triggers
              </Text>
            </div>
          </Group>
        </Card>

        <Card withBorder padding="lg" component={Link} href="/admin/cron-jobs/logs" style={{ textDecoration: 'none' }}>
          <Group>
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: 'var(--mantine-color-green-6)',
                color: 'white',
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <Text size="sm" fw={600}>
                Execution Logs
              </Text>
              <Text size="xs" c="dimmed">
                View detailed job logs
              </Text>
            </div>
          </Group>
        </Card>

        <Card withBorder padding="lg" component={Link} href="/admin/cron-jobs/config" style={{ textDecoration: 'none' }}>
          <Group>
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: 'var(--mantine-color-orange-6)',
                color: 'white',
              }}
            >
              <Settings size={20} />
            </div>
            <div>
              <Text size="sm" fw={600}>
                Configuration
              </Text>
              <Text size="xs" c="dimmed">
                Configure schedules & parameters
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* System Status */}
      <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
        <LoadingOverlay visible={loading} />

        <Group justify="space-between" mb="md">
          <Title order={4} c="var(--mantine-color-gray-1)">System Status</Title>
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

        {!loading && !status && (
          <Alert icon={<AlertCircle size={16} />} color="orange" variant="light">
            <Text size="sm" fw={500}>
              Backend Configuration Required
            </Text>
            <Text size="sm" mt={4}>
              The cron API endpoints need to be updated to support Super Admin access without association context. 
              Cron jobs are platform-wide operations that should not require tenant association.
            </Text>
          </Alert>
        )}

        {status && (
          <Stack gap="sm">
            <Group>
              <Text size="sm" c="var(--mantine-color-gray-4)">
                Last Checked:
              </Text>
              <Text size="sm" fw={500} c="var(--mantine-color-gray-2)">
                {formatDate(status.lastChecked)}
              </Text>
            </Group>

            <Divider color="var(--mantine-color-dark-4)" />

            <Title order={5} c="var(--mantine-color-gray-2)">Subscription Statistics</Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              {status.subscriptionStats && Object.entries(status.subscriptionStats).map(([statusKey, count]) => (
                <div key={statusKey}>
                  <Text size="xs" c="var(--mantine-color-gray-5)" tt="uppercase">
                    {statusKey}
                  </Text>
                  <Text size="lg" fw={700} c="var(--mantine-color-gray-1)">
                    {String(count)}
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
                  <Alert color="blue" icon={<CheckCircle size={16} />} variant="light">
                    <Text size="xs" fw={500}>
                      Last Run: {formatDate(result.timestamp)}
                    </Text>
                    {result.data && (
                      <Text size="xs" mt={4} style={{ fontFamily: 'monospace' }}>
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
      <Alert icon={<AlertCircle size={16} />} color="yellow" variant="light">
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
      <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
        <Title order={4} mb="md" c="var(--mantine-color-gray-1)">
          Automatic Schedule
        </Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ color: 'var(--mantine-color-gray-3)' }}>Job</Table.Th>
              <Table.Th style={{ color: 'var(--mantine-color-gray-3)' }}>Schedule</Table.Th>
              <Table.Th style={{ color: 'var(--mantine-color-gray-3)' }}>Description</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td style={{ color: 'var(--mantine-color-gray-2)' }}>Trial Expiry Check</Table.Td>
              <Table.Td>
                <Badge variant="light">Daily at 00:00</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="var(--mantine-color-gray-4)">Checks for trials expiring within 3 days</Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td style={{ color: 'var(--mantine-color-gray-2)' }}>Renewal Reminders</Table.Td>
              <Table.Td>
                <Badge variant="light">Daily at 09:00</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="var(--mantine-color-gray-4)">Sends reminders 7 days before renewal</Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td style={{ color: 'var(--mantine-color-gray-2)' }}>Late Fees Processing</Table.Td>
              <Table.Td>
                <Badge variant="light">Daily at 01:00</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="var(--mantine-color-gray-4)">Applies late fees to overdue payments</Text>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td style={{ color: 'var(--mantine-color-gray-2)' }}>Update Overdue Status</Table.Td>
              <Table.Td>
                <Badge variant="light">Every 6 hours</Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="var(--mantine-color-gray-4)">Updates overdue flags for payments</Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}