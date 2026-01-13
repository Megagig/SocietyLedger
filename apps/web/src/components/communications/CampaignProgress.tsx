'use client';

import { Progress, Stack, Group, Text, Badge, Box } from '@mantine/core';
import { IconSend, IconCheck, IconX } from '@tabler/icons-react';

interface CampaignProgressProps {
  sent: number;
  delivered: number;
  failed: number;
  total: number;
  showLabels?: boolean;
}

export function CampaignProgress({
  sent,
  delivered,
  failed,
  total,
  showLabels = true,
}: CampaignProgressProps) {
  const sentPercentage = total > 0 ? (sent / total) * 100 : 0;
  const deliveredPercentage = sent > 0 ? (delivered / sent) * 100 : 0;
  const failedPercentage = sent > 0 ? (failed / sent) * 100 : 0;

  return (
    <Stack gap="md">
      {/* Overall Progress */}
      <Box>
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={500}>Overall Progress</Text>
          <Text size="sm" c="dimmed">
            {sent} / {total}
          </Text>
        </Group>
        <Progress
          value={sentPercentage}
          size="lg"
          color="blue"
          animated
        />
      </Box>

      {/* Delivery Breakdown */}
      {showLabels && (
        <Stack gap="sm">
          {/* Sent */}
          <Group justify="space-between">
            <Group gap="xs">
              <IconSend size={16} color="blue" />
              <Text size="sm">Sent</Text>
            </Group>
            <Badge variant="light" color="blue">
              {sent.toLocaleString()}
            </Badge>
          </Group>

          {/* Delivered */}
          <Group justify="space-between">
            <Group gap="xs">
              <IconCheck size={16} color="green" />
              <Text size="sm">Delivered</Text>
            </Group>
            <Group gap="xs">
              <Badge variant="light" color="green">
                {delivered.toLocaleString()}
              </Badge>
              <Text size="xs" c="dimmed">
                ({deliveredPercentage.toFixed(1)}%)
              </Text>
            </Group>
          </Group>

          {/* Failed */}
          <Group justify="space-between">
            <Group gap="xs">
              <IconX size={16} color="red" />
              <Text size="sm">Failed</Text>
            </Group>
            <Group gap="xs">
              <Badge variant="light" color="red">
                {failed.toLocaleString()}
              </Badge>
              <Text size="xs" c="dimmed">
                ({failedPercentage.toFixed(1)}%)
              </Text>
            </Group>
          </Group>
        </Stack>
      )}

      {/* Mini Progress Bars */}
      <Stack gap="xs">
        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">Delivery Rate</Text>
            <Text size="xs" fw={500}>
              {deliveredPercentage.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={deliveredPercentage}
            size="sm"
            color="green"
          />
        </Box>

        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">Failure Rate</Text>
            <Text size="xs" fw={500}>
              {failedPercentage.toFixed(1)}%
            </Text>
          </Group>
          <Progress
            value={failedPercentage}
            size="sm"
            color="red"
          />
        </Box>
      </Stack>
    </Stack>
  );
}
