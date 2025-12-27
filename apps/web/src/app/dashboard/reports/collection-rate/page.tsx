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
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper p="md" withBorder>
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
        </Grid.Col>
      </Grid>

      {/* Overall Stats */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Expected
              </Text>
              <Text size="xl" fw={700}>
                {formatCurrency(report.overall.expected)}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Collected
              </Text>
              <Text size="xl" fw={700} c="green">
                {formatCurrency(report.overall.collected)}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Outstanding
              </Text>
              <Text size="xl" fw={700} c="orange">
                {formatCurrency(report.overall.outstanding)}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Collection Rate
                </Text>
                <IconTrendingUp size={16} className="text-green-600" />
              </Group>
              <Text size="xl" fw={700} c="blue">
                {report.overall.collectionRate.toFixed(1)}%
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Collection Trend Chart */}
      <Card withBorder padding="lg" mb="xl">
        <Text size="lg" fw={600} mb="md">
          Collection Trend Over Time
        </Text>
        {monthlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
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
                name="Collection Rate (%)"
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
      <Card withBorder padding="lg" mb="xl">
        <Text size="lg" fw={600} mb="md">
          Period Breakdown
        </Text>
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
      </Card>

      {/* Category Breakdown */}
      <Card withBorder padding="lg">
        <Text size="lg" fw={600} mb="md">
          Collection Rate by Category
        </Text>
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
      </Card>
    </div>
  );
}
