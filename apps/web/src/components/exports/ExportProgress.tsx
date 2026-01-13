import { Progress, Stack, Text, Button, Group } from '@mantine/core';
import { IconX, IconCheck } from '@tabler/icons-react';

interface ExportProgressProps {
  progress: number;
  status: 'processing' | 'completed' | 'failed';
  message?: string;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function ExportProgress({ progress, status, message, onCancel, onRetry }: ExportProgressProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'blue';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <IconCheck size={16} />;
      case 'failed':
        return <IconX size={16} />;
      default:
        return null;
    }
  };

  return (
    <Stack gap="md" p="md" style={{ border: '1px solid #e9ecef', borderRadius: '8px' }}>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={500}>
          Export Progress
        </Text>
        {status !== 'processing' && (
          <Text size="sm" c={getStatusColor()}>
            {status === 'completed' ? 'Completed' : 'Failed'}
          </Text>
        )}
      </Group>

      <Progress 
        value={progress} 
        color={getStatusColor()} 
        size="lg"
        striped={status === 'processing'}
        animated={status === 'processing'}
      />

      {message && (
        <Text size="sm" c="dimmed">
          {message}
        </Text>
      )}

      {status === 'processing' && onCancel && (
        <Button variant="light" size="sm" onClick={onCancel}>
          Cancel Export
        </Button>
      )}

      {status === 'failed' && onRetry && (
        <Group>
          <Button variant="light" size="sm" onClick={onCancel} leftSection={<IconX size={16} />}>
            Cancel
          </Button>
          <Button size="sm" onClick={onRetry} leftSection={<IconCheck size={16} />}>
            Retry
          </Button>
        </Group>
      )}
    </Stack>
  );
}
