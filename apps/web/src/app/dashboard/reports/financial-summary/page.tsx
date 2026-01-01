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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Export handlers
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
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
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
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
      setIsExportingExcel(false);
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

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-2">
          <div>
            <Title order={2} mb="xs" className="text-xl sm:text-2xl">
              Financial Summary Report
            </Title>
            <Text c="dimmed">{report.period.label}</Text>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              variant="light"
              color="red"
              onClick={handleExportPDF}
              loading={isExportingPDF}
              className="w-full sm:w-auto"
            >
              Export PDF
            </Button>
            <Button
              leftSection={<IconFileSpreadsheet size={16} />}
              variant="light"
              color="green"
              onClick={handleExportExcel}
              loading={isExportingExcel}
              className="w-full sm:w-auto"
            >
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </Paper>
        <Paper p="md" withBorder className="p-3 sm:p-4">
          <Switch
            label="Include period comparison"
            checked={includeComparison}
            onChange={(e) => setIncludeComparison(e.currentTarget.checked)}
          />
        </Paper>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Income
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="teal">
              {formatCurrency(report.income.total)}
            </Text>
            {report.comparison && (
              <Group gap="xs">
                {getTrendIcon(report.comparison.changes.income.percentage)}
                <Text size="xs" c={report.comparison.changes.income.percentage > 0 ? 'green' : 'red'}>
                  {formatPercentage(report.comparison.changes.income.percentage)}
                </Text>
              </Group>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Expected
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              {formatCurrency(report.collections.expected)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Collected
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="green">
              {formatCurrency(report.collections.collected)}
            </Text>
            {report.comparison && (
              <Group gap="xs">
                {getTrendIcon(report.comparison.changes.collections.percentage)}
                <Text size="xs" c={report.comparison.changes.collections.percentage > 0 ? 'green' : 'red'}>
                  {formatPercentage(report.comparison.changes.collections.percentage)}
                </Text>
              </Group>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Collection Rate
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="blue">
              {report.collections.collectionRate.toFixed(1)}%
            </Text>
          </Stack>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Income by Category - Pie Chart */}
        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Text size="lg" fw={600} mb="md">
            Income by Category
          </Text>
          {categoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No data available
            </Text>
          )}
        </Card>

        {/* Period Comparison - Bar Chart */}
        {report.comparison && comparisonData.length > 0 && (
          <Card withBorder padding="md" className="p-3 sm:p-4">
            <Text size="lg" fw={600} mb="md">
              Period Comparison
            </Text>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="income" fill="#0088FE" name="Income" />
                <Bar dataKey="collections" fill="#00C49F" name="Collections" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Category Breakdown Table */}
      <Card withBorder padding="md" className="p-3 sm:p-4">
        <Text size="lg" fw={600} mb="md">
          Category Breakdown
        </Text>
        
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {report.income.byCategory.map((cat: any) => (
            <div key={cat.categoryId} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <Text fw={500}>{cat.categoryName}</Text>
                  <Badge size="sm" variant="light" mt={4}>
                    {cat.categoryType}
                  </Badge>
                </div>
                <Text fw={600}>{formatCurrency(cat.amount)}</Text>
              </div>
              <Text size="xs" c="dimmed">{cat.transactionCount} transactions</Text>
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
        </div>
      </Card>
    </div>
  );
}
