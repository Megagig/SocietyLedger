'use client';

import { Card, Group, Text, Stack, Badge, Progress } from '@mantine/core';
import { 
  IconCheck, 
  IconX, 
  IconClock, 
  IconRefresh,
  IconTrash
} from '@tabler/icons-react';

interface WebhookStatsCardProps {
  title: string;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  successRate: number;
  failureRate: number;
  lastEventTime: string | null;
  icon: React.ReactNode;
  color: string;
}

export function WebhookStatsCard({ 
  title,
  totalEvents,
  successfulEvents,
  failedEvents,
  successRate,
  failureRate,
  lastEventTime,
  icon,
  color
}: WebhookStatsCardProps) {
  return (
    <Card withBorder shadow="sm" p="lg">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <div className={`p-3 rounded-lg bg-${color}-50 dark:bg-${color}-900/20`}>
            {icon}
          </div>
          <div>
            <Text size="lg" fw={600}>
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              Last {lastEventTime ? new Date(lastEventTime).toLocaleString() : 'No events yet'}
            </Text>
          </div>
        </Group>
        <Badge color={color} variant="light" size="lg">
          {totalEvents.toLocaleString()}
        </Badge>
      </Group>

      <Stack gap="md">
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Success Rate</Text>
            <Text size="sm" fw={500} c="green">
              {successRate.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={successRate}
            size="sm"
            color="green"
          />
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Failure Rate</Text>
            <Text size="sm" fw={500} c="red">
              {failureRate.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={failureRate}
            size="sm"
            color="red"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Group gap="xs" mb="xs">
              <IconCheck size={20} className="text-green-500" />
              <div>
                <Text size="xs" c="dimmed">Successful</Text>
                <Text size="lg" fw={600} c="green">
                  {successfulEvents.toLocaleString()}
                </Text>
              </div>
            </Group>
          </div>

          <div>
            <Group gap="xs" mb="xs">
              <IconX size={20} className="text-red-500" />
              <div>
                <Text size="xs" c="dimmed">Failed</Text>
                <Text size="lg" fw={600} c="red">
                  {failedEvents.toLocaleString()}
                </Text>
              </div>
            </Group>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Group gap="xs" mb="xs">
              <IconClock size={20} className="text-blue-500" />
              <div>
                <Text size="xs" c="dimmed">Pending</Text>
                <Text size="lg" fw={600} c="blue">
                  {totalEvents - successfulEvents - failedEvents}
                </Text>
              </div>
            </Group>
          </div>

          <div>
            <Group gap="xs" mb="xs">
              <IconRefresh size={20} className="text-yellow-500" />
              <div>
                <Text size="xs" c="dimmed">Avg Duration</Text>
                <Text size="lg" fw={600} c="yellow">
                  -- ms
                </Text>
              </div>
            </Group>
          </div>
        </div>
      </Stack>
    </Card>
  );
}
