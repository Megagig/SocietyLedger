import {
  Modal,
  Stack,
  Title,
  Text,
  Group,
  Badge,
  Code,
  ScrollArea,
  Alert,
  Button,
} from '@mantine/core';
import { 
  IconCheck, 
  IconX, 
  IconClock,
  IconCopy,
  IconX as IconClose
} from '@tabler/icons-react';
import { JobExecutionLog } from '@/lib/api/cron';

interface LogDetailModalProps {
  opened: boolean;
  onClose: () => void;
  log: JobExecutionLog | null;
}

export function LogDetailModal({ opened, onClose, log }: LogDetailModalProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!log) return null;

  const getStatusBadge = () => {
    switch (log.status) {
      case 'success':
        return <Badge color="green" variant="light" leftSection={<IconCheck size={14} />}>Success</Badge>;
      case 'failed':
        return <Badge color="red" variant="light" leftSection={<IconX size={14} />}>Failed</Badge>;
      case 'running':
        return <Badge color="blue" variant="light" leftSection={<IconClock size={14} className="animate-spin" />}>Running</Badge>;
      default:
        return <Badge color="gray" variant="light">{log.status}</Badge>;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={3}>Job Execution Log</Title>}
      size="lg"
    >
      <Stack gap="lg">
        {/* Basic Info */}
        <Group gap="xl">
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Job Name</Text>
            <Text size="sm" fw={600}>
              {log.jobName}
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Status</Text>
            {getStatusBadge()}
          </Stack>
          <Stack gap={4}>
            <Text size="xs" c="dimmed">Duration</Text>
            <Text size="sm" fw={500}>
              {log.duration > 0 ? `${log.duration.toFixed(2)} seconds` : 'N/A'}
            </Text>
          </Stack>
        </Group>

        {/* Timestamp */}
        <Stack gap={4}>
          <Text size="xs" c="dimmed">Execution Time</Text>
          <Text size="sm">
            {new Date(log.timestamp).toLocaleString()}
          </Text>
        </Stack>

        {/* Error Message */}
        {log.errorMessage && (
          <Alert icon={<IconX size={16} />} color="red" variant="light" title="Error">
            <Text size="sm">
              {log.errorMessage}
            </Text>
          </Alert>
        )}

        {/* Output */}
        {log.output && (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600}>
                Output
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconCopy size={14} />}
                onClick={() => copyToClipboard(log.output || '')}
              >
                Copy
              </Button>
            </Group>
            <ScrollArea.Autosize mah={300}>
              <Code block p="md">
                {log.output}
              </Code>
            </ScrollArea.Autosize>
          </Stack>
        )}

        {/* Actions */}
        <Group justify="flex-end">
          <Button onClick={onClose} leftSection={<IconClose size={16} />}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
