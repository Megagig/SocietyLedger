'use client';

import { 
  Button, 
  Group, 
  Stack, 
  Text, 
  Badge,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { 
  IconRefresh, 
  IconTrash, 
  IconDownload, 
  IconSettings,
  IconClock,
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';

interface WebhookQuickActionsProps {
  onRetryFailed?: () => void;
  onClearLogs?: () => void;
  onExportLogs?: () => void;
  onConfigure?: () => void;
  failedCount?: number;
  isRetrying?: boolean;
  isClearing?: boolean;
}

export function WebhookQuickActions({
  onRetryFailed,
  onClearLogs,
  onExportLogs,
  onConfigure,
  failedCount = 0,
  isRetrying = false,
  isClearing = false
}: WebhookQuickActionsProps) {
  return (
    <Stack gap="md">
      <Text size="sm" fw={500} c="dimmed">
        Quick Actions
      </Text>

      <Stack gap="sm">
        <Button
          variant="light"
          color="orange"
          leftSection={<IconRefresh size={20} />}
          onClick={onRetryFailed}
          disabled={failedCount === 0 || isRetrying}
          loading={isRetrying}
          fullWidth
        >
          Retry Failed Events
          {failedCount > 0 && (
            <Badge size="xs" ml="xs" color="orange" variant="filled">
              {failedCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="light"
          color="red"
          leftSection={<IconTrash size={20} />}
          onClick={onClearLogs}
          disabled={isClearing}
          loading={isClearing}
          fullWidth
        >
          Clear Event Logs
        </Button>

        <Button
          variant="light"
          color="blue"
          leftSection={<IconDownload size={20} />}
          onClick={onExportLogs}
          fullWidth
        >
          Export Logs
        </Button>

        <Button
          variant="light"
          color="gray"
          leftSection={<IconSettings size={20} />}
          onClick={onConfigure}
          fullWidth
        >
          Configure Webhooks
        </Button>
      </Stack>

      <Stack gap="xs" mt="md">
        <Text size="xs" fw={500} c="dimmed">
          Status Indicators
        </Text>
        <Group gap="xs">
          <Tooltip label="Webhook service is healthy">
            <ActionIcon variant="light" color="green" size="lg">
              <IconCheck size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Pending events">
            <ActionIcon variant="light" color="blue" size="lg">
              <IconClock size={20} />
            </ActionIcon>
          </Tooltip>
          {failedCount > 0 && (
            <Tooltip label={`${failedCount} failed events`}>
              <ActionIcon variant="light" color="red" size="lg">
                <IconAlertTriangle size={20} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Stack>
    </Stack>
  );
}
