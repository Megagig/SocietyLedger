'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Table,
  Pagination,
  Select,
  TextInput,
  Loader,
  Alert,
  Badge,
  ActionIcon,
  Menu
} from '@mantine/core';
import { 
  IconRefresh, 
  IconSearch, 
  IconFilter,
  IconPlus,
  IconEye,
  IconDotsVertical,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankTransfer } from '@/lib/api/nigerian-payments';
import { useTransferDecision } from '@/components/payments/useTransferDecision';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'VERIFIED': return 'green';
    case 'MATCHED': return 'blue';
    case 'PENDING': return 'yellow';
    case 'REJECTED': return 'red';
    default: return 'gray';
  }
};

export default function BankTransfersList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState<BankTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const pageSize = 10;
  // Verify / Reject: confirmation (or a required reason), the real API call, and a reload afterwards.
  const decision = useTransferDecision(() => loadTransfers());

  useEffect(() => {
    loadTransfers();
  }, [page, statusFilter, searchQuery]);

  const loadTransfers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await nigerianPaymentsApi.getBankTransfers({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      
      // Handle different response structures
      if (Array.isArray(response)) {
        // Response is directly an array
        setTransfers(response);
        setTotal(response.length);
      } else if (response && typeof response === 'object' && 'data' in response) {
        // Response has a data property
        setTransfers(Array.isArray(response.data) ? response.data : []);
        setTotal(response.total || 0);
      } else {
        // Fallback
        setTransfers([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load bank transfers');
      setTransfers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusFilter = (value: string | null) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleView = (id: string) => {
    router.push(`/dashboard/payments/nigerian/transfers/${id}`);
  };

  const totalPages = Math.ceil(total / pageSize);

  const statusOptions = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'VERIFIED', label: 'Verified' },
    { value: 'MATCHED', label: 'Matched' },
    { value: 'REJECTED', label: 'Rejected' },
  ];

  if (loading && (!transfers || transfers.length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Title order={2}>Bank Transfers</Title>
        {decision.element}
        <Button leftSection={<IconPlus size={20} />} onClick={() => router.push('/dashboard/payments/nigerian/transfers/new')}>
          Record Transfer
        </Button>
      </Group>

      {error && (
        <Alert color="red" title="Error" mb="md" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card shadow="sm" padding="md" withBorder mb="md">
        <Group gap="md">
          <TextInput
            placeholder="Search by reference, member name, or account..."
            leftSection={<IconSearch size={18} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by status"
            data={statusOptions}
            value={statusFilter}
            onChange={handleStatusFilter}
            clearable
            w={180}
          />
        </Group>
      </Card>

      {/* Transfers Table */}
      {(!transfers || transfers.length === 0) && !loading ? (
        <Card shadow="sm" padding="xl" withBorder>
          <Stack align="center" gap="md">
            <Text c="dimmed" ta="center">
              No bank transfers found. Record your first bank transfer to get started.
            </Text>
            <Button onClick={() => router.push('/dashboard/payments/nigerian/transfers/new')} variant="light">
              Record Transfer
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Card shadow="sm" padding="0" withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Reference</Table.Th>
                  <Table.Th>Sender Bank</Table.Th>
                  <Table.Th>Sender Account</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Transfer Date</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {transfers && transfers.map((transfer) => (
                  <Table.Tr key={transfer.id}>
                    <Table.Td className="font-mono">{transfer.reference}</Table.Td>
                    <Table.Td>{transfer.senderBankName}</Table.Td>
                    <Table.Td className="font-mono">{transfer.senderAccountNumber}</Table.Td>
                    <Table.Td fw={700} c="green">₦{transfer.amount.toLocaleString()}</Table.Td>
                    <Table.Td>{new Date(transfer.transferDate).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      {transfer.member ? (
                        <Text size="sm">
                          {transfer.member.firstName} {transfer.member.lastName}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(transfer.status)}>
                        {transfer.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEye size={14} />} onClick={() => handleView(transfer.id)}>
                            View Details
                          </Menu.Item>
                          {transfer.status === 'PENDING' && (
                            <Can permission={PERMISSIONS.PAYMENT_CONFIRM}>
                              <Menu.Item leftSection={<IconCheck size={14} />} color="green" onClick={() => decision.start(transfer, 'VERIFIED')}>
                                Verify
                              </Menu.Item>
                              <Menu.Item leftSection={<IconX size={14} />} color="red" onClick={() => decision.start(transfer, 'REJECTED')}>
                                Reject
                              </Menu.Item>
                            </Can>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              mt="md"
            />
          )}
        </>
      )}
    </div>
  );
}
