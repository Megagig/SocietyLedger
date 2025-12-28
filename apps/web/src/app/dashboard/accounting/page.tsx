'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Grid,
  Text,
  Group,
  Badge,
  Stack,
  Loader,
  Alert,
  Button,
  Paper,
  Table,
  Progress,
  ThemeIcon,
} from '@mantine/core';
import {
  IconChartBar,
  IconReceipt,
  IconWallet,
  IconCreditCard,
  IconFileAnalytics,
  IconArrowRight,
  IconLock,
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconClipboardCheck,
  IconCalculator,
} from '@tabler/icons-react';
import { accountingApi, AccountingDashboard, JournalEntry } from '@/lib/api/accounting';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function AccountingPage() {
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => accountingApi.getDashboard(),
    retry: false,
  });

  useEffect(() => {
    if (error) {
      toast.apiError(error, 'Failed to load accounting dashboard');
    }
  }, [error]);

  const dashboard: AccountingDashboard | undefined = dashboardData?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'gray',
      PENDING_APPROVAL: 'yellow',
      APPROVED: 'blue',
      REJECTED: 'red',
      POSTED: 'green',
      VOIDED: 'dark',
    };
    return colors[status] || 'gray';
  };

  const reportCards = [
    {
      title: 'Chart of Accounts',
      description: 'Manage account structure',
      icon: <IconReceipt size={24} />,
      href: '/dashboard/accounting/chart-of-accounts',
      color: 'teal',
    },
    {
      title: 'Journal Entries',
      description: 'Record transactions',
      icon: <IconFileAnalytics size={24} />,
      href: '/dashboard/accounting/journal-entries',
      color: 'blue',
    },
    {
      title: 'Income Statement',
      description: 'Profit & Loss report',
      icon: <IconChartBar size={24} />,
      href: '/dashboard/accounting/income-statement',
      color: 'green',
    },
    {
      title: 'Balance Sheet',
      description: 'Financial position',
      icon: <IconWallet size={24} />,
      href: '/dashboard/accounting/balance-sheet',
      color: 'purple',
    },
    {
      title: 'Cash Flow',
      description: 'Cash movements',
      icon: <IconCreditCard size={24} />,
      href: '/dashboard/accounting/cash-flow',
      color: 'orange',
    },
    {
      title: 'Budgets',
      description: 'Budget planning & variance',
      icon: <IconCalculator size={24} />,
      href: '/dashboard/accounting/budgets',
      color: 'pink',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    const isPermissionError = (error as any)?.response?.status === 403;
    
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Accounting
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Full accounting system with double-entry bookkeeping
          </p>
        </div>

        <Alert icon={<IconLock size={20} />} title="Access Restricted" color="orange" mb="xl">
          {isPermissionError ? (
            <div>
              <Text size="sm" mb="xs">
                You don't have permission to view accounting data. This feature is available to:
              </Text>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Administrators</li>
                <li>Treasurers</li>
                <li>Financial Secretaries</li>
              </ul>
            </div>
          ) : (
            <Text size="sm">
              Unable to load accounting data. The chart of accounts may not be initialized yet.
            </Text>
          )}
        </Alert>

        {/* Still show navigation cards */}
        <Grid>
          {reportCards.map((card) => (
            <Grid.Col key={card.title} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card
                withBorder
                padding="lg"
                component={Link}
                href={card.href}
                className="hover:shadow-lg transition-shadow cursor-pointer"
              >
                <Group justify="space-between" mb="md">
                  <ThemeIcon size="xl" radius="md" variant="light" color={card.color}>
                    {card.icon}
                  </ThemeIcon>
                  <IconArrowRight size={20} className="text-gray-400" />
                </Group>
                <Text size="lg" fw={600}>
                  {card.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {card.description}
                </Text>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Accounting
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Full accounting system with double-entry bookkeeping
        </p>
      </div>

      {/* Quick Stats */}
      {dashboard && (
        <Grid mb="xl">
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="blue">
                  <IconWallet size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Assets</Text>
              </Group>
              <Text size="xl" fw={700}>
                {formatCurrency(dashboard.quickStats.totalAssets)}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="red">
                  <IconCreditCard size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Liabilities</Text>
              </Group>
              <Text size="xl" fw={700}>
                {formatCurrency(dashboard.quickStats.totalLiabilities)}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="purple">
                  <IconChartBar size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Total Equity</Text>
              </Group>
              <Text size="xl" fw={700}>
                {formatCurrency(dashboard.quickStats.totalEquity)}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="green">
                  <IconTrendingUp size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Net Income (YTD)</Text>
              </Group>
              <Text size="xl" fw={700} c={parseFloat(String(dashboard.quickStats.netIncome)) >= 0 ? 'green' : 'red'}>
                {formatCurrency(dashboard.quickStats.netIncome)}
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <Card withBorder padding="lg">
              <Group gap="xs" mb="xs">
                <ThemeIcon size="sm" variant="light" color="teal">
                  <IconCash size={14} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">Cash Balance</Text>
              </Group>
              <Text size="xl" fw={700} c="teal">
                {formatCurrency(dashboard.quickStats.cashBalance)}
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Pending Approvals Alert */}
      {dashboard && dashboard.pendingApprovals > 0 && (
        <Alert
          icon={<IconClipboardCheck size={20} />}
          title="Pending Approvals"
          color="yellow"
          mb="xl"
        >
          <Group justify="space-between" align="center">
            <Text size="sm">
              You have {dashboard.pendingApprovals} journal {dashboard.pendingApprovals === 1 ? 'entry' : 'entries'} pending approval.
            </Text>
            <Button
              component={Link}
              href="/dashboard/accounting/journal-entries?status=PENDING_APPROVAL"
              size="xs"
              variant="light"
            >
              Review Now
            </Button>
          </Group>
        </Alert>
      )}

      {/* Budget Status */}
      {dashboard?.budgetStatus && (
        <Card withBorder padding="lg" mb="xl">
          <Group justify="space-between" mb="md">
            <div>
              <Text size="lg" fw={600}>Budget Status</Text>
              <Text size="sm" c="dimmed">Current fiscal year budget utilization</Text>
            </div>
            <Button
              component={Link}
              href="/dashboard/accounting/budgets"
              variant="light"
              size="sm"
            >
              View Details
            </Button>
          </Group>
          
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Progress
                value={dashboard.budgetStatus.percentUsed}
                size="xl"
                color={dashboard.budgetStatus.percentUsed > 90 ? 'red' : dashboard.budgetStatus.percentUsed > 75 ? 'yellow' : 'green'}
                mb="sm"
              />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {formatCurrency(dashboard.budgetStatus.totalSpent)} spent of {formatCurrency(dashboard.budgetStatus.totalBudget)}
                </Text>
                <Text size="sm" fw={500}>
                  {dashboard.budgetStatus.percentUsed.toFixed(1)}% used
                </Text>
              </Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder padding="sm">
                <Text size="sm" c="dimmed">Remaining Budget</Text>
                <Text size="lg" fw={700} c="green">
                  {formatCurrency(dashboard.budgetStatus.remainingBudget)}
                </Text>
              </Card>
            </Grid.Col>
          </Grid>
        </Card>
      )}

      <Grid mb="xl">
        {/* Monthly Trend Chart */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder padding="lg" h="100%">
            <Text size="lg" fw={600} mb="md">Income vs Expenses (Last 6 Months)</Text>
            {dashboard?.monthlyTrend && dashboard.monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboard.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    labelStyle={{ color: '#333' }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#12b886" />
                  <Bar dataKey="expenses" name="Expenses" fill="#fa5252" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No data available yet
              </div>
            )}
          </Card>
        </Grid.Col>

        {/* Recent Journal Entries */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder padding="lg" h="100%">
            <Group justify="space-between" mb="md">
              <Text size="lg" fw={600}>Recent Entries</Text>
              <Button
                component={Link}
                href="/dashboard/accounting/journal-entries"
                variant="subtle"
                size="xs"
                rightSection={<IconArrowRight size={14} />}
              >
                View All
              </Button>
            </Group>
            
            {dashboard?.recentEntries && dashboard.recentEntries.length > 0 ? (
              <Stack gap="sm">
                {dashboard.recentEntries.slice(0, 5).map((entry: JournalEntry) => (
                  <Paper key={entry.id} withBorder p="sm">
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={500}>{entry.entryNumber}</Text>
                      <Badge size="xs" color={getStatusColor(entry.status)}>
                        {entry.status}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {entry.description}
                    </Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      {formatCurrency(entry.totalDebit)}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-500">
                No entries yet
              </div>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Navigation Cards */}
      <Text size="lg" fw={600} mb="md">Accounting Modules</Text>
      <Grid>
        {reportCards.map((card) => (
          <Grid.Col key={card.title} span={{ base: 12, sm: 6, lg: 4 }}>
            <Card
              withBorder
              padding="lg"
              component={Link}
              href={card.href}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <Group justify="space-between" mb="md">
                <ThemeIcon size="xl" radius="md" variant="light" color={card.color}>
                  {card.icon}
                </ThemeIcon>
                <IconArrowRight size={20} className="text-gray-400" />
              </Group>
              <Text size="lg" fw={600}>
                {card.title}
              </Text>
              <Text size="sm" c="dimmed">
                {card.description}
              </Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
    </div>
  );
}
