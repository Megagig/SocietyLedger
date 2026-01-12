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
import { IconPlus, IconDots, IconRefresh, IconFilter } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { smsApi, SMSCampaign } from '@/lib/api/sms';
import { CampaignStatusBadge } from '@/components/communications/CampaignStatusBadge';

export default function CampaignsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: campaignsData, isLoading, refetch } = useQuery({
    queryKey: ['sms-campaigns', page, statusFilter, searchQuery],
    queryFn: () =>
      smsApi.getCampaigns({
        page,
        limit: 20,
        status: statusFilter || undefined,
      }),
  });

  const campaigns = campaignsData?.campaigns || [];
  const totalPages = campaignsData?.totalPages || 1;

  const handleRefresh = () => {
    refetch();
  };

  const handleViewCampaign = (id: number) => {
    router.push(`/dashboard/communications/campaigns/${id}`);
  };

  const handleStartCampaign = async (id: number) => {
    try {
      await smsApi.startCampaign(id);
      refetch();
    } catch (error) {
      console.error('Failed to start campaign:', error);
    }
  };

  const handleCancelCampaign = async (id: number) => {
    try {
      await smsApi.cancelCampaign(id);
      refetch();
    } catch (error) {
      console.error('Failed to cancel campaign:', error);
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }

    try {
      await smsApi.deleteCampaign(id);
      refetch();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const rows = campaigns.map((campaign: SMSCampaign) => (
    <Table.Tr key={campaign.id}>
      <Table.Td>{campaign.name}</Table.Td>
      <Table.Td>
        <CampaignStatusBadge status={campaign.status} />
      </Table.Td>
      <Table.Td>{campaign.recipientCount.toLocaleString()}</Table.Td>
      <Table.Td>{campaign.sentCount.toLocaleString()}</Table.Td>
      <Table.Td>{campaign.deliveredCount.toLocaleString()}</Table.Td>
      <Table.Td>
        {campaign.scheduledFor
          ? new Date(campaign.scheduledFor).toLocaleDateString()
          : '-'}
      </Table.Td>
      <Table.Td>
        {new Date(campaign.createdAt).toLocaleDateString()}
      </Table.Td>
      <Table.Td>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item onClick={() => handleViewCampaign(campaign.id)}>
              View Details
            </Menu.Item>
            {campaign.status === 'draft' && (
              <Menu.Item onClick={() => handleStartCampaign(campaign.id)}>
                Start Campaign
              </Menu.Item>
            )}
            {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
              <Menu.Item onClick={() => handleCancelCampaign(campaign.id)}>
                Cancel Campaign
              </Menu.Item>
            )}
            {campaign.status === 'draft' && (
              <Menu.Item
                color="red"
                onClick={() => handleDeleteCampaign(campaign.id)}
              >
                Delete
              </Menu.Item>
            )}
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
            <Title order={2}>SMS Campaigns</Title>
            <Text c="dimmed">Manage your SMS campaigns</Text>
          </div>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => router.push('/dashboard/communications/campaigns/new')}
            size="lg"
          >
            Create Campaign
          </Button>
        </Group>

        {/* Filters */}
        <Card padding="md" withBorder>
          <Group>
            <TextInput
              placeholder="Search campaigns..."
              leftSection={<IconFilter size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: 'draft', label: 'Draft' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'failed', label: 'Failed' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ width: 200 }}
            />
            <ActionIcon onClick={handleRefresh} variant="subtle">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>
        </Card>

        {/* Campaigns Table */}
        {campaigns.length === 0 ? (
          <Card padding="xl" withBorder>
            <Stack align="center" gap="md">
              <Text size="lg" c="dimmed">
                No campaigns found
              </Text>
              <Button
                variant="light"
                onClick={() => router.push('/dashboard/communications/campaigns/new')}
              >
                Create Your First Campaign
              </Button>
            </Stack>
          </Card>
        ) : (
          <Card padding={0} withBorder>
            <Table.ScrollContainer minWidth={800}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Campaign Name</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Recipients</Table.Th>
                    <Table.Th>Sent</Table.Th>
                    <Table.Th>Delivered</Table.Th>
                    <Table.Th>Scheduled For</Table.Th>
                    <Table.Th>Created</Table.Th>
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
