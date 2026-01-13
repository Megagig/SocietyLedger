'use client';

import {
  Stack,
  Title,
  Text,
  Group,
  Card,
  Select,
  TextInput,
  Button,
  Modal,
  Skeleton
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconRefresh,
  IconFilter,
  IconSearch,
  IconX
} from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { webhooksApi, WebhookEvent } from '@/lib/api/webhooks';
import { WebhookEventTable } from '@/components/webhooks/WebhookEventTable';
import { EventPayloadViewer } from '@/components/webhooks/EventPayloadViewer';
import { notifications } from '@mantine/notifications';

export default function WebhooksEventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [eventType, setEventType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Modal
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20
      };
      
      if (eventType) params.eventType = eventType;
      if (status) params.status = status;
      if (search) params.search = search;
      if (startDate) params.startDate = startDate.toISOString();
      if (endDate) params.endDate = endDate.toISOString();
      
      const response = await webhooksApi.getEvents(params);
      setEvents(response.events);
      setTotal(response.total);
      setTotalPages(Math.ceil(response.total / response.limit));
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch webhook events',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page]);

  const handleViewDetails = (event: WebhookEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleRetry = async (event: WebhookEvent) => {
    try {
      setRetrying(event.id);
      await webhooksApi.retryEvent(event.id);
      notifications.show({
        title: 'Success',
        message: 'Webhook event has been queued for retry',
        color: 'green'
      });
      await fetchEvents();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to retry event',
        color: 'red'
      });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async (event: WebhookEvent) => {
    if (!confirm(`Are you sure you want to delete webhook event #${event.id}?`)) {
      return;
    }
    notifications.show({
      title: 'Info',
      message: 'Delete functionality will be available in a future update',
      color: 'blue'
    });
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchEvents();
  };

  const handleClearFilters = () => {
    setEventType(null);
    setStatus(null);
    setSearch('');
    setStartDate(null);
    setEndDate(null);
    setPage(1);
    fetchEvents();
  };

  const EVENT_TYPES = [
    { value: 'payment.success', label: 'Payment Success' },
    { value: 'payment.failed', label: 'Payment Failed' },
    { value: 'subscription.created', label: 'Subscription Created' },
    { value: 'subscription.renewed', label: 'Subscription Renewed' },
    { value: 'subscription.cancelled', label: 'Subscription Cancelled' },
    { value: 'invoice.created', label: 'Invoice Created' },
    { value: 'invoice.paid', label: 'Invoice Paid' },
    { value: 'invoice.failed', label: 'Invoice Failed' },
    { value: 'customer.created', label: 'Customer Created' },
    { value: 'customer.updated', label: 'Customer Updated' },
    { value: 'member.joined', label: 'Member Joined' },
    { value: 'member.left', label: 'Member Left' },
    { value: 'meeting.scheduled', label: 'Meeting Scheduled' },
    { value: 'meeting.completed', label: 'Meeting Completed' },
  ];

  const STATUS_OPTIONS = [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
    { value: 'retrying', label: 'Retrying' },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Webhook Events</Title>
          <Text c="dimmed">View and manage all webhook event logs</Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={20} />}
            onClick={fetchEvents}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Card withBorder p="md">
        <Stack gap="md">
          <Group gap="xs">
            <IconFilter size={20} className="text-gray-500" />
            <Text size="sm" fw={500}>
              Filters
            </Text>
          </Group>
          
          <Group gap="md" align="flex-end">
            <Select
              label="Event Type"
              placeholder="All types"
              data={EVENT_TYPES}
              value={eventType}
              onChange={setEventType}
              clearable
              style={{ flex: 1 }}
            />
            
            <Select
              label="Status"
              placeholder="All statuses"
              data={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              clearable
              style={{ flex: 1 }}
            />
            
            <TextInput
              label="Search"
              placeholder="Search by ID, endpoint..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
          </Group>
          
          <Group gap="md">
            <DateInput
              label="Start Date"
              placeholder="Select start date"
              value={startDate}
              onChange={setStartDate}
              clearable
              style={{ flex: 1 }}
            />
            
            <DateInput
              label="End Date"
              placeholder="Select end date"
              value={endDate}
              onChange={setEndDate}
              clearable
              style={{ flex: 1 }}
            />
          </Group>
          
          <Group gap="sm">
            <Button onClick={handleApplyFilters} leftSection={<IconFilter size={16} />}>
              Apply Filters
            </Button>
            <Button variant="light" onClick={handleClearFilters} leftSection={<IconX size={16} />}>
              Clear Filters
            </Button>
          </Group>
        </Stack>
      </Card>

      <Text size="sm" c="dimmed">
        Showing {events.length} of {total} events
      </Text>

      <WebhookEventTable
        events={events}
        loading={loading}
        onViewDetails={handleViewDetails}
        onRetry={handleRetry}
        onDelete={handleDelete}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Webhook Event #${selectedEvent?.id}`}
        size="xl"
      >
        {selectedEvent && (
          <Stack gap="md">
            <Group gap="md">
              <div>
                <Text size="xs" c="dimmed">Event Type</Text>
                <Text size="sm" fw={500}>{selectedEvent.eventType}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Text size="sm" fw={500} c={selectedEvent.status === 'success' ? 'green' : selectedEvent.status === 'failed' ? 'red' : 'blue'}>
                  {selectedEvent.status}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Response Code</Text>
                <Text size="sm" fw={500}>{selectedEvent.statusCode || selectedEvent.responseCode || 'N/A'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Duration</Text>
                <Text size="sm" fw={500}>{selectedEvent.duration ? `${selectedEvent.duration}ms` : 'N/A'}</Text>
              </div>
            </Group>
            
            {selectedEvent.errorMessage && (
              <Card withBorder p="sm" bg="red.0">
                <Text size="sm" c="red" fw={500}>Error: {selectedEvent.errorMessage}</Text>
              </Card>
            )}
            
            {selectedEvent.payload && (
              <EventPayloadViewer payload={selectedEvent.payload} />
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
