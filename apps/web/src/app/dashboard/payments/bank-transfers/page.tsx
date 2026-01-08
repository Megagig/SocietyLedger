'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  TextInput,
  Select,
  LoadingOverlay,
  Pagination,
  ActionIcon,
  Menu,
  Modal,
} from '@mantine/core';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  CheckCircle,
  X,
  MoreVertical,
  AlertCircle,
} from 'lucide-react';
import { DatePickerInput } from '@mantine/dates';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import {
  getBankTransfers,
  verifyBankTransfer,
  type BankTransfer,
} from '@/lib/api/nigerian-payments';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

export default function BankTransfersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [detailsModal, setDetailsModal] = useState<BankTransfer | null>(null);

  useEffect(() => {
    loadTransfers();
  }, [page, statusFilter]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      };

      const response = await getBankTransfers(params);
      setTransfers(response.data?.bankTransfers || []);
      setTotal(response.data?.total || 0);
    } catch (error: any) {
      console.error('Error loading transfers:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load bank transfers',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadTransfers();
  };

  const handleVerify = async (id: number, status: 'VERIFIED' | 'REJECTED') => {
    const message = status === 'VERIFIED' ? 'verify' : 'reject';
    
    modals.openConfirmModal({
      title: `Confirm ${status === 'VERIFIED' ? 'Verification' : 'Rejection'}`,
      children: <Text size="sm">Are you sure you want to {message} this transfer?</Text>,
      labels: { confirm: 'Confirm', cancel: 'Cancel' },
      confirmProps: { color: status === 'REJECTED' ? 'red' : 'green' },
      onConfirm: async () => {
        try {
          await verifyBankTransfer(id, { status });
          notifications.show({
            title: 'Success',
            message: `Transfer ${status.toLowerCase()} successfully`,
            color: 'green',
          });
          loadTransfers();
        } catch (error: any) {
          notifications.show({
            title: 'Error',
            message: error.response?.data?.message || `Failed to ${message} transfer`,
            color: 'red',
          });
        }
      },
    });
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

  const totalPages = Math.ceil(total / 20);

  return (
    <Can permission={PERMISSIONS.PAYMENT_RECORD}>
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Bank Transfers</Title>
            <Text size="sm" c="dimmed">
              Track and verify bank transfers from members
            </Text>
          </div>
          <Button
            leftSection={<Plus size={16} />}
            onClick={() => router.push('/dashboard/payments/bank-transfers/new')}
          >
            Record Transfer
          </Button>
        </Group>

        {/* Filters */}
        <Card withBorder padding="lg">
          <Group gap="md" grow>
            <TextInput
              placeholder="Search by reference, account number..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'VERIFIED', label: 'Verified' },
                { value: 'MATCHED', label: 'Matched' },
                { value: 'REJECTED', label: 'Rejected' },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || '')}
              clearable
            />
            <DatePickerInput
              placeholder="Start date"
              value={startDate}
              onChange={setStartDate}
              clearable
            />
            <DatePickerInput
              placeholder="End date"
              value={endDate}
              onChange={setEndDate}
              clearable
            />
            <Button
              leftSection={<Filter size={16} />}
              onClick={handleSearch}
              variant="light"
            >
              Apply
            </Button>
          </Group>
        </Card>

        {/* Table */}
        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />

          {transfers.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No bank transfers found. Record your first transfer to get started.
            </Text>
          ) : (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Member/Sender</Table.Th>
                    <Table.Th>Bank</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {transfers.map((transfer) => (
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
                        {transfer.member ? (
                          <div>
                            <Text size="sm" fw={500}>
                              {transfer.member.firstName} {transfer.member.lastName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {transfer.member.memberId}
                            </Text>
                          </div>
                        ) : (
                          <Text size="sm">
                            {transfer.senderAccountName || transfer.senderAccountNumber}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{transfer.senderBankName}</Table.Td>
                      <Table.Td>
                        <Text fw={500}>{formatCurrency(transfer.amount)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(transfer.status)} size="sm">
                          {transfer.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle">
                              <MoreVertical size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<Eye size={14} />}
                              onClick={() => setDetailsModal(transfer)}
                            >
                              View Details
                            </Menu.Item>
                            {transfer.status === 'PENDING' && (
                              <>
                                <Can permission="PAYMENT_VERIFY">
                                  <Menu.Item
                                    leftSection={<CheckCircle size={14} />}
                                    color="green"
                                    onClick={() => handleVerify(transfer.id, 'VERIFIED')}
                                  >
                                    Verify
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<X size={14} />}
                                    color="red"
                                    onClick={() => handleVerify(transfer.id, 'REJECTED')}
                                  >
                                    Reject
                                  </Menu.Item>
                                </Can>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {totalPages > 1 && (
                <Group justify="center" mt="lg">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={totalPages}
                  />
                </Group>
              )}
            </>
          )}
        </Card>

        {/* Details Modal */}
        <Modal
          opened={!!detailsModal}
          onClose={() => setDetailsModal(null)}
          title="Transfer Details"
          size="lg"
        >
          {detailsModal && (
            <Stack>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Reference</Text>
                <Text fw={500}>{detailsModal.reference}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Amount</Text>
                <Text fw={700} size="lg">{formatCurrency(detailsModal.amount)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Transfer Date</Text>
                <Text>{new Date(detailsModal.transferDate).toLocaleDateString()}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Bank</Text>
                <Text>{detailsModal.senderBankName}</Text>
              </Group>
              {detailsModal.senderAccountNumber && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Account Number</Text>
                  <Text>{detailsModal.senderAccountNumber}</Text>
                </Group>
              )}
              {detailsModal.senderAccountName && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Account Name</Text>
                  <Text>{detailsModal.senderAccountName}</Text>
                </Group>
              )}
              {detailsModal.narration && (
                <div>
                  <Text size="sm" c="dimmed">Narration</Text>
                  <Text size="sm">{detailsModal.narration}</Text>
                </div>
              )}
              {detailsModal.notes && (
                <div>
                  <Text size="sm" c="dimmed">Notes</Text>
                  <Text size="sm">{detailsModal.notes}</Text>
                </div>
              )}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Status</Text>
                <Badge color={getStatusColor(detailsModal.status)}>
                  {detailsModal.status}
                </Badge>
              </Group>
              {detailsModal.transaction && (
                <div>
                  <Text size="sm" c="dimmed" mb="xs">Matched Transaction</Text>
                  <Card withBorder padding="sm">
                    <Text size="sm" fw={500}>
                      Ref: {detailsModal.transaction.referenceNumber}
                    </Text>
                    <Text size="sm">
                      Amount: {formatCurrency(detailsModal.transaction.amount)}
                    </Text>
                  </Card>
                </div>
              )}
            </Stack>
          )}
        </Modal>
      </Stack>
    </Can>
  );
}
