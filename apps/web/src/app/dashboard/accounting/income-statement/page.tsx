'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Text,
  Group,
  Stack,
  Loader,
  Alert,
  Paper,
  Table,
  Divider,
  Badge,
  Switch,
  Button,
} from '@mantine/core';
import { IconChartBar, IconTrendingUp, IconTrendingDown, IconArrowUp, IconArrowDown, IconRefresh } from '@tabler/icons-react';
import { accountingApi, IncomeStatement, AccountBalance } from '@/lib/api/accounting';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { toast } from '@/lib/toast';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

const COLORS = ['#12b886', '#228be6', '#7950f2', '#fa5252', '#fab005', '#20c997'];

export default function IncomeStatementPage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_year',
  });
  const [includeComparison, setIncludeComparison] = useState(true);

  const { data: reportData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['income-statement', dateRange, includeComparison],
    queryFn: () =>
      accountingApi.getIncomeStatement({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison,
      }),
    retry: false,
  });

  const handleGenerateReport = async () => {
    try {
      await refetch();
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report');
    }
  };

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load income statement');
    }
  }, [error]);

  const report: IncomeStatement | undefined = reportData?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Income Statement (P&L)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View profit and loss statement for any period
          </p>
        </div>
        <Alert icon={<IconChartBar size={20} />} title="Unable to Load Report" color="red">
          <Text size="sm">
            Failed to load the income statement. Please ensure the chart of accounts is initialized.
          </Text>
        </Alert>
      </div>
    );
  }

  const revenueChartData = report?.revenue.accounts.map((acc, index) => ({
    name: acc.accountName,
    value: parseFloat(String(acc.balance)),
    color: COLORS[index % COLORS.length],
  })) || [];

  const expenseChartData = report?.expenses.accounts.map((acc, index) => ({
    name: acc.accountName,
    value: parseFloat(String(acc.balance)),
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Income Statement (P&L)
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View profit and loss statement for any period
        </p>
      </div>

      {/* Date Range Filter */}
      <Paper p="md" mb="xl" withBorder>
        <Group justify="space-between" align="flex-end">
          <Group align="flex-end">
            <div style={{ maxWidth: 300 }}>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            <Switch
              label="Include Comparison"
              description="Compare with previous period"
              checked={includeComparison}
              onChange={(event) => setIncludeComparison(event.currentTarget.checked)}
            />
          </Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleGenerateReport}
            loading={isFetching}
          >
            Generate Report
          </Button>
        </Group>
      </Paper>

      {!report && !isLoading && !error && (
        <Alert icon={<IconChartBar size={20} />} title="No Report Data" color="blue" mb="xl">
          <Text size="sm">
            No financial data available for the selected period. This could be because:
          </Text>
          <ul className="list-disc ml-4 mt-2 text-sm">
            <li>The chart of accounts has not been initialized yet</li>
            <li>There are no posted journal entries for this period</li>
          </ul>
          <Text size="sm" mt="sm">
            Go to Chart of Accounts and click "Initialize" to set up your accounts, then create and post journal entries.
          </Text>
        </Alert>
      )}

      {report && (
        <>
          {/* Period Info */}
          <Card withBorder padding="md" mb="xl">
            <Text size="lg" fw={600}>
              {report.period.label}
            </Text>
            <Text size="sm" c="dimmed">
              {new Date(report.period.startDate).toLocaleDateString()} - {new Date(report.period.endDate).toLocaleDateString()}
            </Text>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Revenue</Text>
                <IconTrendingUp size={20} className="text-green-500" />
              </Group>
              <Text size="xl" fw={700} c="green">
                {formatCurrency(report.revenue.total)}
              </Text>
              {report.comparison && (
                <Group gap="xs" mt="xs">
                  {report.comparison.changes.revenue.percentage >= 0 ? (
                    <IconArrowUp size={14} className="text-green-500" />
                  ) : (
                    <IconArrowDown size={14} className="text-red-500" />
                  )}
                  <Text size="xs" c={report.comparison.changes.revenue.percentage >= 0 ? 'green' : 'red'}>
                    {formatPercentage(report.comparison.changes.revenue.percentage)} vs previous period
                  </Text>
                </Group>
              )}
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Total Expenses</Text>
                <IconTrendingDown size={20} className="text-red-500" />
              </Group>
              <Text size="xl" fw={700} c="red">
                {formatCurrency(report.expenses.total)}
              </Text>
              {report.comparison && (
                <Group gap="xs" mt="xs">
                  {report.comparison.changes.expenses.percentage <= 0 ? (
                    <IconArrowDown size={14} className="text-green-500" />
                  ) : (
                    <IconArrowUp size={14} className="text-red-500" />
                  )}
                  <Text size="xs" c={report.comparison.changes.expenses.percentage <= 0 ? 'green' : 'red'}>
                    {formatPercentage(report.comparison.changes.expenses.percentage)} vs previous period
                  </Text>
                </Group>
              )}
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Net Income</Text>
                <IconChartBar size={20} className={parseFloat(String(report.netIncome)) >= 0 ? 'text-green-500' : 'text-red-500'} />
              </Group>
              <Text size="xl" fw={700} c={parseFloat(String(report.netIncome)) >= 0 ? 'green' : 'red'}>
                {formatCurrency(report.netIncome)}
              </Text>
              {report.comparison && (
                <Group gap="xs" mt="xs">
                  {report.comparison.changes.netIncome.percentage >= 0 ? (
                    <IconArrowUp size={14} className="text-green-500" />
                  ) : (
                    <IconArrowDown size={14} className="text-red-500" />
                  )}
                  <Text size="xs" c={report.comparison.changes.netIncome.percentage >= 0 ? 'green' : 'red'}>
                    {formatPercentage(report.comparison.changes.netIncome.percentage)} vs previous period
                  </Text>
                </Group>
              )}
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card withBorder padding="lg">
              <Text size="lg" fw={600} mb="md">Revenue Breakdown</Text>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={revenueChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {revenueChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-500">
                  No revenue data
                </div>
              )}
            </Card>

            <Card withBorder padding="lg">
              <Text size="lg" fw={600} mb="md">Expense Breakdown</Text>
              {expenseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expenseChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-gray-500">
                  No expense data
                </div>
              )}
            </Card>
          </div>

          {/* Detailed Statement */}
          <Card withBorder padding="lg">
            <Text size="lg" fw={600} mb="md">Detailed Income Statement</Text>
            
            <Table>
              <Table.Tbody>
                {/* Revenue Section */}
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text fw={700} size="lg" c="green">REVENUE</Text>
                  </Table.Td>
                </Table.Tr>
                {report.revenue.accounts.map((account) => (
                  <Table.Tr key={account.accountId}>
                    <Table.Td pl="xl">
                      <Text>{account.accountCode} - {account.accountName}</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text>{formatCurrency(account.balance)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td pl="xl">
                    <Text fw={600}>Total Revenue</Text>
                  </Table.Td>
                  <Table.Td align="right">
                    <Text fw={600} c="green">{formatCurrency(report.revenue.total)}</Text>
                  </Table.Td>
                </Table.Tr>

                {/* Divider */}
                <Table.Tr>
                  <Table.Td colSpan={2}><Divider my="sm" /></Table.Td>
                </Table.Tr>

                {/* Expenses Section */}
                <Table.Tr>
                  <Table.Td colSpan={2}>
                    <Text fw={700} size="lg" c="red">EXPENSES</Text>
                  </Table.Td>
                </Table.Tr>
                {report.expenses.accounts.map((account) => (
                  <Table.Tr key={account.accountId}>
                    <Table.Td pl="xl">
                      <Text>{account.accountCode} - {account.accountName}</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text>{formatCurrency(account.balance)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td pl="xl">
                    <Text fw={600}>Total Expenses</Text>
                  </Table.Td>
                  <Table.Td align="right">
                    <Text fw={600} c="red">{formatCurrency(report.expenses.total)}</Text>
                  </Table.Td>
                </Table.Tr>

                {/* Divider */}
                <Table.Tr>
                  <Table.Td colSpan={2}><Divider my="sm" /></Table.Td>
                </Table.Tr>

                {/* Net Income */}
                <Table.Tr>
                  <Table.Td>
                    <Text fw={700} size="lg">NET INCOME</Text>
                  </Table.Td>
                  <Table.Td align="right">
                    <Text fw={700} size="lg" c={parseFloat(String(report.netIncome)) >= 0 ? 'green' : 'red'}>
                      {formatCurrency(report.netIncome)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
