'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Grid, Text, Group, Badge, Stack, Loader, Alert, Button, Paper } from '@mantine/core';
import {
  IconChartBar,
  IconUsers,
  IconClock,
  IconTrendingUp,
  IconFileAnalytics,
  IconAlertCircle,
  IconArrowRight,
  IconLock,
} from '@tabler/icons-react';
import { reportsApi } from '@/lib/api/reports';
import { DateRangePicker, PeriodOption } from '@/components/DateRangePicker';
import { toast } from '@/lib/toast';
import Link from 'next/link';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{
    period: PeriodOption;
    startDate?: Date;
    endDate?: Date;
  }>({
    period: 'this_month',
  });

  // Fetch financial summary for quick stats
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['financial-summary', dateRange],
    queryFn: () =>
      reportsApi.getFinancialSummary({
        period: dateRange.period,
        startDate: dateRange.startDate?.toISOString(),
        endDate: dateRange.endDate?.toISOString(),
        includeComparison: false,
      }),
    retry: false,
  });

  // Fetch aging analysis for quick stats
  const { data: agingData, isLoading: agingLoading, error: agingError } = useQuery({
    queryKey: ['aging-analysis-summary'],
    queryFn: () => reportsApi.getAgingAnalysis({ includeDetails: false }),
    retry: false,
  });

  // Show error toast when API calls fail
  useEffect(() => {
    if (summaryError) {
      toast.apiError(summaryError, 'Failed to load financial summary');
    }
  }, [summaryError]);

  useEffect(() => {
    if (agingError) {
      toast.apiError(agingError, 'Failed to load aging analysis');
    }
  }, [agingError]);

  const summary = summaryData?.data;
  const aging = agingData?.data;

  const formatCurrency = (amount: any) => {
    const num = typeof amount === 'object' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  const reportCards = [
    {
      title: 'Financial Summary',
      description: 'Income, expenses, and collection rates',
      icon: <IconChartBar size={24} />,
      href: '/dashboard/reports/financial-summary',
      color: 'teal',
      stat: summary ? formatCurrency(summary.collections.collected) : null,
      statLabel: 'Collected',
    },
    {
      title: 'Member Balances',
      description: 'Outstanding balances by member',
      icon: <IconUsers size={24} />,
      href: '/dashboard/reports/member-balances',
      color: 'blue',
      stat: summary ? formatCurrency(summary.collections.outstanding) : null,
      statLabel: 'Outstanding',
    },
    {
      title: 'Aging Analysis',
      description: 'Overdue payments by age',
      icon: <IconClock size={24} />,
      href: '/dashboard/reports/aging-analysis',
      color: 'orange',
      stat: aging ? `${aging.summary.totalMembers}` : null,
      statLabel: 'Members with Balance',
    },
    {
      title: 'Collection Rate',
      description: 'Payment collection efficiency',
      icon: <IconTrendingUp size={24} />,
      href: '/dashboard/reports/collection-rate',
      color: 'green',
      stat: summary ? `${summary.collections.collectionRate.toFixed(1)}%` : null,
      statLabel: 'Collection Rate',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Reports & Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate comprehensive financial and member reports
        </p>
      </div>

      {/* Date Range Filter */}
      <Paper p="md" mb="xl" withBorder>
        <div style={{ maxWidth: 300 }}>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </Paper>

      {/* Quick Stats */}
      {summaryLoading || agingLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : summaryError || agingError ? (
        <Alert
          icon={<IconLock size={20} />}
          title="Access Restricted"
          color="orange"
          mb="xl"
        >
          {summaryError?.response?.status === 403 ? (
            <div>
              <Text size="sm" mb="xs">
                You don't have permission to view financial reports. This feature is available to:
              </Text>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Administrators</li>
                <li>Treasurers</li>
                <li>Financial Secretaries</li>
              </ul>
              <Text size="sm" mt="xs" c="dimmed">
                Contact your association administrator to request access.
              </Text>
            </div>
          ) : (
            <Text size="sm">
              Unable to load report data. Please try again later or contact support if the problem persists.
            </Text>
          )}
        </Alert>
      ) : summary ? (
        <Grid mb="xl">
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Total Expected
                </Text>
                <Text size="xl" fw={700}>
                  {formatCurrency(summary.collections.expected)}
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
                <Text size="xl" fw={700} c="teal">
                  {formatCurrency(summary.collections.collected)}
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
                  {formatCurrency(summary.collections.outstanding)}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder padding="lg">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Collection Rate
                </Text>
                <Text size="xl" fw={700} c="green">
                  {summary.collections.collectionRate.toFixed(1)}%
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      ) : null}

      {/* Report Cards */}
      <Grid>
        {reportCards.map((report) => (
          <Grid.Col key={report.title} span={{ base: 12, sm: 6, lg: 6 }}>
            <Card
              withBorder
              padding="lg"
              component={Link}
              href={report.href}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <Group justify="space-between" mb="md">
                <div
                  className={`p-3 rounded-lg bg-${report.color}-50 dark:bg-${report.color}-900/20`}
                >
                  <div className={`text-${report.color}-600 dark:text-${report.color}-400`}>
                    {report.icon}
                  </div>
                </div>
                <IconArrowRight size={20} className="text-gray-400" />
              </Group>

              <Stack gap="xs">
                <Text size="lg" fw={600}>
                  {report.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {report.description}
                </Text>

                {report.stat && (
                  <Group gap="xs" mt="sm">
                    <Text size="xl" fw={700} c={report.color}>
                      {report.stat}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {report.statLabel}
                    </Text>
                  </Group>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {/* Additional Reports Section */}
      <Card withBorder padding="lg" mt="xl">
        <Group justify="space-between" mb="md">
          <div>
            <Text size="lg" fw={600} mb={4}>
              Additional Reports
            </Text>
            <Text size="sm" c="dimmed">
              More detailed analysis and insights
            </Text>
          </div>
        </Group>

        <Stack gap="sm">
          <Button
            component={Link}
            href="/dashboard/reports/by-category"
            variant="light"
            leftSection={<IconFileAnalytics size={16} />}
            fullWidth
            justify="space-between"
            rightSection={<IconArrowRight size={16} />}
          >
            Category-wise Analysis
          </Button>
        </Stack>
      </Card>

      {/* Info Alert */}
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Export Reports"
        color="blue"
        mt="xl"
      >
        Export functionality (PDF/Excel) will be available in Phase 10. For now, you can view all
        reports online and use your browser's print function.
      </Alert>
    </div>
  );
}
