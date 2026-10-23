'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Stack, 
  Button, 
  SimpleGrid,
  Badge,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconDashboard, 
  IconBuildingBank, 
  IconTransfer, 
  IconChecklist, 
  IconUpload, 
  IconClock,
  IconReceipt,
  IconRefresh
} from '@tabler/icons-react';
import nigerianPaymentsApi, { UnmatchedDashboard } from '@/lib/api/nigerian-payments';
import { API_ROUTES } from '@/utils/constants';

export default function NigerianPaymentsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<UnmatchedDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await nigerianPaymentsApi.getUnmatchedDashboard();
      setDashboardData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Bank Accounts',
      description: 'Manage your association bank accounts',
      icon: <IconBuildingBank size={32} />,
      color: 'blue',
      route: '/dashboard/payments/nigerian/bank-accounts',
    },
    {
      title: 'Bank Transfers',
      description: 'Record and track bank transfers',
      icon: <IconTransfer size={32} />,
      color: 'green',
      route: '/dashboard/payments/bank-transfers',
    },
    {
      title: 'Reconciliation',
      description: 'Match payments to bank statements',
      icon: <IconChecklist size={32} />,
      color: 'orange',
      route: '/dashboard/payments/nigerian/reconciliation',
    },
    {
      title: 'Import Statement',
      description: 'Import bank statements for reconciliation',
      icon: <IconUpload size={32} />,
      color: 'purple',
      route: '/dashboard/payments/nigerian/statements',
    },
    {
      title: 'Verification Queue',
      description: 'Review and verify payment proofs',
      icon: <IconReceipt size={32} />,
      color: 'red',
      route: '/dashboard/payments/nigerian/verification',
    },
    {
      title: 'Statement Entries',
      description: 'View imported statement entries',
      icon: <IconClock size={32} />,
      color: 'gray',
      route: '/dashboard/payments/nigerian/statement-entries',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert color="red" title="Error" icon={<IconRefresh />}>
          {error}
          <Button onClick={loadDashboard} variant="light" color="red" size="xs" mt="sm">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Title order={2} mb="md">
        Nigerian Payments Dashboard
      </Title>
      <Text c="dimmed" mb="xl">
        Manage bank accounts, transfers, reconciliation, and payment verification
      </Text>

      {/* Unmatched Payments Summary */}
      {dashboardData && (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md" mb="xl">
          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center">
              <Text size="xl" fw={700} c="blue">
                {dashboardData.totalUnmatched ?? 0}
              </Text>
              <Text size="sm" c="dimmed">
                Unmatched Payments
              </Text>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center">
              <Text size="xl" fw={700} c="orange">
                ₦{(dashboardData.totalUnmatchedAmount ?? 0).toLocaleString()}
              </Text>
              <Text size="sm" c="dimmed">
                Unmatched Amount
              </Text>
            </Stack>
          </Card>

          <Card shadow="sm" padding="lg" withBorder>
            <Stack align="center">
              <Text size="xl" fw={700} c="red">
                {dashboardData.pendingProofs ?? 0}
              </Text>
              <Text size="sm" c="dimmed">
                Pending Verifications
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      )}

      {/* Quick Actions */}
      <Title order={3} mb="md">
        Quick Actions
      </Title>
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md" mb="xl">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            shadow="sm"
            padding="lg"
            withBorder
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(action.route)}
          >
            <Stack align="center" gap="sm">
              <div style={{ color: `var(--mantine-color-${action.color}-6)` }}>
                {action.icon}
              </div>
              <Text fw={600} ta="center">
                {action.title}
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                {action.description}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {/* Recent Unmatched Entries */}
      {dashboardData?.recentUnmatched && dashboardData.recentUnmatched.length > 0 && (
        <>
          <Group justify="space-between" mb="md">
            <Title order={3}>
              Recent Unmatched Entries
            </Title>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => router.push('/dashboard/payments/nigerian/statement-entries')}
            >
              View All
            </Button>
          </Group>

          <Card shadow="sm" padding="0" withBorder>
            {dashboardData.recentUnmatched.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="p-4 border-b border-gray-200 last:border-b-0"
              >
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>{entry.description}</Text>
                    <Text size="sm" c="dimmed">
                      {new Date(entry.date).toLocaleDateString()}
                    </Text>
                  </div>
                  <Group gap="sm">
                    <Text fw={700} c="orange">
                      ₦{entry.amount.toLocaleString()}
                    </Text>
                    <Badge
                      color={
                        entry.matchStatus === 'UNMATCHED' ? 'red' :
                        entry.matchStatus === 'AUTO_MATCHED' ? 'green' :
                        'blue'
                      }
                    >
                      {entry.matchStatus}
                    </Badge>
                  </Group>
                </Group>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
