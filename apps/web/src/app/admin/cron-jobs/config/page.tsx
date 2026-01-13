'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Select,
  Switch,
  LoadingOverlay,
  Alert,
  JsonInput,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  TestTube,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cronApi, type CronJobConfig } from '@/lib/api/cron';
import { CronExpressionBuilder } from '@/components/cron/CronExpressionBuilder';

interface JobConfigForm {
  jobId: string;
  schedule: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

export default function CronJobConfigPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [config, setConfig] = useState<JobConfigForm>({
    jobId: '',
    schedule: '0 0 * * *',
    enabled: true,
    parameters: {},
  });

  // Super Admin access control
  if (user?.platformRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Super admin access required for cron job configuration.</p>
        </div>
      </div>
    );
  }

  const jobOptions = [
    { value: 'trial-expiry', label: 'Trial Expiry Check' },
    { value: 'renewal-reminders', label: 'Renewal Reminders' },
    { value: 'late-fees', label: 'Late Fees Processing' },
    { value: 'update-overdue', label: 'Update Overdue Status' },
  ];

  const defaultParameters = {
    'trial-expiry': {
      daysBeforeExpiry: 3,
      notifyUsers: true,
      batchSize: 100,
    },
    'renewal-reminders': {
      daysBeforeRenewal: 7,
      reminderCount: 3,
      batchSize: 50,
    },
    'late-fees': {
      gracePeriodDays: 5,
      feePercentage: 10,
      maxFeeAmount: 1000,
    },
    'update-overdue': {
      overdueDays: 30,
      batchSize: 200,
    },
  };

  useEffect(() => {
    if (selectedJobId) {
      loadJobConfig(selectedJobId);
    }
  }, [selectedJobId]);

  const loadJobConfig = async (jobId: string) => {
    try {
      setLoading(true);
      const jobConfig = await cronApi.getConfig(jobId);
      setConfig(jobConfig);
    } catch (err: any) {
      console.error('Error loading job config:', err);
      // Use defaults if API fails
      const defaultConfig = {
        jobId,
        schedule: getDefaultSchedule(jobId),
        enabled: true,
        parameters: defaultParameters[jobId as keyof typeof defaultParameters] || {},
      };
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultSchedule = (jobId: string): string => {
    switch (jobId) {
      case 'trial-expiry':
        return '0 0 * * *'; // Daily at midnight
      case 'renewal-reminders':
        return '0 9 * * *'; // Daily at 9 AM
      case 'late-fees':
        return '0 1 * * *'; // Daily at 1 AM
      case 'update-overdue':
        return '0 */6 * * *'; // Every 6 hours
      default:
        return '0 0 * * *';
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedJobId) {
      notifications.show({
        title: 'Error',
        message: 'Please select a job to configure',
        color: 'red',
      });
      return;
    }

    try {
      setSaving(true);
      await cronApi.updateConfig(selectedJobId, config);
      notifications.show({
        title: 'Success',
        message: 'Job configuration saved successfully',
        color: 'green',
      });
    } catch (err: any) {
      console.error('Error saving config:', err);
      notifications.show({
        title: 'Error',
        message: `Failed to save configuration: ${err.message}`,
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleJob = async (enabled: boolean) => {
    if (!selectedJobId) return;

    try {
      await cronApi.toggleJob(selectedJobId, enabled);
      setConfig(prev => ({ ...prev, enabled }));
      notifications.show({
        title: 'Success',
        message: `Job ${enabled ? 'enabled' : 'disabled'} successfully`,
        color: 'green',
      });
    } catch (err: any) {
      console.error('Error toggling job:', err);
      notifications.show({
        title: 'Error',
        message: `Failed to ${enabled ? 'enable' : 'disable'} job: ${err.message}`,
        color: 'red',
      });
    }
  };

  const handleTestSchedule = async () => {
    if (!selectedJobId) return;

    try {
      setTesting(true);
      // Trigger a test run of the job
      const jobActions = {
        'trial-expiry': cronApi.triggerTrialExpiry,
        'renewal-reminders': cronApi.triggerRenewalReminders,
        'late-fees': cronApi.triggerLateFees,
        'update-overdue': cronApi.triggerUpdateOverdue,
      };

      const action = jobActions[selectedJobId as keyof typeof jobActions];
      if (action) {
        await action();
        notifications.show({
          title: 'Test Completed',
          message: 'Job test run completed successfully',
          color: 'green',
        });
      }
    } catch (err: any) {
      console.error('Error testing job:', err);
      notifications.show({
        title: 'Test Failed',
        message: `Job test failed: ${err.message}`,
        color: 'red',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleScheduleChange = (schedule: string) => {
    setConfig(prev => ({ ...prev, schedule }));
  };

  const handleParametersChange = (parametersJson: string) => {
    try {
      const parameters = JSON.parse(parametersJson);
      setConfig(prev => ({ ...prev, parameters }));
    } catch (err) {
      // Invalid JSON, don't update
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Cron Job Configuration</Title>
          <Text size="sm" c="dimmed">
            Configure job schedules and parameters (Super Admin Only)
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<TestTube size={16} />}
            onClick={handleTestSchedule}
            loading={testing}
            disabled={!selectedJobId}
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-4)',
                color: 'var(--mantine-color-gray-1)',
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-dark-5)',
                },
              },
            }}
          >
            Test Run
          </Button>
          <Button
            leftSection={<Save size={16} />}
            onClick={handleSaveConfig}
            loading={saving}
            disabled={!selectedJobId}
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-blue-6)',
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-blue-7)',
                },
              },
            }}
          >
            Save Config
          </Button>
        </Group>
      </Group>

      {/* Job Selection */}
      <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={4} c="var(--mantine-color-gray-1)">Select Job</Title>
          </Group>

          <Select
            label="Cron Job"
            placeholder="Select a job to configure"
            data={jobOptions}
            value={selectedJobId}
            onChange={(value) => setSelectedJobId(value || '')}
            leftSection={<Settings size={16} />}
            size="md"
            styles={{
              input: {
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderColor: 'var(--mantine-color-dark-4)',
                color: 'var(--mantine-color-gray-1)',
                '&::placeholder': {
                  color: 'var(--mantine-color-gray-5)',
                },
              },
              label: {
                color: 'var(--mantine-color-gray-3)',
              },
            }}
          />

          {selectedJobId && (
            <Alert icon={<AlertCircle size={16} />} color="blue" variant="light">
              <Text size="sm">
                Configuring: <strong>{jobOptions.find(j => j.value === selectedJobId)?.label}</strong>
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>

      {selectedJobId && (
        <>
          {/* Job Status */}
          <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
            <LoadingOverlay visible={loading} />
            
            <Stack gap="md">
              <Title order={4} c="var(--mantine-color-gray-1)">Job Status</Title>
              
              <Group>
                <Switch
                  label={config.enabled ? 'Job Enabled' : 'Job Disabled'}
                  description={config.enabled ? 'Job will run on schedule' : 'Job is paused'}
                  checked={config.enabled}
                  onChange={(e) => handleToggleJob(e.currentTarget.checked)}
                  size="md"
                />
              </Group>
            </Stack>
          </Card>

          {/* Schedule Configuration */}
          <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Title order={4} c="var(--mantine-color-gray-1)">
                  <Group gap="xs">
                    <Clock size={20} />
                    Schedule Configuration
                  </Group>
                </Title>
              </Group>

              <CronExpressionBuilder
                value={config.schedule}
                onChange={handleScheduleChange}
                onTest={handleTestSchedule}
              />
            </Stack>
          </Card>

          {/* Job Parameters */}
          <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
            <Stack gap="md">
              <Title order={4} c="var(--mantine-color-gray-1)">Job Parameters</Title>
              
              <Text size="sm" c="var(--mantine-color-gray-4)">
                Configure job-specific parameters in JSON format
              </Text>

              <JsonInput
                label="Parameters"
                placeholder="Enter job parameters as JSON"
                value={JSON.stringify(config.parameters, null, 2)}
                onChange={handleParametersChange}
                minRows={8}
                maxRows={15}
                autosize
                styles={{
                  input: {
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderColor: 'var(--mantine-color-dark-4)',
                    color: 'var(--mantine-color-gray-1)',
                    fontFamily: 'monospace',
                  },
                  label: {
                    color: 'var(--mantine-color-gray-3)',
                  },
                }}
              />

              <Alert icon={<AlertCircle size={16} />} color="yellow" variant="light">
                <Text size="sm">
                  <strong>Warning:</strong> Changing parameters may affect job behavior. 
                  Test thoroughly before applying to production.
                </Text>
              </Alert>
            </Stack>
          </Card>

          {/* Current Schedule Info */}
          <Card withBorder padding="lg" bg="var(--mantine-color-dark-7)">
            <Stack gap="md">
              <Title order={4} c="var(--mantine-color-gray-1)">Current Schedule</Title>
              
              <Group gap="xl">
                <Stack gap={4}>
                  <Text size="xs" c="var(--mantine-color-gray-5)">Cron Expression</Text>
                  <Text size="sm" fw={500} c="var(--mantine-color-gray-2)" style={{ fontFamily: 'monospace' }}>
                    {config.schedule}
                  </Text>
                </Stack>
                <Stack gap={4}>
                  <Text size="xs" c="var(--mantine-color-gray-5)">Status</Text>
                  <Text size="sm" fw={500} c={config.enabled ? 'var(--mantine-color-green-4)' : 'var(--mantine-color-red-4)'}>
                    {config.enabled ? 'Active' : 'Disabled'}
                  </Text>
                </Stack>
              </Group>
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}