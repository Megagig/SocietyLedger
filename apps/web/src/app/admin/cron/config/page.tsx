'use client';

import {
  Stack,
  Title,
  Text,
  Group,
  Card,
  Select,
  Switch,
  Button,
  Alert,
  TextInput,
  NumberInput,
  SimpleGrid,
} from '@mantine/core';
import {
  IconSettings,
  IconRefresh,
  IconArrowBack,
  IconCheck,
  IconAlertTriangle,
  IconClock,
  IconDeviceFloppy
} from '@tabler/icons-react';
import { useState } from 'react';
import { CronExpressionBuilder } from '@/components/cron/CronExpressionBuilder';
import { notifications } from '@mantine/notifications';

const JOBS = [
  { value: 'trial-expiry', label: 'Trial Expiry Check', description: 'Checks for trials expiring in the next 3 days' },
  { value: 'renewal-reminders', label: 'Subscription Renewal Reminders', description: 'Sends renewal reminders for subscriptions expiring in 7 days' },
  { value: 'late-fees', label: 'Late Fees Processing', description: 'Applies late fee penalties to overdue transactions' },
  { value: 'update-overdue', label: 'Overdue Status Update', description: 'Updates pending transactions to overdue status' },
];

export default function JobConfigurationPage() {
  const [selectedJob, setSelectedJob] = useState('');
  const [schedule, setSchedule] = useState('0 0 * * *');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedJobData = JOBS.find(job => job.value === selectedJob);

  const handleSave = async () => {
    if (!selectedJob) {
      notifications.show({
        title: 'Error',
        message: 'Please select a job to configure',
        color: 'red'
      });
      return;
    }

    try {
      setSaving(true);
      // In a real implementation, this would call the API
      // await cronApi.updateConfig(selectedJob, { schedule, enabled });
      
      notifications.show({
        title: 'Success',
        message: `Job configuration saved successfully`,
        color: 'green'
      });
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save job configuration',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSchedule = () => {
    notifications.show({
      title: 'Test Schedule',
      message: `Next runs for "${schedule}" would be calculated here`,
      color: 'blue'
    });
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Group gap="sm">
            <Button
              variant="subtle"
              size="sm"
              leftSection={<IconArrowBack size={16} />}
              component="a"
              href="/admin/cron"
            >
              Back to Dashboard
            </Button>
            <div>
              <Title order={2}>Job Configuration</Title>
              <Text c="dimmed">Configure schedule and settings for cron jobs</Text>
            </div>
          </Group>
        </div>
        <Button
          variant="light"
          leftSection={<IconRefresh size={20} />}
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 500);
          }}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {/* Job Selection */}
      <Card withBorder p="md">
        <Stack gap="md">
          <Group gap="sm">
            <IconSettings size={20} className="text-blue-500" />
            <Text size="sm" fw={600}>
              Select Job to Configure
            </Text>
          </Group>
          <Select
            placeholder="Choose a cron job"
            data={JOBS}
            value={selectedJob}
            onChange={(value) => {
              setSelectedJob(value || '');
              // Reset form when job changes
              setSchedule('0 0 * * *');
              setEnabled(true);
            }}
            searchable
            clearable
          />
          {selectedJobData && (
            <Alert icon={<IconCheck size={16} />} color="blue" variant="light">
              <Text size="sm">
                <strong>{selectedJobData.label}</strong>: {selectedJobData.description}
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {/* Configuration Form */}
      {selectedJob && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          {/* Schedule Builder */}
          <Card withBorder p="md">
            <Stack gap="md">
              <Group gap="sm">
                <IconClock size={20} className="text-green-500" />
                <Text size="sm" fw={600}>
                  Schedule Configuration
                </Text>
              </Group>
              
              <CronExpressionBuilder
                value={schedule}
                onChange={setSchedule}
                onTest={handleTestSchedule}
              />
            </Stack>
          </Card>

          {/* Job Settings */}
          <Card withBorder p="md">
            <Stack gap="md">
              <Group gap="sm">
                <IconSettings size={20} className="text-purple-500" />
                <Text size="sm" fw={600}>
                  Job Settings
                </Text>
              </Group>

              {/* Enable/Disable */}
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Job Status</Text>
                  <Switch
                    checked={enabled}
                    onChange={(event) => setEnabled(event.currentTarget.checked)}
                    label={enabled ? 'Enabled' : 'Disabled'}
                    size="md"
                  />
                </Group>
                <Text size="xs" c="dimmed">
                  {enabled 
                    ? 'This job will run according to its schedule'
                    : 'This job will not run automatically'
                  }
                </Text>
              </Stack>

              {/* Additional Settings (placeholder for future) */}
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Timeout (seconds)
                </Text>
                <NumberInput
                  placeholder="300"
                  min={1}
                  max={3600}
                  description="Maximum execution time before job is terminated"
                />
              </Stack>

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Retry Attempts
                </Text>
                <NumberInput
                  placeholder="3"
                  min={0}
                  max={10}
                  description="Number of retry attempts on failure"
                />
              </Stack>

              {/* Save Button */}
              <Group justify="flex-end">
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!selectedJob}
                >
                  Save Configuration
                </Button>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>
      )}

      {/* Info Alert */}
      <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
        <Stack gap="xs">
          <Text size="sm">
            <strong>Important:</strong> Changes to job schedules will take effect on the next scheduled run.
          </Text>
          <Text size="sm">
            <strong>Note:</strong> Some jobs may have dependencies on other jobs or system resources. 
            Test schedule changes carefully before applying to production.
          </Text>
        </Stack>
      </Alert>

      {/* Help Section */}
      <Card withBorder p="md" bg="gray-0 dark:bg-gray-9">
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            Quick Reference
          </Text>
          <Stack gap="xs">
            <Text size="xs">
              <strong>Trial Expiry Check:</strong> Runs daily to check for trials expiring in 3 days
            </Text>
            <Text size="xs">
              <strong>Renewal Reminders:</strong> Runs daily at 9 AM to send renewal reminders
            </Text>
            <Text size="xs">
              <strong>Late Fees:</strong> Runs daily at 8 AM to apply late fees
            </Text>
            <Text size="xs">
              <strong>Overdue Update:</strong> Runs every 6 hours to update transaction status
            </Text>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
