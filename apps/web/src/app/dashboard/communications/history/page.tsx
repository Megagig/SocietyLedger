'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Button,
  Card,
  Table,
  Badge,
  TextInput,
  Select,
  Pagination,
  ActionIcon,
  Menu,
  Skeleton,
  Text,
} from '@mantine/core';
import { IconDots, IconRefresh, IconFilter } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { smsApi, SMSMessage } from '@/lib/api/sms';

export default function MessagesHistoryPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['sms-messages', page, statusFilter, searchQuery],
    queryFn: () =>
      smsApi.getMessages({
        page,
        limit: 20,
        status: statusFilter || undefined,
      }),
  });

  const messages = messagesData?.messages || [];
  const totalPages = messagesData?.totalPages || 1;

  const handleRefresh = () => {
    refetch();
  };

  const handleViewMessage = (id: number) => {
    // Open message detail modal
    console.log('View message:', id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'green';
      case 'sent':
        return 'blue';
      case 'failed':
        return 'red';
      case 'pending':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const rows = messages.map((message: SMSMessage) => (
    <Table.Tr key={message.id}>
      <Table.Td>{message.recipientName || message.recipient}</Table.Td>
      <Table.Td>
        <Badge color={getStatusColor(message.status)} variant="filled">
          {message.status.toUpperCase()}
        </Badge>
      </Table.Td>
      <Table.Td>{message.message}</Table.Td>
      <Table.Td>{message.segments}</Table.Td>
      <Table.Td>{message.cost} credits</Table.Td>
      <Table.Td>
        {new Date(message.sentAt).toLocaleString()}
      </Table.Td>
      {message.deliveredAt && (
        <Table.Td>{new Date(message.deliveredAt).toLocaleString()}</Table.Td>
      )}
      <Table.Td>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item onClick={() => handleViewMessage(message.id)}>
              View Details
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  ));

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Card padding="lg" withBorder>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={60} mb="sm" />
            ))}
          </Card>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>SMS History</Title>
            <Text c="dimmed">View all sent SMS messages</Text>
          </div>
          <ActionIcon onClick={handleRefresh} variant="subtle">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {/* Filters */}
        <Card padding="md" withBorder>
          <Group>
            <TextInput
              placeholder="Search by recipient or message..."
              leftSection={<IconFilter size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: 'delivered', label: 'Delivered' },
                { value: 'sent', label: 'Sent' },
                { value: 'failed', label: 'Failed' },
                { value: 'pending', label: 'Pending' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ width: 200 }}
            />
          </Group>
        </Card>

        {/* Messages Table */}
        {messages.length === 0 ? (
          <Card padding="xl" withBorder>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">
                No messages found
              </Text>
              <Button
                variant="light"
                onClick={() => router.push('/dashboard/communications/quick-send')}
              >
                Send Your First SMS
              </Button>
            </Stack>
          </Card>
        ) : (
          <Card padding={0} withBorder>
            <Table.ScrollContainer minWidth={1000}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Recipient</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Message</Table.Th>
                    <Table.Th>Segments</Table.Th>
                    <Table.Th>Cost</Table.Th>
                    <Table.Th>Sent At</Table.Th>
                    <Table.Th>Delivered At</Table.Th>
                    <Table.Th style={{ width: 50 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
