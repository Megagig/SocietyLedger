'use client';

import { 
  Table, 
  Group, 
  Text, 
  Badge, 
  ActionIcon, 
  Tooltip,
  Stack,
  Paper,
  Pagination
} from '@mantine/core';
import { 
  IconRefresh, 
  IconEye, 
  IconTrash,
  IconChevronRight,
  IconClock
} from '@tabler/icons-react';
import { EventStatusBadge } from './EventStatusBadge';

interface WebhookEvent {
  id: number;
  eventType: string;
  status: 'success' | 'failed' | 'pending' | 'retrying';
  statusCode?: number;
  timestamp: string;
  source: string;
  duration?: number;
  retryCount?: number;
  errorMessage?: string;
}

interface WebhookEventTableProps {
  events: WebhookEvent[];
  loading?: boolean;
  onViewDetails?: (event: WebhookEvent) => void;
  onRetry?: (event: WebhookEvent) => void;
  onDelete?: (event: WebhookEvent) => void;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function WebhookEventTable({
  events,
  loading = false,
  onViewDetails,
  onRetry,
  onDelete,
  page = 1,
  totalPages = 1,
  onPageChange
}: WebhookEventTableProps) {
  const rows = events.map((event) => (
    <Table.Tr key={event.id}>
      <Table.Td>
        <Text size="sm" fw={500}>
          #{event.id}
        </Text>
      </Table.Td>
      
      <Table.Td>
        <Group gap="xs">
          <Badge variant="light" size="sm">
            {event.eventType}
          </Badge>
        </Group>
      </Table.Td>

      <Table.Td>
        <EventStatusBadge status={event.status} />
      </Table.Td>

      <Table.Td>
        {event.statusCode && (
          <Badge 
            color={event.statusCode >= 200 && event.statusCode < 300 ? 'green' : 'red'} 
            variant="light"
            size="sm"
          >
            {event.statusCode}
          </Badge>
        )}
      </Table.Td>

      <Table.Td>
        <Text size="sm">{event.source}</Text>
      </Table.Td>

      <Table.Td>
        <Text size="sm">
          {new Date(event.timestamp).toLocaleString()}
        </Text>
      </Table.Td>

      <Table.Td>
        <Group gap="xs">
          {event.duration && (
            <Text size="sm" c="dimmed">
              {event.duration}ms
            </Text>
          )}
          {event.retryCount !== undefined && event.retryCount > 0 && (
            <Badge color="orange" variant="light" size="xs">
              Retry {event.retryCount}
            </Badge>
          )}
        </Group>
      </Table.Td>

      <Table.Td>
        <Group gap="xs">
          <Tooltip label="View Details">
            <ActionIcon 
              variant="subtle" 
              color="blue"
              onClick={() => onViewDetails?.(event)}
            >
              <IconEye size={18} />
            </ActionIcon>
          </Tooltip>
          
          {(event.status === 'failed' || event.status === 'retrying') && (
            <Tooltip label="Retry Event">
              <ActionIcon 
                variant="subtle" 
                color="orange"
                onClick={() => onRetry?.(event)}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label="Delete Event">
            <ActionIcon 
              variant="subtle" 
              color="red"
              onClick={() => onDelete?.(event)}
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Table.ScrollContainer minWidth={1200}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Event Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Status Code</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">
                      Loading events...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : events.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Stack align="center" py="xl" gap="md">
                      <IconClock size={48} className="text-gray-400" />
                      <Text size="lg" c="dimmed" fw={500}>
                        No webhook events found
                      </Text>
                      <Text size="sm" c="dimmed">
                        Events will appear here when webhooks are triggered
                      </Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {totalPages > 1 && (
          <Group justify="flex-end" mt="md">
            <Pagination 
              total={totalPages} 
              value={page} 
              onChange={onPageChange}
            />
          </Group>
        )}
      </Paper>
    </Stack>
  );
}
