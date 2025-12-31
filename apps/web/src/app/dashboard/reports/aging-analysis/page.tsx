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
  Accordion,
  Progress,
} from '@mantine/core';
import { IconArrowLeft, IconClock, IconAlertCircle } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { reportsApi } from '@/lib/api/reports';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import Link from 'next/link';

export default function AgingAnalysisPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['aging-analysis'],
    queryFn: () => reportsApi.getAgingAnalysis({ includeDetails: true }),
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const BUCKET_COLORS = {
    current: '#00C49F',
    days31to60: '#FFBB28',
    days61to90: '#FF8042',
    over90: '#FF4444',
  };

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
          title="Failed to Load Aging Analysis"
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
  const chartData = [
    {
      name: '0-30 days',
      amount: parseFloat(report.buckets.current.amount),
      count: report.buckets.current.count,
      color: BUCKET_COLORS.current,
    },
    {
      name: '31-60 days',
      amount: parseFloat(report.buckets.days31to60.amount),
      count: report.buckets.days31to60.count,
      color: BUCKET_COLORS.days31to60,
    },
    {
      name: '61-90 days',
      amount: parseFloat(report.buckets.days61to90.amount),
      count: report.buckets.days61to90.count,
      color: BUCKET_COLORS.days61to90,
    },
    {
      name: '90+ days',
      amount: parseFloat(report.buckets.over90.amount),
      count: report.buckets.over90.count,
      color: BUCKET_COLORS.over90,
    },
  ];

  const totalAmount = parseFloat(report.summary.totalOutstanding);

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
          Aging Analysis Report
        </Title>
        <Text c="dimmed">As of {formatDate(report.asOfDate)}</Text>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Total Outstanding
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700} c="orange">
              {formatCurrency(report.summary.totalOutstanding)}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Members with Balance
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              {report.summary.totalMembers}
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" className="p-3 sm:p-4">
          <Stack gap="xs">
            <Text size="xs" className="sm:text-sm" c="dimmed">
              Outstanding Transactions
            </Text>
            <Text size="lg" className="text-base sm:text-xl" fw={700}>
              {report.summary.totalTransactions}
            </Text>
          </Stack>
        </Card>
      </div>

      {/* Aging Buckets Chart */}
      <Card withBorder padding="md" mb="xl" className="p-3 sm:p-4">
        <Text size="lg" fw={600} mb="md">
          Outstanding by Age
        </Text>
        <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'amount') return formatCurrency(value);
                return value;
              }}
            />
            <Legend />
            <Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Aging Buckets Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        {Object.entries(report.buckets).map(([key, bucket]: [string, any]) => {
          const percentage = totalAmount > 0 ? (parseFloat(bucket.amount) / totalAmount) * 100 : 0;
          const colorMap: Record<string, string> = {
            current: 'teal',
            days31to60: 'yellow',
            days61to90: 'orange',
            over90: 'red',
          };

          return (
            <Card key={key} withBorder padding="md" className="p-3 sm:p-4">
              <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm">{bucket.range}</Text>
                <Badge color={colorMap[key]} size="sm">
                  {bucket.count} txns
                </Badge>
              </Group>

              <Text size="lg" className="text-base sm:text-xl" fw={700} c={colorMap[key]} mb="xs">
                {formatCurrency(bucket.amount)}
              </Text>

              <Progress value={percentage} color={colorMap[key]} size="sm" mb="xs" />

              <Text size="xs" c="dimmed">
                {percentage.toFixed(1)}% of total outstanding
              </Text>
            </Card>
          );
        })}
      </div>

      {/* Member Details by Bucket */}
      <Card withBorder padding="lg">
        <Text size="lg" fw={600} mb="md">
          Member Details
        </Text>

        <Accordion variant="separated">
          {Object.entries(report.buckets).map(([key, bucket]: [string, any]) => {
            if (bucket.members.length === 0) return null;

            const colorMap: Record<string, string> = {
              current: 'teal',
              days31to60: 'yellow',
              days61to90: 'orange',
              over90: 'red',
            };

            return (
              <Accordion.Item key={key} value={key}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Group>
                      <IconClock size={20} />
                      <Text fw={600}>{bucket.range}</Text>
                    </Group>
                    <Group gap="xl">
                      <Text size="sm" c="dimmed">
                        {bucket.members.length} members
                      </Text>
                      <Text fw={600} c={colorMap[key]}>
                        {formatCurrency(bucket.amount)}
                      </Text>
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Member</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                        <Table.Th ta="right">Days Overdue</Table.Th>
                        <Table.Th ta="right">Oldest Due Date</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {bucket.members.map((member: any) => (
                        <Table.Tr key={member.memberId}>
                          <Table.Td>{member.memberName}</Table.Td>
                          <Table.Td ta="right" fw={600}>
                            {formatCurrency(member.amount)}
                          </Table.Td>
                          <Table.Td ta="right">
                            <Badge color={colorMap[key]} size="sm">
                              {member.daysOverdue} days
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">{formatDate(member.oldestDueDate)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </Card>

      {/* Alert for Critical Items */}
      {parseFloat(report.buckets.over90.amount) > 0 && (
        <Card withBorder padding="lg" mt="xl" style={{ borderColor: '#FF4444' }}>
          <Group>
            <IconAlertCircle size={24} className="text-red-600" />
            <div>
              <Text fw={600} c="red">
                Critical: {report.buckets.over90.count} transactions over 90 days
              </Text>
              <Text size="sm" c="dimmed">
                Total amount: {formatCurrency(report.buckets.over90.amount)} - Immediate action
                recommended
              </Text>
            </div>
          </Group>
        </Card>
      )}
    </div>
  );
}
