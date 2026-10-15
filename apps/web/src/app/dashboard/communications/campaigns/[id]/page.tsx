'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Button,
  Card,
  Badge,
  Text,
  LoadingOverlay,
  Skeleton,
  Alert,
} from '@mantine/core';
import { IconArrowLeft, IconSend, IconClock, IconX, IconRefresh } from '@tabler/icons-react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, SMSCampaign } from '@/lib/api/sms';
import { CampaignStatusBadge } from '@/components/communications/CampaignStatusBadge';
import { CampaignProgress } from '@/components/communications/CampaignProgress';

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = Array.isArray(params.id) ? parseInt(params.id[0]) : parseInt(params.id || '0');
  const queryClient = useQueryClient();

  const [showRecipients, setShowRecipients] = useState(false);

  const { data: campaign, isLoading, error, refetch } = useQuery<SMSCampaign>({
    queryKey: ['sms-campaign', campaignId],
    queryFn: () => smsApi.getCampaign(campaignId),
    enabled: !!campaignId,
  });

  const startMutation = useMutation({
    mutationFn: () => smsApi.startCampaign(campaignId),
    onSuccess: () => {
      notifications.show({
        title: 'Campaign Started',
        message: 'Your campaign has been started',
        color: 'green',
      });
      refetch();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Start Campaign',
        message: error.response?.data?.message || 'An error occurred',
        color: 'red',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => smsApi.cancelCampaign(campaignId),
    onSuccess: () => {
      notifications.show({
        title: 'Campaign Cancelled',
        message: 'Your campaign has been cancelled',
        color: 'orange',
      });
      refetch();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Cancel Campaign',
        message: error.response?.data?.message || 'An error occurred',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => smsApi.deleteCampaign(campaignId),
    onSuccess: () => {
      notifications.show({
        title: 'Campaign Deleted',
        message: 'Your campaign has been deleted',
        color: 'green',
      });
      router.push('/dashboard/communications/campaigns');
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Delete Campaign',
        message: error.response?.data?.message || 'An error occurred',
        color: 'red',
      });
    },
  });

  const handleStart = () => {
    if (!confirm('Are you sure you want to start this campaign?')) {
      return;
    }
    startMutation.mutate();
  };

  const handleCancel = () => {
    if (!confirm('Are you sure you want to cancel this campaign?')) {
      return;
    }
    cancelMutation.mutate();
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Skeleton height={40} width={300} />
          <Card padding="lg" radius="md" withBorder>
            <Skeleton height={100} mb="md" />
            <Skeleton height={100} mb="md" />
            <Skeleton height={100} />
          </Card>
        </Stack>
      </Container>
    );
  }

  if (error || !campaign) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" title="Error loading campaign">
          Failed to load campaign details. Please try again.
        </Alert>
      </Container>
    );
  }

  const canStart = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  const canCancel = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED' || campaign.status === 'IN_PROGRESS';
  const canDelete = campaign.status === 'DRAFT' || campaign.status === 'CANCELLED' || campaign.status === 'FAILED';

  return (
    <Container size="xl" py="xl">
      <LoadingOverlay visible={startMutation.isPending || cancelMutation.isPending || deleteMutation.isPending} />
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <Button
              variant="subtle"
              onClick={() => router.push('/dashboard/communications/campaigns')}
            >
              <IconArrowLeft size={18} />
            </Button>
            <div>
              <Title order={2}>{campaign.name}</Title>
              <CampaignStatusBadge status={campaign.status} />
            </div>
          </Group>
          <Group>
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => refetch()}
              variant="light"
            >
              Refresh
            </Button>
            {canStart && (
              <Button
                leftSection={<IconSend size={18} />}
                onClick={handleStart}
                color="blue"
                loading={startMutation.isPending}
              >
                Start Campaign
              </Button>
            )}
            {canCancel && (
              <Button
                leftSection={<IconX size={18} />}
                onClick={handleCancel}
                color="orange"
                loading={cancelMutation.isPending}
              >
                Cancel Campaign
              </Button>
            )}
            {canDelete && (
              <Button
                color="red"
                onClick={handleDelete}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </Group>
        </Group>

        {/* Campaign Info */}
        <Card padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group>
              <div>
                <Text size="sm" c="dimmed">Created</Text>
                <Text fw={500}>
                  {new Date(campaign.createdAt).toLocaleString()}
                </Text>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <Text size="sm" c="dimmed">Scheduled For</Text>
                  <Text fw={500}>
                    {new Date(campaign.scheduledAt).toLocaleString()}
                  </Text>
                </div>
              )}
              {campaign.startedAt && (
                <div>
                  <Text size="sm" c="dimmed">Started</Text>
                  <Text fw={500}>
                    {new Date(campaign.startedAt).toLocaleString()}
                  </Text>
                </div>
              )}
              {campaign.completedAt && (
                <div>
                  <Text size="sm" c="dimmed">Completed</Text>
                  <Text fw={500}>
                    {new Date(campaign.completedAt).toLocaleString()}
                  </Text>
                </div>
              )}
            </Group>

            <Card padding="md" bg="gray.0" radius="sm">
              <Text size="sm">{campaign.message}</Text>
            </Card>

            <Group>
              <Badge size="lg" variant="light">
                {campaign.totalRecipients.toLocaleString()} Recipients
              </Badge>
              <Badge size="lg" variant="light">
                {campaign.sentCount.toLocaleString()} Sent
              </Badge>
              <Badge size="lg" variant="light">
                {campaign.deliveredCount.toLocaleString()} Delivered
              </Badge>
              <Badge size="lg" variant="light">
                {campaign.failedCount.toLocaleString()} Failed
              </Badge>
            </Group>
          </Stack>
        </Card>

        {/* Progress */}
        {(campaign.status === 'IN_PROGRESS' || campaign.status === 'COMPLETED') && (
          <Card padding="lg" radius="md" withBorder>
            <Title order={3} mb="md">Campaign Progress</Title>
            <CampaignProgress
              sent={campaign.sentCount}
              delivered={campaign.deliveredCount}
              failed={campaign.failedCount}
              total={campaign.totalRecipients}
            />
          </Card>
        )}

        {/* Info */}
        {campaign.status === 'DRAFT' && (
          <Alert color="blue" variant="light">
            This campaign is a draft. Click "Start Campaign" to begin sending messages.
          </Alert>
        )}

        {campaign.status === 'SCHEDULED' && (
          <Alert color="cyan" variant="light">
            This campaign is scheduled. Messages will be sent at the scheduled time.
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
