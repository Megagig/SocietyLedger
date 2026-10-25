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
import { useRouter } from 'next/navigation';
import { DrillLink } from '@/components/reports/DrillLink';
import { entryHref, ledgerHref, monthRange } from '@/lib/accounting-drill';
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

  const router = useRouter();
  const openMonth = (bar: { payload?: { month?: string } }) => {
    const range = bar?.payload?.month ? monthRange(bar.payload.month) : null;
    if (range) router.push(`/dashboard/accounting/income-statement?period=custom&startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`);
  };

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
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
                You don&apos;t have permission to view accounting data. This feature is available to:
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {reportCards.map((card) => (
            <Card
              key={card.title}
              withBorder
              padding="lg"
              component={Link}
              href={card.href}
              className="hover:shadow-lg transition-shadow cursor-pointer p-4 sm:p-6"
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
          ))}
        </div>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <Card withBorder padding="md" className="p-3 sm:p-4">
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconWallet size={14} />
              </ThemeIcon>
              <Text size="xs" className="text-xs sm:text-sm" c="dimmed">Total Assets</Text>
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              <DrillLink href={ledgerHref({ scope: 'ASSET', title: 'What is owned', ...{ to: new Date().toISOString(), datesLabel: 'Up to now' } })} label="Total assets">{formatCurrency(dashboard.quickStats.totalAssets)}</DrillLink>
            </Text>
          </Card>

          <Card withBorder padding="md" className="p-3 sm:p-4">
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="red">
                <IconCreditCard size={14} />
              </ThemeIcon>
              <Text size="xs" className="text-xs sm:text-sm" c="dimmed">Total Liabilities</Text>
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              <DrillLink href={ledgerHref({ scope: 'LIABILITY', title: 'What is owed', ...{ to: new Date().toISOString(), datesLabel: 'Up to now' } })} label="Total liabilities">{formatCurrency(dashboard.quickStats.totalLiabilities)}</DrillLink>
            </Text>
          </Card>

          <Card withBorder padding="md" className="p-3 sm:p-4">
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="purple">
                <IconChartBar size={14} />
              </ThemeIcon>
              <Text size="xs" className="text-xs sm:text-sm" c="dimmed">Total Equity</Text>
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              <DrillLink href={'/dashboard/accounting/balance-sheet'} label="Total equity">{formatCurrency(dashboard.quickStats.totalEquity)}</DrillLink>
            </Text>
          </Card>

          <Card withBorder padding="md" className="p-3 sm:p-4">
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="green">
                <IconTrendingUp size={14} />
              </ThemeIcon>
              <Text size="xs" className="text-xs sm:text-sm" c="dimmed">Net Income (YTD)</Text>
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c={parseFloat(String(dashboard.quickStats.netIncome)) >= 0 ? 'green' : 'red'}>
              <DrillLink href={'/dashboard/accounting/income-statement'} label="Net income this year">{formatCurrency(dashboard.quickStats.netIncome)}</DrillLink>
            </Text>
          </Card>

          <Card withBorder padding="md" className="col-span-2 md:col-span-1 p-3 sm:p-4">
            <Group gap="xs" mb="xs">
              <ThemeIcon size="sm" variant="light" color="teal">
                <IconCash size={14} />
              </ThemeIcon>
              <Text size="xs" className="text-xs sm:text-sm" c="dimmed">Cash Balance</Text>
            </Group>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="teal">
              <DrillLink href={ledgerHref({ scope: 'cash', title: 'Cash and bank', ...{ to: new Date().toISOString(), datesLabel: 'Up to now' } })} label="Cash balance">{formatCurrency(dashboard.quickStats.cashBalance)}</DrillLink>
            </Text>
          </Card>
        </div>
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
        <Card withBorder padding="md" className="p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div>
              <Text size="lg" fw={600}>Budget Status</Text>
              <Text size="sm" c="dimmed">Current fiscal year budget utilization</Text>
            </div>
            <Button
              component={Link}
              href="/dashboard/accounting/budgets"
              variant="light"
              size="sm"
              className="w-full sm:w-auto"
            >
              View Details
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Progress
                value={dashboard.budgetStatus.percentUsed}
                size="xl"
                color={dashboard.budgetStatus.percentUsed > 90 ? 'red' : dashboard.budgetStatus.percentUsed > 75 ? 'yellow' : 'green'}
                mb="sm"
              />
              <div className="flex justify-between text-sm">
                <Text size="sm" c="dimmed">
                  <DrillLink href={dashboard.budgetStatus.budgetId ? `/dashboard/accounting/budgets?variance=${dashboard.budgetStatus.budgetId}` : undefined} label="Spending against the budget">{formatCurrency(dashboard.budgetStatus.totalSpent)} spent of {formatCurrency(dashboard.budgetStatus.totalBudget)}</DrillLink>
                </Text>
                <Text size="sm" fw={500}>
                  {dashboard.budgetStatus.percentUsed.toFixed(1)}% used
                </Text>
              </div>
            </div>
            <Card withBorder padding="sm">
              <Text size="sm" c="dimmed">Remaining Budget</Text>
              <Text size="lg" fw={700} c="green">
                {formatCurrency(dashboard.budgetStatus.remainingBudget)}
              </Text>
            </Card>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        {/* Monthly Trend Chart */}
        <Card withBorder padding="md" className="lg:col-span-2 p-4 sm:p-6">
          <Text size="lg" fw={600} mb="md">Income vs Expenses (Last 6 Months)</Text>
          {dashboard?.monthlyTrend && dashboard.monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={dashboard.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  labelStyle={{ color: '#333' }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#12b886" cursor="pointer" onClick={openMonth} />
                <Bar dataKey="expenses" name="Expenses" fill="#fa5252" cursor="pointer" onClick={openMonth} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] sm:h-[300px] text-gray-500">
              No data available yet
            </div>
          )}
        </Card>

        {/* Recent Journal Entries */}
        <Card withBorder padding="md" className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
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
          </div>
          
          {dashboard?.recentEntries && dashboard.recentEntries.length > 0 ? (
            <Stack gap="sm">
              {dashboard.recentEntries.slice(0, 5).map((entry: JournalEntry) => (
                <Paper key={entry.id} withBorder p="sm">
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={500}><DrillLink href={entryHref(entry.id)} label={entry.entryNumber}>{entry.entryNumber}</DrillLink></Text>
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
      </div>

      {/* Navigation Cards */}
      <Text size="lg" fw={600} mb="md">Accounting Modules</Text>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {reportCards.map((card) => (
          <Card
            key={card.title}
            withBorder
            padding="lg"
            component={Link}
            href={card.href}
            className="hover:shadow-lg transition-shadow cursor-pointer p-4 sm:p-6"
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
        ))}
      </div>
    </div>
  );
}
