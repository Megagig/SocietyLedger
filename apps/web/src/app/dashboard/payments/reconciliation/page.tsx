'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  LoadingOverlay,
  Alert,
  Modal,
  Select,
  Textarea,
  Tabs,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  AlertCircle,
  CheckCircle,
  PlayCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getUnmatchedDashboard,
  getBankTransfers,
  runAutoMatch,
  applyAutoMatches,
  reconcilePayment,
  type UnmatchedDashboard,
  type BankTransfer,
  type AutoMatchResult,
} from '@/lib/api/nigerian-payments';
import { apiGet } from '@/lib/axios';
import { notifications } from '@mantine/notifications';

interface Transaction {
  id: number;
  referenceNumber: string;
  amount: string;
  category: { name: string };
  member: { firstName: string; lastName: string; memberId: string };
  status: string;
  dueDate: string;
}

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<UnmatchedDashboard | null>(null);
  const [unmatchedTransfers, setUnmatchedTransfers] = useState<BankTransfer[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [autoMatchResult, setAutoMatchResult] = useState<AutoMatchResult | null>(null);
  const [matchModal, setMatchModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<BankTransfer | null>(null);
  const [applying, setApplying] = useState(false);

  const matchForm = useForm({
    initialValues: {
      transactionId: '',
      notes: '',
    },
    validate: {
      transactionId: (value) => (!value ? 'Please select a transaction' : null),
    },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, transfersRes, transactionsRes] = await Promise.all([
        getUnmatchedDashboard(),
        getBankTransfers({ status: 'VERIFIED', limit: 100 }),
        apiGet('/finance/transactions', {
          params: { status: 'PENDING', limit: 100 },
        }),
      ]);

      setDashboard(dashboardRes.data);
      setUnmatchedTransfers(
        transfersRes.data?.bankTransfers?.filter((t: BankTransfer) => !t.transactionId) || []
      );
      setPendingTransactions(transactionsRes.data?.transactions || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load reconciliation data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAutoMatch = async () => {
    try {
      setLoading(true);
      const response = await runAutoMatch();
      setAutoMatchResult(response.data);

      if (response.data.matched > 0) {
        notifications.show({
          title: 'Auto-Match Results',
          message: `Found ${response.data.matched} potential matches. Review and apply.`,
          color: 'blue',
        });
      } else {
        notifications.show({
          title: 'No Matches',
          message: 'No automatic matches found. Try manual matching.',
          color: 'yellow',
        });
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to run auto-match',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMatches = async () => {
    if (!autoMatchResult || autoMatchResult.matches.length === 0) return;

    try {
      setApplying(true);
      await applyAutoMatches(autoMatchResult.matches);
      notifications.show({
        title: 'Success',
        message: `${autoMatchResult.matches.length} matches applied successfully`,
        color: 'green',
      });
      setAutoMatchResult(null);
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to apply matches',
        color: 'red',
      });
    } finally {
      setApplying(false);
    }
  };

  const handleManualMatch = async (values: typeof matchForm.values) => {
    if (!selectedTransfer) return;

    try {
      setApplying(true);
      const transaction = pendingTransactions.find(
        (t) => t.id.toString() === values.transactionId
      );

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await reconcilePayment({
        transactionId: parseInt(values.transactionId),
        bankTransferId: selectedTransfer.id,
        matchType: 'MANUAL',
        matchedAmount: parseFloat(selectedTransfer.amount),
        variance: Math.abs(
          parseFloat(selectedTransfer.amount) - parseFloat(transaction.amount)
        ),
        notes: values.notes,
      });

      notifications.show({
        title: 'Success',
        message: 'Payment matched successfully',
        color: 'green',
      });
      setMatchModal(false);
      setSelectedTransfer(null);
      matchForm.reset();
      loadData();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to match payment',
        color: 'red',
      });
    } finally {
      setApplying(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  };

  const transactionOptions = pendingTransactions.map((transaction) => ({
    value: transaction.id.toString(),
    label: `${transaction.referenceNumber} - ${transaction.member.firstName} ${transaction.member.lastName} - ${formatCurrency(transaction.amount)}`,
  }));

  return (
    <Can permission={PERMISSIONS.PAYMENT_RECORD}>
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Payment Reconciliation</Title>
            <Text size="sm" c="dimmed">
              Match bank transfers with pending transactions
            </Text>
          </div>
          <Button
            leftSection={<PlayCircle size={16} />}
            onClick={handleRunAutoMatch}
            loading={loading}
          >
            Run Auto-Match
          </Button>
        </Group>

        {/* Stats */}
        <Group grow>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Unmatched Transfers</Text>
              <AlertCircle size={20} color="orange" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {unmatchedTransfers.length}
            </Text>
          </Card>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Pending Transactions</Text>
              <AlertCircle size={20} color="blue" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {pendingTransactions.length}
            </Text>
          </Card>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Total Unmatched</Text>
              <AlertCircle size={20} color="red" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {formatCurrency(dashboard?.totalUnmatchedAmount || 0)}
            </Text>
          </Card>
        </Group>

        {/* Auto-Match Results */}
        {autoMatchResult && autoMatchResult.matches.length > 0 && (
          <Alert
            icon={<CheckCircle size={16} />}
            color="green"
            title="Auto-Match Results"
            withCloseButton
            onClose={() => setAutoMatchResult(null)}
          >
            <Text size="sm" mb="sm">
              Found {autoMatchResult.matched} potential matches. Review and apply below.
            </Text>
            <Button size="xs" onClick={handleApplyMatches} loading={applying}>
              Apply All Matches
            </Button>
          </Alert>
        )}

        {/* Tables */}
        <Tabs defaultValue="transfers">
          <Tabs.List>
            <Tabs.Tab value="transfers">
              Unmatched Transfers ({unmatchedTransfers.length})
            </Tabs.Tab>
            <Tabs.Tab value="transactions">
              Pending Transactions ({pendingTransactions.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="transfers" pt="md">
            <Card withBorder padding="lg">
              <LoadingOverlay visible={loading} />

              {unmatchedTransfers.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No unmatched transfers. Great job!
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Sender</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {unmatchedTransfers.map((transfer) => (
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
                          {transfer.senderAccountName || transfer.senderAccountNumber}
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500}>{formatCurrency(transfer.amount)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<LinkIcon size={14} />}
                            onClick={() => {
                              setSelectedTransfer(transfer);
                              setMatchModal(true);
                            }}
                          >
                            Match
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="transactions" pt="md">
            <Card withBorder padding="lg">
              {pendingTransactions.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No pending transactions
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Member</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Due Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pendingTransactions.map((transaction) => (
                      <Table.Tr key={transaction.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {transaction.referenceNumber}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Text size="sm">
                              {transaction.member.firstName} {transaction.member.lastName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {transaction.member.memberId}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>{transaction.category.name}</Table.Td>
                        <Table.Td>
                          <Text fw={500}>{formatCurrency(transaction.amount)}</Text>
                        </Table.Td>
                        <Table.Td>
                          {new Date(transaction.dueDate).toLocaleDateString()}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>

        {/* Manual Match Modal */}
        <Modal
          opened={matchModal}
          onClose={() => {
            setMatchModal(false);
            setSelectedTransfer(null);
            matchForm.reset();
          }}
          title="Match Transfer to Transaction"
          size="lg"
        >
          {selectedTransfer && (
            <form onSubmit={matchForm.onSubmit(handleManualMatch)}>
              <Stack>
                <Alert icon={<AlertCircle size={16} />} color="blue">
                  <Text size="sm" fw={500}>Transfer Details</Text>
                  <Text size="sm">
                    Reference: {selectedTransfer.reference}
                  </Text>
                  <Text size="sm">
                    Amount: {formatCurrency(selectedTransfer.amount)}
                  </Text>
                  <Text size="sm">
                    Date: {new Date(selectedTransfer.transferDate).toLocaleDateString()}
                  </Text>
                </Alert>

                <Select
                  label="Select Transaction"
                  placeholder="Search and select transaction"
                  data={transactionOptions}
                  searchable
                  required
                  {...matchForm.getInputProps('transactionId')}
                />

                <Textarea
                  label="Notes"
                  placeholder="Add any notes about this match"
                  rows={3}
                  {...matchForm.getInputProps('notes')}
                />

                <Group justify="flex-end">
                  <Button
                    variant="light"
                    onClick={() => {
                      setMatchModal(false);
                      setSelectedTransfer(null);
                      matchForm.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={applying}>
                    Match Payment
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </Modal>
      </Stack>
    </Can>
  );
}
