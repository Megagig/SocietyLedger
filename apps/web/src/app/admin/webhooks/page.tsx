'use client';

import {
  Stack,
  Title,
  Text,
  Group,
  SimpleGrid,
  Card,
  Badge,
  Skeleton,
  Alert,
  Button
} from '@mantine/core';
import { 
  IconWebhook, 
  IconRefresh,
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { webhooksApi, WebhookStats } from '@/lib/api/webhooks';
import { WebhookStatsCard } from '@/components/webhooks/WebhookStatsCard';
import { WebhookQuickActions } from '@/components/webhooks/WebhookQuickActions';
import { notifications } from '@mantine/notifications';

export default function WebhooksDashboardPage() {
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await webhooksApi.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch webhook statistics');
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch webhook statistics',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRetryFailed = async () => {
    try {
      setIsRetrying(true);
      await webhooksApi.retryFailed();
      notifications.show({
        title: 'Success',
        message: 'Failed webhook events have been queued for retry',
        color: 'green'
      });
      await fetchStats();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to retry failed events',
        color: 'red'
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all webhook event logs? This action cannot be undone.')) {
      return;
    }
    try {
      setIsClearing(true);
      await webhooksApi.clearLogs();
      notifications.show({
        title: 'Success',
        message: 'Webhook event logs have been cleared',
        color: 'green'
      });
      await fetchStats();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to clear logs',
        color: 'red'
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportLogs = () => {
    notifications.show({
      title: 'Export Started',
      message: 'Webhook logs export will be available soon',
      color: 'blue'
    });
  };

  const handleConfigure = () => {
    notifications.show({
      title: 'Configuration',
      message: 'Webhook configuration will be available in a future update',
      color: 'blue'
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Webhooks Management</Title>
          <Text c="dimmed">Monitor and manage webhook events and configurations</Text>
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
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
          {[1, 2, 3].map((i) => (
            <Card key={i} withBorder p="lg">
              <Stack gap="md">
                <Skeleton height={40} width="60%" />
                <Skeleton height={100} />
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      ) : stats ? (
        <>
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }}>
            <WebhookStatsCard
              title="Paystack Webhooks"
              totalEvents={stats.paystack.totalEvents}
              successfulEvents={stats.paystack.successfulEvents}
              failedEvents={stats.paystack.failedEvents}
              successRate={stats.paystack.successRate}
              failureRate={stats.paystack.failureRate}
              lastEventTime={stats.paystack.lastEventTime}
              icon={<IconWebhook size={24} className="text-green-500" />}
              color="green"
            />
            <WebhookStatsCard
              title="Custom Webhooks"
              totalEvents={stats.custom.totalEvents}
              successfulEvents={stats.custom.successfulEvents}
              failedEvents={stats.custom.failedEvents}
              successRate={stats.custom.successRate}
              failureRate={stats.custom.failureRate}
              lastEventTime={stats.custom.lastEventTime}
              icon={<IconWebhook size={24} className="text-blue-500" />}
              color="blue"
            />
            <WebhookStatsCard
              title="All Webhooks"
              totalEvents={stats.overall.totalEvents}
              successfulEvents={stats.overall.successfulEvents}
              failedEvents={stats.overall.failedEvents}
              successRate={stats.overall.successRate}
              failureRate={stats.overall.failureRate}
              lastEventTime={stats.overall.lastEventTime}
              icon={<IconCheck size={24} className="text-purple-500" />}
              color="purple"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 3 }}>
            <Card withBorder p="lg">
              <WebhookQuickActions
                onRetryFailed={handleRetryFailed}
                onClearLogs={handleClearLogs}
                onExportLogs={handleExportLogs}
                onConfigure={handleConfigure}
                failedCount={stats.overall.failedEvents}
                isRetrying={isRetrying}
                isClearing={isClearing}
              />
            </Card>
          </SimpleGrid>

          <Card withBorder p="lg" mt="md">
            <Stack gap="md">
              <Text size="lg" fw={600}>
                Recent Activity
              </Text>
              {stats.recentEvents.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  No recent webhook events
                </Text>
              ) : (
                <Stack gap="xs">
                  {stats.recentEvents.map((event) => (
                    <Group key={event.id} justify="space-between" p="sm" className="bg-gray-50 dark:bg-gray-800 rounded">
                      <Group gap="xs">
                        <Badge variant="light" size="sm">
                          {event.eventType}
                        </Badge>
                        <Text size="sm">{event.source}</Text>
                      </Group>
                      <Group gap="xs">
                        <Badge
                          color={event.status === 'success' ? 'green' : event.status === 'failed' ? 'red' : 'blue'}
                          variant="light"
                          size="sm"
                        >
                          {event.status}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {new Date(event.timestamp).toLocaleString()}
                        </Text>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </>
      ) : (
        <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
          No webhook statistics available. Configure webhooks to start receiving events.
        </Alert>
      )}
    </Stack>
  );
}
