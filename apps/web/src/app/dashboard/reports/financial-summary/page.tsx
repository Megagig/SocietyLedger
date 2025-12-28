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
  Switch,
  Title,
  Button,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconChartBar,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconDownload,
} from '@tabler/icons-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportsApi } from '@/lib/api/reports';
import { exportsApi } from '@/lib/api/exports';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

export default function FinancialSummaryPage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_month',
  });
  const [includeComparison, setIncludeComparison] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Export handlers
  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const result = await exportsApi.exportFinancialPDF({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison,
      });

      if (result.success) {
        notifications.show({
          title: 'Export Successful',
          message: 'Your PDF is ready for download',
          color: 'green',
        });
        // Trigger download
        exportsApi.downloadExport(result.data.id);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Export Failed',
        message: error.response?.data?.message || 'Failed to generate PDF',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const result = await exportsApi.exportFinancialExcel({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison,
      });

      if (result.success) {
        notifications.show({
          title: 'Export Successful',
          message: 'Your Excel file is ready for download',
          color: 'green',
        });
        // Trigger download
        exportsApi.downloadExport(result.data.id);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Export Failed',
        message: error.response?.data?.message || 'Failed to generate Excel',
        color: 'red',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['financial-summary', dateRange, includeComparison],
    queryFn: () =>
      reportsApi.getFinancialSummary({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison,
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

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <IconTrendingUp size={16} className="text-green-600" />;
    if (value < 0) return <IconTrendingDown size={16} className="text-red-600" />;
    return <IconMinus size={16} className="text-gray-400" />;
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
          title="Failed to Load Financial Summary"
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

  // Prepare chart data
  const categoryChartData = report.income.byCategory.map((cat: any) => ({
    name: cat.categoryName,
    amount: parseFloat(cat.amount),
  }));

  const comparisonData = report.comparison
    ? [
        {
          name: 'Previous Period',
          income: parseFloat(report.comparison.previousPeriod.income),
          collections: parseFloat(report.comparison.previousPeriod.collections),
        },
        {
          name: 'Current Period',
          income: parseFloat(report.income.total),
          collections: parseFloat(report.collections.collected),
        },
      ]
    : [];

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

        <Group justify="space-between" align="flex-start" mb="xs">
          <div>
            <Title order={2} mb="xs">
              Financial Summary Report
            </Title>
            <Text c="dimmed">{report.period.label}</Text>
          </div>
          
          <Group gap="sm">
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              variant="light"
              color="red"
              onClick={handleExportPDF}
              loading={isExporting}
            >
              Export PDF
            </Button>
            <Button
              leftSection={<IconFileSpreadsheet size={16} />}
              variant="light"
              color="green"
              onClick={handleExportExcel}
              loading={isExporting}
            >
              Export Excel
            </Button>
          </Group>
        </Group>
      </div>

      {/* Filters */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" withBorder>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" withBorder>
            <Switch
              label="Include period comparison"
              checked={includeComparison}
              onChange={(e) => setIncludeComparison(e.currentTarget.checked)}
            />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Key Metrics */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Income
              </Text>
              <Text size="xl" fw={700} c="teal">
                {formatCurrency(report.income.total)}
              </Text>
              {report.comparison && (
                <Group gap="xs">
                  {getTrendIcon(report.comparison.changes.income.percentage)}
                  <Text size="sm" c={report.comparison.changes.income.percentage > 0 ? 'green' : 'red'}>
                    {formatPercentage(report.comparison.changes.income.percentage)}
                  </Text>
                </Group>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Total Expected
              </Text>
              <Text size="xl" fw={700}>
                {formatCurrency(report.collections.expected)}
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
                {formatCurrency(report.collections.collected)}
              </Text>
              {report.comparison && (
                <Group gap="xs">
                  {getTrendIcon(report.comparison.changes.collections.percentage)}
                  <Text size="sm" c={report.comparison.changes.collections.percentage > 0 ? 'green' : 'red'}>
                    {formatPercentage(report.comparison.changes.collections.percentage)}
                  </Text>
                </Group>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <Card withBorder padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Collection Rate
              </Text>
              <Text size="xl" fw={700} c="blue">
                {report.collections.collectionRate.toFixed(1)}%
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Charts */}
      <Grid mb="xl">
        {/* Income by Category - Pie Chart */}
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder padding="lg">
            <Text size="lg" fw={600} mb="md">
              Income by Category
            </Text>
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.amount)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {categoryChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No data available
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Period Comparison - Bar Chart */}
        {report.comparison && comparisonData.length > 0 && (
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card withBorder padding="lg">
              <Text size="lg" fw={600} mb="md">
                Period Comparison
              </Text>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="income" fill="#0088FE" name="Income" />
                  <Bar dataKey="collections" fill="#00C49F" name="Collections" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid.Col>
        )}
      </Grid>

      {/* Category Breakdown Table */}
      <Card withBorder padding="lg">
        <Text size="lg" fw={600} mb="md">
          Category Breakdown
        </Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Category</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
              <Table.Th ta="right">Transactions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {report.income.byCategory.map((cat: any) => (
              <Table.Tr key={cat.categoryId}>
                <Table.Td>{cat.categoryName}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {cat.categoryType}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  {formatCurrency(cat.amount)}
                </Table.Td>
                <Table.Td ta="right">{cat.transactionCount}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  );
}
