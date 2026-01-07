'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Grid,
  Badge,
  Table,
  Button,
  Group,
  Stack,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import {
  AlertCircle,
  DollarSign,
  CheckCircle,
  Clock,
  Upload,
  FileText,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import {
  getUnmatchedDashboard,
  getBankAccounts,
  getBankTransfers,
  type UnmatchedDashboard,
  type BankAccount,
  type BankTransfer,
} from '@/lib/api/nigerian-payments';

export default function PaymentsDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<UnmatchedDashboard | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<BankTransfer[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load dashboard data
      const [dashboardRes, accountsRes, transfersRes] = await Promise.all([
        getUnmatchedDashboard(),
        getBankAccounts(true),
        getBankTransfers({ limit: 5, page: 1 }),
      ]);

      setDashboard(dashboardRes.data);
      setBankAccounts(accountsRes.data?.bankAccounts || []);
      setRecentTransfers(transfersRes.data?.bankTransfers || []);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
      case 'MATCHED':
        return 'green';
      case 'PENDING':
        return 'yellow';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Can permission="PAYMENT_RECORD" fallback={<Alert color="red">You don't have permission to view payments</Alert>}>
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Payment Management</Title>
            <Text size="sm" c="dimmed">
              Manage bank transfers, reconciliation, and payment verification
            </Text>
          </div>
          <Group>
            <Button
              leftSection={<Upload size={16} />}
              variant="light"
              onClick={() => router.push('/dashboard/payments/import')}
            >
              Import Statement
            </Button>
            <Button
              leftSection={<CreditCard size={16} />}
              onClick={() => router.push('/dashboard/payments/bank-transfers/new')}
            >
              Record Transfer
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <LoadingOverlay visible={loading} />

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Verification
                </Text>
                <Clock size={20} color="orange" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.pendingBankTransfers || 0}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Bank transfers awaiting verification
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Unmatched Payments
                </Text>
                <AlertCircle size={20} color="red" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.totalUnmatched || 0}
              </Text>
              <Text size="xs" c="orange" mt="xs">
                {formatCurrency(dashboard?.totalUnmatchedAmount || 0)}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Payment Proofs
                </Text>
                <FileText size={20} color="blue" />
              </Group>
              <Text size="xl" fw={700}>
                {dashboard?.pendingPaymentProofs || 0}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Uploaded proofs pending review
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed" fw={500}>
                  Bank Accounts
                </Text>
                <DollarSign size={20} color="green" />
              </Group>
              <Text size="xl" fw={700}>
                {bankAccounts.length}
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                Active bank accounts
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
                leftSection={<CreditCard size={16} />}
                onClick={() => router.push('/dashboard/payments/bank-accounts')}
              >
                Manage Bank Accounts
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                leftSection={<Upload size={16} />}
                onClick={() => router.push('/dashboard/payments/bank-transfers')}
              >
                View Transfers
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                color="orange"
                leftSection={<AlertCircle size={16} />}
                onClick={() => router.push('/dashboard/payments/reconciliation')}
              >
                Reconcile Payments
              </Button>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="light"
                color="teal"
                leftSection={<CheckCircle size={16} />}
                onClick={() => router.push('/dashboard/payments/verification')}
              >
                Verify Payments
              </Button>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Recent Bank Transfers */}
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md">
            <Title order={4}>Recent Bank Transfers</Title>
            <Button
              variant="subtle"
              size="sm"
              rightSection={<ArrowRight size={16} />}
              onClick={() => router.push('/dashboard/payments/bank-transfers')}
            >
              View All
            </Button>
          </Group>

          {recentTransfers.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No bank transfers yet. Record your first transfer to get started.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Bank</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {recentTransfers.map((transfer) => (
                  <Table.Tr key={transfer.id}>
                    <Table.Td>
                      {new Date(transfer.transferDate).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {transfer.reference}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {transfer.member
                        ? `${transfer.member.firstName} ${transfer.member.lastName}`
                        : transfer.senderAccountName || 'N/A'}
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{formatCurrency(transfer.amount)}</Text>
                    </Table.Td>
                    <Table.Td>{transfer.senderBankName}</Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(transfer.status)} size="sm">
                        {transfer.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        {/* Unmatched Items Alert */}
        {dashboard && dashboard.totalUnmatched > 0 && (
          <Alert icon={<AlertCircle size={16} />} color="orange" title="Action Required">
            <Text size="sm" mb="sm">
              You have {dashboard.totalUnmatched} unmatched payment(s) totaling{' '}
              {formatCurrency(dashboard.totalUnmatchedAmount)}. Review and reconcile these payments.
            </Text>
            <Button
              size="xs"
              variant="light"
              color="orange"
              onClick={() => router.push('/dashboard/payments/reconciliation')}
            >
              Go to Reconciliation
            </Button>
          </Alert>
        )}
      </Stack>
    </Can>
  );
}
