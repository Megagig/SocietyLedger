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
  ThemeIcon,
  Button,
} from '@mantine/core';
import { IconCreditCard, IconArrowUpRight, IconArrowDownRight, IconCash, IconRefresh } from '@tabler/icons-react';
import { accountingApi, CashFlowStatement, CashFlowItem } from '@/lib/api/accounting';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { toast } from '@/lib/toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function CashFlowPage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_year',
  });

  const { data: reportData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['cash-flow', dateRange],
    queryFn: () =>
      accountingApi.getCashFlowStatement({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
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
      toast.apiError(error, 'Failed to load cash flow statement');
    }
  }, [error]);

  const report: CashFlowStatement | undefined = reportData?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const renderCashFlowSection = (
    title: string,
    inflows: CashFlowItem[],
    outflows: CashFlowItem[],
    netCash: number,
    color: string
  ) => {
    return (
      <Card withBorder padding="lg">
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={600}>{title}</Text>
          <Badge size="lg" color={parseFloat(String(netCash)) >= 0 ? 'green' : 'red'}>
            Net: {formatCurrency(netCash)}
          </Badge>
        </Group>

        <Table>
          <Table.Tbody>
            {/* Inflows */}
            {inflows.length > 0 && (
              <>
                <Table.Tr>
                  <Table.Td>
                    <Group gap="xs">
                      <IconArrowUpRight size={16} className="text-green-500" />
                      <Text fw={500} c="green">Cash Inflows</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td></Table.Td>
                </Table.Tr>
                {inflows.map((item, index) => (
                  <Table.Tr key={`inflow-${index}`}>
                    <Table.Td pl="xl">
                      <Text size="sm">{item.description}</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text size="sm" c="green">{formatCurrency(item.amount)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </>
            )}

            {/* Outflows */}
            {outflows.length > 0 && (
              <>
                <Table.Tr>
                  <Table.Td colSpan={2}><Divider my="xs" /></Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>
                    <Group gap="xs">
                      <IconArrowDownRight size={16} className="text-red-500" />
                      <Text fw={500} c="red">Cash Outflows</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td></Table.Td>
                </Table.Tr>
                {outflows.map((item, index) => (
                  <Table.Tr key={`outflow-${index}`}>
                    <Table.Td pl="xl">
                      <Text size="sm">{item.description}</Text>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text size="sm" c="red">({formatCurrency(item.amount)})</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </>
            )}

            {inflows.length === 0 && outflows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text size="sm" c="dimmed" ta="center">No cash flows in this category</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    );
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
            Cash Flow Statement
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track cash inflows and outflows
          </p>
        </div>
        <Alert icon={<IconCreditCard size={20} />} title="Unable to Load Report" color="red">
          <Text size="sm">
            Failed to load the cash flow statement. Please ensure the chart of accounts is initialized.
          </Text>
        </Alert>
      </div>
    );
  }

  const chartData = report ? [
    {
      name: 'Operating',
      value: parseFloat(String(report.operating.netCash)),
      color: '#12b886',
    },
    {
      name: 'Investing',
      value: parseFloat(String(report.investing.netCash)),
      color: '#228be6',
    },
    {
      name: 'Financing',
      value: parseFloat(String(report.financing.netCash)),
      color: '#7950f2',
    },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Cash Flow Statement
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track cash inflows and outflows
        </p>
      </div>

      {/* Date Range Filter */}
      <Paper p="md" mb="xl" withBorder>
        <Group justify="space-between" align="flex-end">
          <div style={{ maxWidth: 300 }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
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
        <Alert icon={<IconCreditCard size={20} />} title="No Report Data" color="blue" mb="xl">
          <Text size="sm">
            No cash flow data available for the selected period. This could be because:
          </Text>
          <ul className="list-disc ml-4 mt-2 text-sm">
            <li>The chart of accounts has not been initialized yet</li>
            <li>There are no posted journal entries affecting cash accounts</li>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconCash size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Beginning Cash</Text>
              </Group>
              <Text size="xl" fw={700}>
                {formatCurrency(report.beginningCash)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color={parseFloat(String(report.netCashChange)) >= 0 ? 'green' : 'red'}>
                  {parseFloat(String(report.netCashChange)) >= 0 ? (
                    <IconArrowUpRight size={14} />
                  ) : (
                    <IconArrowDownRight size={14} />
                  )}
                </ThemeIcon>
                <Text size="sm" c="dimmed">Net Cash Change</Text>
              </Group>
              <Text size="xl" fw={700} c={parseFloat(String(report.netCashChange)) >= 0 ? 'green' : 'red'}>
                {formatCurrency(report.netCashChange)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="teal">
                  <IconCash size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Ending Cash</Text>
              </Group>
              <Text size="xl" fw={700} c="teal">
                {formatCurrency(report.endingCash)}
              </Text>
            </Card>

            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="grape">
                  <IconCreditCard size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Cash Change %</Text>
              </Group>
              <Text size="xl" fw={700}>
                {parseFloat(String(report.beginningCash)) !== 0
                  ? `${((parseFloat(String(report.netCashChange)) / parseFloat(String(report.beginningCash))) * 100).toFixed(1)}%`
                  : 'N/A'}
              </Text>
            </Card>
          </div>

          {/* Cash Flow Chart */}
          <Card withBorder padding="lg" mb="xl">
            <Text size="lg" fw={600} mb="md">Cash Flow by Activity</Text>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.value >= 0 ? entry.color : '#fa5252'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Detailed Cash Flow Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderCashFlowSection(
              'Operating Activities',
              report.operating.inflows,
              report.operating.outflows,
              parseFloat(String(report.operating.netCash)),
              'green'
            )}

            {renderCashFlowSection(
              'Investing Activities',
              report.investing.inflows,
              report.investing.outflows,
              parseFloat(String(report.investing.netCash)),
              'blue'
            )}

            {renderCashFlowSection(
              'Financing Activities',
              report.financing.inflows,
              report.financing.outflows,
              parseFloat(String(report.financing.netCash)),
              'purple'
            )}
          </div>

          {/* Summary */}
          <Card withBorder padding="lg" mt="xl">
            <Text size="lg" fw={600} mb="md">Cash Flow Summary</Text>
            <Table>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td><Text>Beginning Cash Balance</Text></Table.Td>
                  <Table.Td align="right"><Text fw={500}>{formatCurrency(report.beginningCash)}</Text></Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text>Net Cash from Operating Activities</Text></Table.Td>
                  <Table.Td align="right">
                    <Text fw={500} c={parseFloat(String(report.operating.netCash)) >= 0 ? 'green' : 'red'}>
                      {formatCurrency(report.operating.netCash)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text>Net Cash from Investing Activities</Text></Table.Td>
                  <Table.Td align="right">
                    <Text fw={500} c={parseFloat(String(report.investing.netCash)) >= 0 ? 'green' : 'red'}>
                      {formatCurrency(report.investing.netCash)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text>Net Cash from Financing Activities</Text></Table.Td>
                  <Table.Td align="right">
                    <Text fw={500} c={parseFloat(String(report.financing.netCash)) >= 0 ? 'green' : 'red'}>
                      {formatCurrency(report.financing.netCash)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td colSpan={2}><Divider my="xs" /></Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text fw={600}>Net Change in Cash</Text></Table.Td>
                  <Table.Td align="right">
                    <Text fw={700} c={parseFloat(String(report.netCashChange)) >= 0 ? 'green' : 'red'}>
                      {formatCurrency(report.netCashChange)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td><Text fw={700}>Ending Cash Balance</Text></Table.Td>
                  <Table.Td align="right">
                    <Text fw={700} size="lg" c="teal">{formatCurrency(report.endingCash)}</Text>
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
