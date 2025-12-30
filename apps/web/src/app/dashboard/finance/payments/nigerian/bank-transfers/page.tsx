'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  LoadingOverlay,
  Pagination,
  Menu,
  Paper,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEye,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconDotsVertical,
  IconFilter,
  IconSearch,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  getBankTransfers,
  createBankTransfer,
  verifyBankTransfer,
  getBankAccounts,
  getNigerianBanks,
  BankTransfer,
} from '@/lib/api/nigerian-payments';

export default function BankTransfersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<BankTransfer | null>(null);

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['bank-transfers', page, statusFilter, searchQuery],
    queryFn: () =>
      getBankTransfers({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      }),
  });

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts-active'],
    queryFn: () => getBankAccounts(true),
  });

  const { data: banksData } = useQuery({
    queryKey: ['nigerian-banks'],
    queryFn: getNigerianBanks,
  });

  const transfers = transfersData?.data?.transfers || [];
  const pagination = transfersData?.data?.pagination;
  const bankAccounts = bankAccountsData?.data?.accounts || [];
  const banks = banksData?.data?.banks || [];

  const form = useForm({
    initialValues: {
      bankAccountId: '',
      senderBankName: '',
      senderAccountNumber: '',
      senderAccountName: '',
      amount: 0,
      reference: '',
      transferDate: new Date(),
      narration: '',
      notes: '',
    },
    validate: {
      senderBankName: (value) => (!value ? 'Sender bank is required' : null),
      amount: (value) => (value <= 0 ? 'Amount must be positive' : null),
      reference: (value) => (!value ? 'Reference is required' : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: createBankTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transfers'] });
      notifications.show({
        title: 'Success',
        message: 'Bank transfer recorded successfully',
        color: 'green',
      });
      setCreateModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to record bank transfer',
        color: 'red',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'VERIFIED' | 'REJECTED'; notes?: string } }) =>
      verifyBankTransfer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transfers'] });
      notifications.show({
        title: 'Success',
        message: 'Bank transfer verified successfully',
        color: 'green',
      });
      setVerifyModalOpen(false);
      setSelectedTransfer(null);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to verify bank transfer',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    createMutation.mutate({
      bankAccountId: values.bankAccountId ? parseInt(values.bankAccountId) : undefined,
      senderBankName: values.senderBankName,
      senderAccountNumber: values.senderAccountNumber || undefined,
      senderAccountName: values.senderAccountName || undefined,
      amount: values.amount,
      reference: values.reference,
      transferDate: values.transferDate.toISOString(),
      narration: values.narration || undefined,
      notes: values.notes || undefined,
    });
  };

  const handleVerify = (status: 'VERIFIED' | 'REJECTED') => {
    if (selectedTransfer) {
      verifyMutation.mutate({
        id: selectedTransfer.id,
        data: { status },
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'yellow';
      case 'VERIFIED':
        return 'green';
      case 'MATCHED':
        return 'blue';
      case 'REJECTED':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            component={Link}
            href="/dashboard/finance/payments/nigerian"
          >
            Back
          </Button>
          <div>
            <Title order={2}>Bank Transfers</Title>
            <Text c="dimmed">Track and verify bank transfers</Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          Record Transfer
        </Button>
      </Group>

      {/* Filters */}
      <Paper p="md" radius="md" withBorder>
        <Group>
          <TextInput
            placeholder="Search by reference..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by status"
            leftSection={<IconFilter size={16} />}
            data={[
              { value: '', label: 'All Statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'VERIFIED', label: 'Verified' },
              { value: 'MATCHED', label: 'Matched' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
          />
        </Group>
      </Paper>

      <Card padding="lg" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        {transfers.length > 0 ? (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Sender</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {transfers.map((transfer: BankTransfer) => (
                  <Table.Tr key={transfer.id}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {transfer.reference}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {transfer.senderAccountName || 'Unknown'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {transfer.senderBankName}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {formatCurrency(transfer.amount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(transfer.transferDate).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(transfer.status)}>{transfer.status}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEye size={14} />}
                            onClick={() => {
                              setSelectedTransfer(transfer);
                              setViewModalOpen(true);
                            }}
                          >
                            View Details
                          </Menu.Item>
                          {transfer.status === 'PENDING' && (
                            <Menu.Item
                              leftSection={<IconCheck size={14} />}
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setVerifyModalOpen(true);
                              }}
                            >
                              Verify
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {pagination && pagination.totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={pagination.totalPages}
                />
              </Group>
            )}
          </>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No bank transfers found.
          </Text>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Bank Transfer"
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Select
              label="Receiving Bank Account"
              placeholder="Select receiving account"
              data={bankAccounts.map((a: any) => ({
                value: String(a.id),
                label: `${a.bankName} - ${a.accountNumber}`,
              }))}
              {...form.getInputProps('bankAccountId')}
            />
            <Select
              label="Sender Bank"
              placeholder="Select sender's bank"
              data={banks.map((b) => b.name)}
              searchable
              {...form.getInputProps('senderBankName')}
              required
            />
            <Group grow>
              <TextInput
                label="Sender Account Number"
                placeholder="Enter account number"
                {...form.getInputProps('senderAccountNumber')}
              />
              <TextInput
                label="Sender Account Name"
                placeholder="Enter account name"
                {...form.getInputProps('senderAccountName')}
              />
            </Group>
            <Group grow>
              <NumberInput
                label="Amount"
                placeholder="Enter amount"
                prefix="₦"
                thousandSeparator=","
                min={0}
                {...form.getInputProps('amount')}
                required
              />
              <DatePickerInput
                label="Transfer Date"
                placeholder="Select date"
                {...form.getInputProps('transferDate')}
                required
              />
            </Group>
            <TextInput
              label="Reference Number"
              placeholder="Enter bank reference"
              {...form.getInputProps('reference')}
              required
            />
            <Textarea
              label="Narration"
              placeholder="Transfer narration/description"
              {...form.getInputProps('narration')}
            />
            <Textarea
              label="Notes"
              placeholder="Additional notes"
              {...form.getInputProps('notes')}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Record Transfer
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Transfer Details"
        size="md"
      >
        {selectedTransfer && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Reference</Text>
              <Text size="sm" fw={500} ff="monospace">{selectedTransfer.reference}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Amount</Text>
              <Text size="sm" fw={500}>{formatCurrency(selectedTransfer.amount)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Sender Bank</Text>
              <Text size="sm">{selectedTransfer.senderBankName}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Sender Account</Text>
              <Text size="sm">{selectedTransfer.senderAccountNumber || '-'}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Sender Name</Text>
              <Text size="sm">{selectedTransfer.senderAccountName || '-'}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Transfer Date</Text>
              <Text size="sm">{new Date(selectedTransfer.transferDate).toLocaleDateString()}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status</Text>
              <Badge color={getStatusColor(selectedTransfer.status)}>{selectedTransfer.status}</Badge>
            </Group>
            {selectedTransfer.narration && (
              <div>
                <Text size="sm" c="dimmed">Narration</Text>
                <Text size="sm">{selectedTransfer.narration}</Text>
              </div>
            )}
            {selectedTransfer.notes && (
              <div>
                <Text size="sm" c="dimmed">Notes</Text>
                <Text size="sm">{selectedTransfer.notes}</Text>
              </div>
            )}
          </Stack>
        )}
      </Modal>

      {/* Verify Modal */}
      <Modal
        opened={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title="Verify Bank Transfer"
        size="sm"
      >
        {selectedTransfer && (
          <Stack gap="md">
            <Text>
              Verify transfer of <strong>{formatCurrency(selectedTransfer.amount)}</strong> from{' '}
              <strong>{selectedTransfer.senderAccountName || 'Unknown'}</strong>?
            </Text>
            <Text size="sm" c="dimmed">
              Reference: {selectedTransfer.reference}
            </Text>
            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => handleVerify('REJECTED')}
                loading={verifyMutation.isPending}
              >
                Reject
              </Button>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleVerify('VERIFIED')}
                loading={verifyMutation.isPending}
              >
                Verify
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
