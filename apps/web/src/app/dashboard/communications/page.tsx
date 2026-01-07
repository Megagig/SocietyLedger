'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Grid,
  Group,
  Stack,
  LoadingOverlay,
  Badge,
  Table,
  Button,
  Alert,
} from '@mantine/core';
import {
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  TrendingUp,
  AlertCircle,
  Plus,
  FileText,
  DollarSign,
  Clock,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getSMSDashboard,
  getSMSCreditBalance,
  type SMSDashboard,
  type SMSCreditBalance,
} from '@/lib/api/communication';

export default function CommunicationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<SMSDashboard | null>(null);
  const [credits, setCredits] = useState<SMSCreditBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardRes, creditsRes] = await Promise.all([
        getSMSDashboard(),
        getSMSCreditBalance(),
      ]);
      setDashboard(dashboardRes.data);
      setCredits(creditsRes.data);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getDeliveryRateColor = (rate: number) => {
    if (rate >= 90) return 'green';
    if (rate >= 75) return 'yellow';
    return 'red';
  };

  return (
    <Can permission={PERMISSIONS.SMS_SEND} fallback={<Alert color="red">You don't have permission to view SMS communications</Alert>}>
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Communications</Title>
            <Text size="sm" c="dimmed">
              Manage SMS messages, campaigns, and templates
            </Text>
          </div>
          <Group>
            <Button
              leftSection={<FileText size={16} />}
              variant="light"
              onClick={() => router.push('/dashboard/communications/templates')}
            >
              Templates
            </Button>
            <Button
              leftSection={<Send size={16} />}
              onClick={() => router.push('/dashboard/communications/quick-send')}
            >
              Quick Send
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Low SMS Credits Warning */}
        {credits && credits.balance === 0 && (
          <Alert icon={<AlertCircle size={16} />} color="orange" title="Low SMS Credits">
            <Group justify="space-between" align="center">
              <Text size="sm">
                You have {credits.balance} credits remaining. Top up to continue sending SMS.
              </Text>
              <Button 
                size="xs" 
                variant="filled" 
                color="orange"
                onClick={() => router.push('/dashboard/communication/sms/credits')}
              >
                Top Up
              </Button>
            </Group>
          </Alert>
        )}

        <LoadingOverlay visible={loading} />

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  SMS Balance
                </Text>
                <DollarSign size={20} color="green" />
              </Group>
              <Text size="xl" fw={700}>
                {credits?.balance.toLocaleString() || 0}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Credits available
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Messages Sent
                </Text>
                <Send size={20} color="blue" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.totalMessagesSent.toLocaleString() || 0}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Total messages sent
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Delivery Rate
                </Text>
                <TrendingUp size={20} color="green" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.deliveryRate.toFixed(1) || 0}%
              </Text>
              <Badge
                color={getDeliveryRateColor(dashboard?.deliveryRate || 0)}
                size="sm"
                mt="xs"
              >
                {dashboard?.totalMessagesDelivered || 0} delivered
              </Badge>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Active Campaigns
                </Text>
                <MessageSquare size={20} color="orange" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.activeCampaigns || 0}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Out of {dashboard?.totalCampaigns || 0} total
              </Text>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Quick Actions */}
        <Card withBorder padding="lg">
          <Title order={4} mb="md">
            Quick Actions
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                leftSection={<Send size={16} />}
                onClick={() => router.push('/dashboard/communications/quick-send')}
              >
                Send SMS
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                leftSection={<Plus size={16} />}
                onClick={() => router.push('/dashboard/communications/campaigns/new')}
              >
                New Campaign
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                leftSection={<FileText size={16} />}
                onClick={() => router.push('/dashboard/communications/templates')}
              >
                Manage Templates
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                leftSection={<Clock size={16} />}
                onClick={() => router.push('/dashboard/communications/history')}
              >
                View History
              </Button>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Recent Messages */}
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Recent Messages</Title>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => router.push('/dashboard/communications/history')}
            >
              View All
            </Button>
          </Group>

          {!dashboard?.recentMessages || dashboard.recentMessages.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No messages sent yet. Send your first SMS to get started.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Recipient</Table.Th>
                  <Table.Th>Message</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Sent</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.recentMessages.slice(0, 5).map((message) => (
                  <Table.Tr key={message.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {message.recipientName || 'Unknown'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {message.recipientPhone}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1}>
                        {message.message}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          message.status === 'DELIVERED'
                            ? 'green'
                            : message.status === 'SENT'
                            ? 'blue'
                            : message.status === 'FAILED'
                            ? 'red'
                            : 'gray'
                        }
                        size="sm"
                      >
                        {message.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {new Date(message.createdAt).toLocaleDateString()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Recent Campaigns */}
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Recent Campaigns</Title>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => router.push('/dashboard/communications/campaigns')}
            >
              View All
            </Button>
          </Group>

          {!dashboard?.recentCampaigns || dashboard.recentCampaigns.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No campaigns yet. Create your first campaign to reach multiple members.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Recipients</Table.Th>
                  <Table.Th>Sent</Table.Th>
                  <Table.Th>Delivered</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.recentCampaigns.slice(0, 5).map((campaign) => (
                  <Table.Tr key={campaign.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {campaign.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>{campaign.totalRecipients}</Table.Td>
                    <Table.Td>{campaign.sentCount}</Table.Td>
                    <Table.Td>{campaign.deliveredCount}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          campaign.status === 'COMPLETED'
                            ? 'green'
                            : campaign.status === 'IN_PROGRESS'
                            ? 'blue'
                            : campaign.status === 'FAILED'
                            ? 'red'
                            : 'gray'
                        }
                        size="sm"
                      >
                        {campaign.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Low Balance Warning */}
        {credits && credits.balance < 100 && (
          <Alert icon={<AlertCircle size={16} />} color="orange" title="Low SMS Balance">
            <Text size="sm" mb="sm">
              You have only {credits.balance} SMS credits remaining. Top up now to continue sending messages.
            </Text>
            <Button 
              size="xs" 
              variant="light" 
              color="orange"
              onClick={() => router.push('/dashboard/communication/sms/credits')}
            >
              Top Up Credits
            </Button>
          </Alert>
        )}
      </Stack>
    </Can>
  );
}
