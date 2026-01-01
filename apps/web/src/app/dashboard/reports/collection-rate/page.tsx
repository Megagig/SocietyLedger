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
} from '@mantine/core';
import { IconArrowLeft, IconTrendingUp } from '@tabler/icons-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { reportsApi } from '@/lib/api/reports';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';

export default function CollectionRatePage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_year',
  });
  const [groupBy, setGroupBy] = useState<'month' | 'quarter' | 'year'>('month');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collection-rate', dateRange, groupBy],
    queryFn: () =>
      reportsApi.getCollectionRate({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        groupBy,
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

  if (!report) {
    return (
      <div className="text-center py-12">
        <Text c="red">No data available</Text>
      </div>
    );
  }

  // Prepare chart data
  const monthlyChartData = report.byMonth.map((item: any) => ({
    name: `${item.month.substring(0, 3)} ${item.year}`,
    expected: parseFloat(item.expected),
    collected: parseFloat(item.collected),
    rate: item.collectionRate,
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
          Collection Rate Report
        </Title>
        <Text c="dimmed">{report.period.label}</Text>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Paper>
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <Select
            label="Group By"
            data={[
              { value: 'month', label: 'Monthly' },
              { value: 'quarter', label: 'Quarterly' },
              { value: 'year', label: 'Yearly' },
            ]}
            value={groupBy}
            onChange={(value) => setGroupBy(value as any)}
          />
        </Paper>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Expected
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              {formatCurrency(report.overall.expected)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Collected
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="green">
              {formatCurrency(report.overall.collected)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Outstanding
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="orange">
              {formatCurrency(report.overall.outstanding)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Group gap="xs">
              <Text size="xs" className="sm:text-sm" c="dimmed">
                Collection Rate
              </Text>
              <IconTrendingUp size={16} className="text-green-600" />
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="blue">
              {report.overall.collectionRate.toFixed(1)}%
            </Text>
          </Stack>
        </Card>
      </div>

      {/* Collection Trend Chart */}
      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <Text size="lg" fw={600} mb="md">
          Collection Trend Over Time
        </Text>
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === 'rate') return `${value.toFixed(1)}%`;
                  return formatCurrency(value);
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="expected"
                stroke="#8884d8"
                name="Expected"
                strokeWidth={2}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="collected"
                stroke="#82ca9d"
                name="Collected"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="rate"
                stroke="#ff7300"
                name="Rate (%)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No data available
          </Text>
        )}
      </Card>

      {/* Monthly Breakdown Table */}
      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <Text size="lg" fw={600} mb="md">
          Period Breakdown
        </Text>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {report.byMonth.map((item: any, index: number) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <Text fw={500}>{item.month} {item.year}</Text>
                <Badge
                  color={
                    item.collectionRate >= 80
                      ? 'green'
                      : item.collectionRate >= 60
                      ? 'yellow'
                      : 'red'
                  }
                  size="sm"
                >
                  {item.collectionRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Text size="xs" c="dimmed">Expected</Text>
                  <Text size="sm">{formatCurrency(item.expected)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Collected</Text>
                  <Text size="sm" c="green" fw={600}>{formatCurrency(item.collected)}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Period</Table.Th>
                <Table.Th ta="right">Expected</Table.Th>
                <Table.Th ta="right">Collected</Table.Th>
                <Table.Th ta="right">Collection Rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.byMonth.map((item: any, index: number) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    {item.month} {item.year}
                  </Table.Td>
                  <Table.Td ta="right">{formatCurrency(item.expected)}</Table.Td>
                  <Table.Td ta="right" c="green" fw={600}>
                    {formatCurrency(item.collected)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Badge
                      color={
                        item.collectionRate >= 80
                          ? 'green'
                          : item.collectionRate >= 60
                          ? 'yellow'
                          : 'red'
                      }
                      size="lg"
                    >
                      {item.collectionRate.toFixed(1)}%
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>

      {/* Category Breakdown */}
      <Card withBorder padding="md" className="p-3 sm:p-4">
        <Text size="lg" fw={600} mb="md">
          Collection Rate by Category
        </Text>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {report.byCategory.map((cat: any) => (
            <div key={cat.categoryId} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Text fw={500}>{cat.categoryName}</Text>
                  <Badge size="xs" variant="light" mt={2}>
                    {cat.categoryType}
                  </Badge>
                </div>
                <Badge
                  color={
                    cat.collectionRate >= 80
                      ? 'green'
                      : cat.collectionRate >= 60
                      ? 'yellow'
                      : 'red'
                  }
                  size="sm"
                >
                  {cat.collectionRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Text size="xs" c="dimmed">Expected</Text>
                  <Text size="sm">{formatCurrency(cat.expected)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Collected</Text>
                  <Text size="sm" c="green" fw={600}>{formatCurrency(cat.collected)}</Text>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th ta="right">Expected</Table.Th>
                <Table.Th ta="right">Collected</Table.Th>
                <Table.Th ta="right">Collection Rate</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.byCategory.map((cat: any) => (
                <Table.Tr key={cat.categoryId}>
                  <Table.Td>{cat.categoryName}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light">
                      {cat.categoryType}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{formatCurrency(cat.expected)}</Table.Td>
                  <Table.Td ta="right" c="green" fw={600}>
                    {formatCurrency(cat.collected)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Badge
                      color={
                        cat.collectionRate >= 80
                          ? 'green'
                          : cat.collectionRate >= 60
                          ? 'yellow'
                          : 'red'
                      }
                      size="lg"
                    >
                      {cat.collectionRate.toFixed(1)}%
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
