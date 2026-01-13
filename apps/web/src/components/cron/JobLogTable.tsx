import { 
  Table, 
  Text,
  Badge,
  Group,
  ActionIcon,
  Tooltip,
  Skeleton,
} from '@mantine/core';
import { 
  IconEye, 
  IconCheck, 
  IconX,
  IconClock
} from '@tabler/icons-react';
import { JobExecutionLog } from '@/lib/api/cron';

interface JobLogTableProps {
  logs: JobExecutionLog[];
  loading?: boolean;
  onViewLog?: (log: JobExecutionLog) => void;
}

export function JobLogTable({ logs, loading, onViewLog }: JobLogTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Success</Badge>;
      case 'failed':
        return <Badge color="red" variant="light" leftSection={<IconX size={12} />}>Failed</Badge>;
      case 'running':
        return <Badge color="blue" variant="light" leftSection={<IconClock size={12} className="animate-spin" />}>Running</Badge>;
      default:
        return <Badge color="gray" variant="light">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Timestamp</Table.Th>
            <Table.Th>Job Name</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[1, 2, 3, 4, 5].map((i) => (
            <Table.Tr key={i}>
              <Table.Td><Skeleton height={16} width={150} /></Table.Td>
              <Table.Td><Skeleton height={16} width={120} /></Table.Td>
              <Table.Td><Skeleton height={20} width={80} /></Table.Td>
              <Table.Td><Skeleton height={16} width={60} /></Table.Td>
              <Table.Td><Skeleton height={32} width={32} /></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  if (logs.length === 0) {
    return (
      <Text ta="center" py="xl" c="dimmed">
        No execution logs found
      </Text>
    );
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Timestamp</Table.Th>
          <Table.Th>Job Name</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Duration</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {logs.map((log) => (
          <Table.Tr key={log.id}>
            <Table.Td>
              <Text size="sm">
                {new Date(log.timestamp).toLocaleString()}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {log.jobName}
              </Text>
            </Table.Td>
            <Table.Td>
              {getStatusBadge(log.status)}
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {log.duration > 0 ? `${log.duration.toFixed(2)}s` : 'N/A'}
              </Text>
            </Table.Td>
            <Table.Td>
              {onViewLog && (
                <Tooltip label="View Details">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => onViewLog(log)}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
