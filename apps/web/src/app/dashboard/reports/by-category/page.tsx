'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Grid,
  Text,
  Group,
  Stack,
  Loader,
  Paper,
  Badge,
  Table,
  Title,
  Button,
  Select,
  Accordion,
  Progress,
} from '@mantine/core';
import { IconArrowLeft, IconFileAnalytics } from '@tabler/icons-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { reportsApi } from '@/lib/api/reports';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';

export default function CategoryReportPage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_month',
  });
  const [categoryType, setCategoryType] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['category-report', dateRange, categoryType],
    queryFn: () =>
      reportsApi.getCategoryReport({
        type: categoryType as any,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeTransactions: true,
        transactionLimit: 10,
      }),
    retry: false,
  });

  const reports = data?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => refetch()} />;
  }

  if (!reports) {
    return (
      <div className="text-center py-12">
        <Text c="dimmed">No data available</Text>
      </div>
    );
  }

  // Prepare pie chart data
  const pieChartData = reports.map((cat: any) => ({
    name: cat.categoryName,
    value: parseFloat(cat.statistics.totalExpected),
  }));

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
          Category-wise Analysis
        </Title>
        <Text c="dimmed">Financial breakdown by category</Text>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Paper>
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <Select
            label="Filter by Type"
            placeholder="All categories"
            data={[
              { value: 'due', label: 'Dues' },
              { value: 'levy', label: 'Levies' },
              { value: 'donation', label: 'Donations' },
              { value: 'penalty', label: 'Penalties' },
            ]}
            value={categoryType}
            onChange={setCategoryType}
            clearable
          />
        </Paper>
      </div>

      {/* Overview Chart */}
      {pieChartData.length > 0 && (
        <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
          <Text size="lg" fw={600} mb="md">
            Expected Amount by Category
          </Text>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Category Details */}
      <Accordion variant="separated">
        {reports.map((category: any) => {
          const collectionPercentage =
            parseFloat(category.statistics.totalExpected) > 0
              ? (parseFloat(category.statistics.totalCollected) /
                  parseFloat(category.statistics.totalExpected)) *
                100
              : 0;

          return (
            <Accordion.Item key={category.categoryId} value={category.categoryId.toString()}>
              <Accordion.Control>
                <Group justify="space-between">
                  <Group>
                    <IconFileAnalytics size={20} />
                    <div>
                      <Text fw={600}>{category.categoryName}</Text>
                      <Group gap="xs">
                        <Badge size="sm" variant="light">
                          {category.categoryType}
                        </Badge>
                        <Badge size="sm" color={category.isActive ? 'green' : 'gray'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Group>
                    </div>
                  </Group>
                  <Group gap="xl">
                    <div>
                      <Text size="xs" c="dimmed">
                        Expected
                      </Text>
                      <Text fw={600}>{formatCurrency(category.statistics.totalExpected)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Collected
                      </Text>
                      <Text fw={600} c="green">
                        {formatCurrency(category.statistics.totalCollected)}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Rate
                      </Text>
                      <Badge
                        color={
                          category.statistics.collectionRate >= 80
                            ? 'green'
                            : category.statistics.collectionRate >= 60
                            ? 'yellow'
                            : 'red'
                        }
                      >
                        {category.statistics.collectionRate.toFixed(1)}%
                      </Badge>
                    </div>
                  </Group>
                </Group>
              </Accordion.Control>

              <Accordion.Panel>
                <Stack gap="lg">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Paper p="sm" withBorder className="p-2 sm:p-3">
                      <Text size="xs" c="dimmed" mb={4}>
                        Total Expected
                      </Text>
                      <Text size="md" className="text-sm sm:text-lg" fw={700}>
                        {formatCurrency(category.statistics.totalExpected)}
                      </Text>
                    </Paper>
                    <Paper p="sm" withBorder className="p-2 sm:p-3">
                      <Text size="xs" c="dimmed" mb={4}>
                        Total Collected
                      </Text>
                      <Text size="md" className="text-sm sm:text-lg" fw={700} c="green">
                        {formatCurrency(category.statistics.totalCollected)}
                      </Text>
                    </Paper>
                    <Paper p="sm" withBorder className="p-2 sm:p-3">
                      <Text size="xs" c="dimmed" mb={4}>
                        Outstanding
                      </Text>
                      <Text size="md" className="text-sm sm:text-lg" fw={700} c="orange">
                        {formatCurrency(category.statistics.totalOutstanding)}
                      </Text>
                    </Paper>
                    <Paper p="sm" withBorder className="p-2 sm:p-3">
                      <Text size="xs" c="dimmed" mb={4}>
                        Transactions
                      </Text>
                      <Text size="md" className="text-sm sm:text-lg" fw={700}>
                        {category.statistics.transactionCount}
                      </Text>
                    </Paper>
                  </div>

                  {/* Collection Progress */}
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600}>
                        Collection Progress
                      </Text>
                      <Text size="sm" c="dimmed">
                        {collectionPercentage.toFixed(1)}%
                      </Text>
                    </Group>
                    <Progress
                      value={collectionPercentage}
                      color={
                        collectionPercentage >= 80
                          ? 'green'
                          : collectionPercentage >= 60
                          ? 'yellow'
                          : 'red'
                      }
                      size="lg"
                    />
                  </div>

                  {/* Status Breakdown */}
                  <div>
                    <Text size="sm" fw={600} mb="sm">
                      Transaction Status
                    </Text>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {Object.entries(category.byStatus).map(([status, data]: [string, any]) => (
                        <Paper key={status} p="sm" withBorder className="p-2">
                          <Text size="xs" c="dimmed" tt="capitalize" mb={4}>
                            {status}
                          </Text>
                          <Text size="sm" fw={600}>
                            {data.count}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatCurrency(data.amount)}
                          </Text>
                        </Paper>
                      ))}
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  {category.recentTransactions.length > 0 && (
                    <div>
                      <Text size="sm" fw={600} mb="sm">
                        Recent Transactions
                      </Text>
                      
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-2">
                        {category.recentTransactions.map((txn: any) => (
                          <div key={txn.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <Text size="sm" fw={500}>{txn.memberName}</Text>
                                <Text size="xs" c="dimmed">{txn.referenceNumber}</Text>
                              </div>
                              <Badge
                                size="xs"
                                color={
                                  txn.status === 'paid'
                                    ? 'green'
                                    : txn.status === 'overdue'
                                    ? 'red'
                                    : 'blue'
                                }
                              >
                                {txn.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <Text size="xs" c="dimmed">Amount</Text>
                                <Text size="xs" fw={500}>{formatCurrency(txn.amount)}</Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">Paid</Text>
                                <Text size="xs" c="green">{formatCurrency(txn.paidAmount)}</Text>
                              </div>
                              <div>
                                <Text size="xs" c="dimmed">Balance</Text>
                                <Text size="xs" c="orange">{formatCurrency(txn.balance)}</Text>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table View */}
                      <div className="hidden md:block">
                        <Table striped>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Reference</Table.Th>
                              <Table.Th>Member</Table.Th>
                              <Table.Th ta="right">Amount</Table.Th>
                              <Table.Th ta="right">Paid</Table.Th>
                              <Table.Th ta="right">Balance</Table.Th>
                              <Table.Th>Status</Table.Th>
                              <Table.Th ta="right">Date</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {category.recentTransactions.map((txn: any) => (
                              <Table.Tr key={txn.id}>
                                <Table.Td>
                                  <Text size="sm" fw={500}>
                                    {txn.referenceNumber}
                                  </Text>
                                </Table.Td>
                                <Table.Td>{txn.memberName}</Table.Td>
                                <Table.Td ta="right">{formatCurrency(txn.amount)}</Table.Td>
                                <Table.Td ta="right" c="green">
                                  {formatCurrency(txn.paidAmount)}
                                </Table.Td>
                                <Table.Td ta="right" c="orange">
                                  {formatCurrency(txn.balance)}
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    size="sm"
                                    color={
                                      txn.status === 'paid'
                                        ? 'green'
                                        : txn.status === 'overdue'
                                        ? 'red'
                                        : 'blue'
                                    }
                                  >
                                    {txn.status}
                                  </Badge>
                                </Table.Td>
                                <Table.Td ta="right">
                                  <Text size="sm">{formatDate(txn.createdAt)}</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </div>
                    </div>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </div>
  );
}
