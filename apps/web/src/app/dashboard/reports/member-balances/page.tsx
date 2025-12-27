'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Text,
  Group,
  Stack,
  Loader,
  Paper,
  Badge,
  Table,
  Title,
  Button,
  TextInput,
  Select,
  Pagination,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconUser,
  IconMail,
  IconPhone,
} from '@tabler/icons-react';
import { reportsApi } from '@/lib/api/reports';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';

export default function MemberBalancesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState<'all' | 'with_balance' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'lastPayment'>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['member-balances', page, debouncedSearch, status, sortBy, sortOrder],
    queryFn: () =>
      reportsApi.getMemberBalances({
        page,
        limit: 50,
        search: debouncedSearch,
        status,
        sortBy,
        sortOrder,
      }),
    retry: false,
  });

  const report = data?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleSort = (field: 'name' | 'balance' | 'lastPayment') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Button
          component={Link}
          href="/dashboard/reports"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          mb="md"
        >
          Back to Reports
        </Button>
        <ErrorDisplay 
          error={error} 
          title="Failed to Load Member Balances"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <Text c="dimmed">No data available</Text>
      </div>
    );
  }

  const totalOutstanding = report.members.reduce(
    (sum: number, m: any) => sum + parseFloat(m.balance),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button
          component={Link}
          href="/dashboard/reports"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          mb="md"
        >
          Back to Reports
        </Button>

        <Title order={2} mb="xs">
          Member Balances Report
        </Title>
        <Text c="dimmed">Outstanding balances by member</Text>
      </div>

      {/* Summary Stats */}
      <Group mb="xl" grow>
        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Total Members
            </Text>
            <Text size="xl" fw={700}>
              {report.pagination.totalCount}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Total Outstanding
            </Text>
            <Text size="xl" fw={700} c="orange">
              {formatCurrency(totalOutstanding)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Members with Overdue
            </Text>
            <Text size="xl" fw={700} c="red">
              {report.members.filter((m: any) => m.overdueTransactions > 0).length}
            </Text>
          </Stack>
        </Card>
      </Group>

      {/* Filters */}
      <Paper p="md" mb="xl" withBorder>
        <Group grow>
          <TextInput
            placeholder="Search by name, email, or member ID"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />

          <Select
            placeholder="Filter by status"
            data={[
              { value: 'all', label: 'All Members' },
              { value: 'with_balance', label: 'With Balance' },
              { value: 'overdue', label: 'Overdue Only' },
            ]}
            value={status}
            onChange={(value) => setStatus(value as any)}
          />
        </Group>
      </Paper>

      {/* Members Table */}
      <Card withBorder padding="lg">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{ cursor: 'pointer' }}
                onClick={() => toggleSort('name')}
              >
                <Group gap="xs">
                  Member
                  <SortIcon field="name" />
                </Group>
              </Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th ta="right">Total Dues</Table.Th>
              <Table.Th ta="right">Paid</Table.Th>
              <Table.Th
                ta="right"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleSort('balance')}
              >
                <Group gap="xs" justify="flex-end">
                  Balance
                  <SortIcon field="balance" />
                </Group>
              </Table.Th>
              <Table.Th ta="center">Status</Table.Th>
              <Table.Th
                ta="right"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleSort('lastPayment')}
              >
                <Group gap="xs" justify="flex-end">
                  Last Payment
                  <SortIcon field="lastPayment" />
                </Group>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.members.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="xl">
                    No members found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              report.members.map((member: any) => (
                <Table.Tr key={member.memberId}>
                  <Table.Td>
                    <div>
                      <Text fw={600}>
                        {member.firstName} {member.lastName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {member.memberNumber}
                      </Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      {member.email && (
                        <Group gap="xs">
                          <IconMail size={14} className="text-gray-400" />
                          <Text size="xs">{member.email}</Text>
                        </Group>
                      )}
                      {member.phone && (
                        <Group gap="xs">
                          <IconPhone size={14} className="text-gray-400" />
                          <Text size="xs">{member.phone}</Text>
                        </Group>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td ta="right">{formatCurrency(member.totalDues)}</Table.Td>
                  <Table.Td ta="right" c="green">
                    {formatCurrency(member.totalPaid)}
                  </Table.Td>
                  <Table.Td ta="right" fw={600} c={parseFloat(member.balance) > 0 ? 'orange' : 'gray'}>
                    {formatCurrency(member.balance)}
                  </Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center">
                      {member.pendingTransactions > 0 && (
                        <Tooltip label={`${member.pendingTransactions} pending`}>
                          <Badge size="sm" color="blue">
                            {member.pendingTransactions}
                          </Badge>
                        </Tooltip>
                      )}
                      {member.overdueTransactions > 0 && (
                        <Tooltip label={`${member.overdueTransactions} overdue`}>
                          <Badge size="sm" color="red">
                            {member.overdueTransactions}
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatDate(member.lastPaymentDate)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        {/* Pagination */}
        {report.pagination.totalPages > 1 && (
          <Group justify="center" mt="xl">
            <Pagination
              total={report.pagination.totalPages}
              value={page}
              onChange={setPage}
            />
          </Group>
        )}
      </Card>
    </div>
  );
}
