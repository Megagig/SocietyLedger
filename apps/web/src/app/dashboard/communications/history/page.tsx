'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Table,
  Badge,
  Group,
  TextInput,
  Select,
  LoadingOverlay,
  Alert,
  Modal,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Search, AlertCircle, Eye } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { getSMSMessages, type SMSMessage } from '@/lib/api/communication';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<SMSMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [debounced] = useDebouncedValue(search, 500);

  useEffect(() => {
    loadMessages();
  }, [page, debounced, status, startDate, endDate]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await getSMSMessages({
        page,
        limit: 20,
        search: debounced || undefined,
        status: status || undefined,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      });
      setMessages(res.data.messages);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load message history',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'green';
      case 'SENT':
        return 'blue';
      case 'FAILED':
        return 'red';
      case 'PENDING':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Can
      permission={PERMISSIONS.SMS_SEND}
      fallback={<Alert color="red">You don't have permission to view message history</Alert>}
    >
      <Stack gap="lg">
        <div>
          <Title order={2}>SMS History</Title>
          <Text size="sm" c="dimmed">
            View all sent SMS messages
          </Text>
        </div>

        {/* Filters */}
        <Card withBorder padding="md">
          <Stack gap="md">
            <Group>
              <TextInput
                placeholder="Search recipient or message..."
                leftSection={<Search size={16} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="Status"
                value={status}
                onChange={(value) => setStatus(value || '')}
                data={[
                  { value: '', label: 'All Statuses' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'SENT', label: 'Sent' },
                  { value: 'DELIVERED', label: 'Delivered' },
                  { value: 'FAILED', label: 'Failed' },
                ]}
                style={{ width: 150 }}
                clearable
              />
            </Group>

            <Group>
              <DatePickerInput
                placeholder="Start date"
                value={startDate}
                onChange={setStartDate}
                clearable
                style={{ flex: 1 }}
              />
              <DatePickerInput
                placeholder="End date"
                value={endDate}
                onChange={setEndDate}
                clearable
                style={{ flex: 1 }}
              />
            </Group>
          </Stack>
        </Card>

        {/* Messages Table */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {messages.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No messages found
            </Text>
          ) : (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Recipient</Table.Th>
                    <Table.Th>Message</Table.Th>
                    <Table.Th>Campaign</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Sent</Table.Th>
                    <Table.Th>Delivered</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {messages.map((message) => (
                    <Table.Tr
                      key={message.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedMessage(message);
                        setDetailsOpen(true);
                      }}
                    >
                      <Table.Td>
                        <div>
                          {message.recipientName && (
                            <Text size="sm" fw={500}>
                              {message.recipientName}
                            </Text>
                          )}
                          <Text size="xs" c="dimmed">
                            {message.recipientPhone}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {message.message}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {message.campaignName ? (
                          <Text size="sm">{message.campaignName}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Quick Send
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(message.status)} size="sm">
                          {message.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(message.createdAt).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {message.deliveredAt ? (
                          <Text size="sm">
                            {new Date(message.deliveredAt).toLocaleString()}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              {total > 20 && (
                <Group justify="space-between" mt="md">
                  <Text size="sm" c="dimmed">
                    Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}{' '}
                    messages
                  </Text>
                  <Group>
                    <Button
                      variant="light"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Text size="sm">
                      Page {page} of {Math.ceil(total / 20)}
                    </Text>
                    <Button
                      variant="light"
                      disabled={page >= Math.ceil(total / 20)}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </Group>
                </Group>
              )}
            </>
          )}
        </Card>

        {/* Message Details Modal */}
        <Modal
          opened={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title="Message Details"
          size="md"
        >
          {selectedMessage && (
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed">
                  Recipient
                </Text>
                <Text size="sm" fw={500}>
                  {selectedMessage.recipientName || 'Unknown'}
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedMessage.recipientPhone}
                </Text>
              </div>

              {selectedMessage.campaignName && (
                <div>
                  <Text size="sm" c="dimmed">
                    Campaign
                  </Text>
                  <Text size="sm">{selectedMessage.campaignName}</Text>
                </div>
              )}

              <div>
                <Text size="sm" c="dimmed">
                  Message
                </Text>
                <Text size="sm">{selectedMessage.message}</Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">
                  Status
                </Text>
                <Badge color={getStatusColor(selectedMessage.status)} size="lg" mt={4}>
                  {selectedMessage.status}
                </Badge>
              </div>

              <div>
                <Text size="sm" c="dimmed">
                  Sent At
                </Text>
                <Text size="sm">
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </Text>
              </div>

              {selectedMessage.deliveredAt && (
                <div>
                  <Text size="sm" c="dimmed">
                    Delivered At
                  </Text>
                  <Text size="sm">
                    {new Date(selectedMessage.deliveredAt).toLocaleString()}
                  </Text>
                </div>
              )}

              {selectedMessage.failureReason && (
                <Alert icon={<AlertCircle size={16} />} color="red">
                  <Text size="sm" fw={500}>
                    Failure Reason
                  </Text>
                  <Text size="sm">{selectedMessage.failureReason}</Text>
                </Alert>
              )}

              {selectedMessage.externalId && (
                <div>
                  <Text size="sm" c="dimmed">
                    External ID
                  </Text>
                  <Text size="xs" style={{ fontFamily: 'monospace' }}>
                    {selectedMessage.externalId}
                  </Text>
                </div>
              )}
            </Stack>
          )}
        </Modal>
      </Stack>
    </Can>
  );
}
