'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Stack,
  Table,
  Badge,
  Button,
  Group,
  TextInput,
  Select,
  LoadingOverlay,
  Alert,
  Modal,
  Progress,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getSMSCampaigns,
  startSMSCampaign,
  cancelSMSCampaign,
  deleteSMSCampaign,
  type SMSCampaign,
} from '@/lib/api/communication';

export default function CampaignsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [selectedCampaign, setSelectedCampaign] = useState<SMSCampaign | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [debounced] = useDebouncedValue(search, 500);

  useEffect(() => {
    loadCampaigns();
  }, [page, debounced, status]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const res = await getSMSCampaigns({
        page,
        limit: 10,
        status: status || undefined,
      });
      setCampaigns(res.data.campaigns);
      setTotal(res.data.total);
    } catch (err: any) {
      console.error('Error loading campaigns:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to load campaigns',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startSMSCampaign(id);
      notifications.show({
        title: 'Campaign Started',
        message: 'The campaign has been started',
        color: 'green',
      });
      loadCampaigns();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to start campaign',
        color: 'red',
      });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelSMSCampaign(id);
      notifications.show({
        title: 'Campaign Cancelled',
        message: 'The campaign has been cancelled',
        color: 'blue',
      });
      loadCampaigns();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to cancel campaign',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id: number) => {
    modals.openConfirmModal({
      title: 'Delete Campaign',
      children: <Text size="sm">Are you sure you want to delete this campaign?</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteSMSCampaign(id);
          notifications.show({
            title: 'Campaign Deleted',
            message: 'The campaign has been deleted',
            color: 'green',
          });
          loadCampaigns();
        } catch (err: any) {
          notifications.show({
            title: 'Error',
            message: err.message || 'Failed to delete campaign',
            color: 'red',
          });
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'IN_PROGRESS':
        return 'blue';
      case 'SCHEDULED':
        return 'yellow';
      case 'FAILED':
        return 'red';
      case 'CANCELLED':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getProgress = (campaign: SMSCampaign) => {
    if (campaign.totalRecipients === 0) return 0;
    return (campaign.sentCount / campaign.totalRecipients) * 100;
  };

  return (
    <Can
      permission={PERMISSIONS.SMS_SEND}
      fallback={<Alert color="red">You don't have permission to view campaigns</Alert>}
    >
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>SMS Campaigns</Title>
            <Text size="sm" c="dimmed">
              Manage SMS campaigns to reach multiple members
            </Text>
          </div>
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => router.push('/dashboard/communications/campaigns/new')}
          >
            New Campaign
          </Button>
        </Group>

        {/* Filters */}
        <Card withBorder padding="md">
          <Group>
            <TextInput
              placeholder="Search campaigns..."
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
                { value: 'DRAFT', label: 'Draft' },
                { value: 'SCHEDULED', label: 'Scheduled' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'FAILED', label: 'Failed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              style={{ width: 180 }}
              clearable
            />
          </Group>
        </Card>

        {/* Campaigns Table */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {campaigns.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No campaigns found. Create your first campaign to get started.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Recipients</Table.Th>
                  <Table.Th>Progress</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {campaigns.map((campaign) => (
                  <Table.Tr key={campaign.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {campaign.name}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{campaign.totalRecipients}</Text>
                    </Table.Td>
                    <Table.Td>
                      <div style={{ width: 100 }}>
                        <Progress value={getProgress(campaign)} size="sm" />
                        <Text size="xs" c="dimmed" mt={4}>
                          {campaign.sentCount} / {campaign.totalRecipients}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(campaign.status)} size="sm">
                        {campaign.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          size="sm"
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye size={14} />
                        </ActionIcon>

                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="light" size="sm">
                              <MoreVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {campaign.status === 'DRAFT' && (
                              <Menu.Item
                                leftSection={<Play size={14} />}
                                onClick={() => handleStart(campaign.id)}
                              >
                                Start
                              </Menu.Item>
                            )}
                            {campaign.status === 'IN_PROGRESS' && (
                              <Menu.Item
                                leftSection={<Pause size={14} />}
                                onClick={() => handleCancel(campaign.id)}
                              >
                                Cancel
                              </Menu.Item>
                            )}
                            <Menu.Item
                              leftSection={<Trash2 size={14} />}
                              color="red"
                              onClick={() => handleDelete(campaign.id)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        {total > 10 && (
          <Group justify="center">
            <Button
              variant="light"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Text size="sm">
              Page {page} of {Math.ceil(total / 10)}
            </Text>
            <Button
              variant="light"
              disabled={page >= Math.ceil(total / 10)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </Group>
        )}

        {/* Details Modal */}
        <Modal
          opened={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title="Campaign Details"
          size="lg"
        >
          {selectedCampaign && (
            <Stack gap="md">
              <div>
                <Text size="sm" c="dimmed">
                  Name
                </Text>
                <Text size="sm" fw={500}>
                  {selectedCampaign.name}
                </Text>
              </div>

              <div>
                <Text size="sm" c="dimmed">
                  Message
                </Text>
                <Text size="sm">{selectedCampaign.message}</Text>
              </div>

              <Group grow>
                <div>
                  <Text size="sm" c="dimmed">
                    Total Recipients
                  </Text>
                  <Text size="lg" fw={700}>
                    {selectedCampaign.totalRecipients}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Sent
                  </Text>
                  <Text size="lg" fw={700}>
                    {selectedCampaign.sentCount}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Delivered
                  </Text>
                  <Text size="lg" fw={700}>
                    {selectedCampaign.deliveredCount}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Failed
                  </Text>
                  <Text size="lg" fw={700}>
                    {selectedCampaign.failedCount}
                  </Text>
                </div>
              </Group>

              <Progress value={getProgress(selectedCampaign)} size="lg" />

              <div>
                <Text size="sm" c="dimmed">
                  Status
                </Text>
                <Badge color={getStatusColor(selectedCampaign.status)} size="lg" mt={4}>
                  {selectedCampaign.status}
                </Badge>
              </div>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Can>
  );
}
