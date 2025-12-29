'use client';

import { useState, useEffect } from 'react';
import { Paper, Text, Badge, Loader, Progress, Select, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconChartBar, IconCoin, IconMessage, IconClock, IconSparkles, IconRobot } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { aiApi, AIUsageStats, RateLimitStatus } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

const COLORS = ['#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

export default function AIUsagePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<string>('day');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsResponse, rateLimitResponse] = await Promise.all([
        aiApi.getUsageStats({
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          groupBy: groupBy as any,
        }),
        aiApi.getRateLimitStatus(),
      ]);
      setStats(statsResponse.data);
      setRateLimitStatus(rateLimitResponse.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to load usage data';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, groupBy]);

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${num.toFixed(4)}`;
  };

  const getRequestTypeData = () => {
    if (!stats?.requestsByType) return [];
    return Object.entries(stats.requestsByType).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
    }));
  };

  const getModelData = () => {
    if (!stats?.requestsByModel) return [];
    return Object.entries(stats.requestsByModel).map(([name, value]) => ({
      name: name.split('/').pop() || name,
      value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader size="lg" className="mx-auto mb-4" />
          <Text>Loading AI usage statistics...</Text>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI Usage & Statistics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor your AI usage, costs, and rate limits
        </p>
      </div>

      {/* Rate Limit Status */}
      {rateLimitStatus && (
        <Paper className="p-4 mb-6 glass-card" withBorder>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconRobot size={20} className="text-teal-500" />
              <Text fw={600}>Daily Rate Limit</Text>
            </div>
            <Badge color={rateLimitStatus.isLimited ? 'red' : 'green'}>
              {rateLimitStatus.isLimited ? 'Limit Reached' : 'Active'}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Text size="sm" c="dimmed" mb="xs">Requests</Text>
              <Progress 
                value={(rateLimitStatus.requestsUsed / (rateLimitStatus.requestsUsed + rateLimitStatus.requestsRemaining)) * 100}
                color={rateLimitStatus.isLimited ? 'red' : 'teal'}
                size="lg"
              />
              <Text size="xs" mt="xs">
                {rateLimitStatus.requestsUsed} / {rateLimitStatus.requestsUsed + rateLimitStatus.requestsRemaining} requests used
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed" mb="xs">Tokens</Text>
              <Progress 
                value={(rateLimitStatus.tokensUsed / (rateLimitStatus.tokensUsed + rateLimitStatus.tokensRemaining)) * 100}
                color="blue"
                size="lg"
              />
              <Text size="xs" mt="xs">
                {rateLimitStatus.tokensUsed.toLocaleString()} / {(rateLimitStatus.tokensUsed + rateLimitStatus.tokensRemaining).toLocaleString()} tokens used
              </Text>
            </div>
          </div>
          <Text size="xs" c="dimmed" mt="sm">
            Resets at {new Date(rateLimitStatus.resetsAt).toLocaleString()}
          </Text>
        </Paper>
      )}

      {/* Filters */}
      <Paper className="p-4 mb-6 glass-card" withBorder>
        <div className="flex flex-wrap items-end gap-4">
          <DatePickerInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            w={150}
          />
          <DatePickerInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
            w={150}
          />
          <Select
            label="Group By"
            value={groupBy}
            onChange={(val) => setGroupBy(val || 'day')}
            data={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
            w={120}
          />
        </div>
      </Paper>

      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="lg">
        <Paper className="p-4 glass-card" withBorder>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <IconMessage size={24} className="text-teal-600" />
            </div>
            <div>
              <Text size="sm" c="dimmed">Total Requests</Text>
              <Text size="xl" fw={700}>{stats?.totalRequests || 0}</Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-4 glass-card" withBorder>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <IconSparkles size={24} className="text-blue-600" />
            </div>
            <div>
              <Text size="sm" c="dimmed">Total Tokens</Text>
              <Text size="xl" fw={700}>
                {((stats?.totalTokensInput || 0) + (stats?.totalTokensOutput || 0)).toLocaleString()}
              </Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-4 glass-card" withBorder>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <IconCoin size={24} className="text-green-600" />
            </div>
            <div>
              <Text size="sm" c="dimmed">Estimated Cost</Text>
              <Text size="xl" fw={700}>{formatCurrency(stats?.totalCostUsd || 0)}</Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-4 glass-card" withBorder>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <IconClock size={24} className="text-purple-600" />
            </div>
            <div>
              <Text size="sm" c="dimmed">Avg Tokens/Request</Text>
              <Text size="xl" fw={700}>
                {stats?.totalRequests 
                  ? Math.round(((stats.totalTokensInput || 0) + (stats.totalTokensOutput || 0)) / stats.totalRequests)
                  : 0}
              </Text>
            </div>
          </div>
        </Paper>
      </SimpleGrid>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Usage Chart */}
        <Paper className="p-4 glass-card" withBorder>
          <Text fw={600} mb="md">Usage Over Time</Text>
          <div className="h-64">
            {stats?.dailyUsage && stats.dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#14b8a6" name="Requests" />
                  <Line yAxisId="right" type="monotone" dataKey="tokens" stroke="#8b5cf6" name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Text c="dimmed">No usage data available</Text>
              </div>
            )}
          </div>
        </Paper>

        {/* Requests by Type */}
        <Paper className="p-4 glass-card" withBorder>
          <Text fw={600} mb="md">Requests by Feature</Text>
          <div className="h-64">
            {getRequestTypeData().length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getRequestTypeData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getRequestTypeData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Text c="dimmed">No request data available</Text>
              </div>
            )}
          </div>
        </Paper>
      </div>

      {/* Model Usage */}
      <Paper className="p-4 glass-card" withBorder>
        <Text fw={600} mb="md">Requests by Model</Text>
        <div className="h-64">
          {getModelData().length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getModelData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <Text c="dimmed">No model data available</Text>
            </div>
          )}
        </div>
      </Paper>

      {/* Token Breakdown */}
      {stats && (
        <Paper className="p-4 mt-6 glass-card" withBorder>
          <Text fw={600} mb="md">Token Breakdown</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <div>
              <Text size="sm" c="dimmed">Input Tokens</Text>
              <Text size="lg" fw={600}>{(stats.totalTokensInput || 0).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Output Tokens</Text>
              <Text size="lg" fw={600}>{(stats.totalTokensOutput || 0).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">Total Tokens</Text>
              <Text size="lg" fw={600}>
                {((stats.totalTokensInput || 0) + (stats.totalTokensOutput || 0)).toLocaleString()}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}
    </div>
  );
}
