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
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI Usage & Statistics
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Monitor your AI usage, costs, and rate limits
        </p>
      </div>

      {/* Free requests and bought credits, kept apart */}
      {rateLimitStatus && (() => {
        const s = rateLimitStatus as any;
        const perDay: number = s.allowancePerDay ?? 0;
        const used: number = s.allowanceUsed ?? 0;
        const left: number = s.allowanceLeft ?? 0;
        const credits: number = s.credits ?? 0;
        return (
          <Paper className="p-3 sm:p-4 mb-4 sm:mb-6 glass-card" withBorder>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <IconRobot size={20} className="text-teal-500" />
                <Text fw={600} size="sm" className="sm:text-base">Your AI requests</Text>
              </div>
              <Badge color={rateLimitStatus.isLimited ? 'red' : 'green'} size="sm">
                {rateLimitStatus.isLimited ? 'None left' : 'Active'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Text size="xs" c="dimmed" mb="xs">Free today, from your plan</Text>
                <Text fw={700} size="xl">{left} <Text span size="sm" c="dimmed" fw={400}>of {perDay} left</Text></Text>
                <Progress value={perDay > 0 ? (used / perDay) * 100 : 100} color={left === 0 ? 'red' : 'teal'} size="lg" mt="xs" />
                <Text size="xs" c="dimmed" mt="xs">Starts again {new Date(rateLimitStatus.resetsAt).toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" mb="xs">Bought credits</Text>
                <Text fw={700} size="xl">{credits.toLocaleString()} <Text span size="sm" c="dimmed" fw={400}>{credits === 1 ? 'credit' : 'credits'}</Text></Text>
                <Text size="xs" c="dimmed" mt="xs">Never expire. Used only after the free requests run out.</Text>
                <a href="/dashboard/ai/credits" className="text-sm text-teal-600 underline">Buy credits</a>
              </div>
            </div>
          </Paper>
        );
      })()}

      {/* Filters */}
      <Paper className="p-3 sm:p-4 mb-4 sm:mb-6 glass-card" withBorder>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3 sm:gap-4">
          <DatePickerInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            className="col-span-1"
            size="sm"
          />
          <DatePickerInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
            className="col-span-1"
            size="sm"
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
            className="col-span-2 sm:col-span-1"
            size="sm"
          />
        </div>
      </Paper>

      {/* Summary Stats */}
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: 'sm', sm: 'md' }} mb="lg">
        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <IconMessage size={20} className="sm:w-6 sm:h-6 text-teal-600" />
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Total Requests</Text>
              <Text size="lg" className="sm:text-xl" fw={700}>{stats?.totalRequests || 0}</Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <IconSparkles size={20} className="sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Total Tokens</Text>
              <Text size="lg" className="sm:text-xl" fw={700}>
                {((stats?.totalTokensInput || 0) + (stats?.totalTokensOutput || 0)).toLocaleString()}
              </Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <IconCoin size={20} className="sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Est. Cost</Text>
              <Text size="lg" className="sm:text-xl" fw={700}>${formatCurrency(stats?.totalCostUsd || 0)}</Text>
            </div>
          </div>
        </Paper>

        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <IconClock size={20} className="sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Avg Tokens</Text>
              <Text size="lg" className="sm:text-xl" fw={700}>
                {stats?.totalRequests 
                  ? Math.round(((stats.totalTokensInput || 0) + (stats.totalTokensOutput || 0)) / stats.totalRequests)
                  : 0}
              </Text>
            </div>
          </div>
        </Paper>
      </SimpleGrid>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Daily Usage Chart */}
        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <Text fw={600} size="sm" className="sm:text-base" mb="md">Usage Over Time</Text>
          <div className="h-48 sm:h-64">
            {stats?.dailyUsage && stats.dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#14b8a6" name="Requests" />
                  <Line yAxisId="right" type="monotone" dataKey="tokens" stroke="#8b5cf6" name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Text c="dimmed" size="sm">No usage data available</Text>
              </div>
            )}
          </div>
        </Paper>

        {/* Requests by Type */}
        <Paper className="p-3 sm:p-4 glass-card" withBorder>
          <Text fw={600} size="sm" className="sm:text-base" mb="md">Requests by Feature</Text>
          <div className="h-48 sm:h-64">
            {getRequestTypeData().length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getRequestTypeData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name.length > 10 ? name.substring(0, 10) + '...' : name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={60}
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
                <Text c="dimmed" size="sm">No request data available</Text>
              </div>
            )}
          </div>
        </Paper>
      </div>

      {/* Model Usage */}
      <Paper className="p-3 sm:p-4 glass-card" withBorder>
        <Text fw={600} size="sm" className="sm:text-base" mb="md">Requests by Model</Text>
        <div className="h-48 sm:h-64">
          {getModelData().length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getModelData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <Text c="dimmed" size="sm">No model data available</Text>
            </div>
          )}
        </div>
      </Paper>

      {/* Token Breakdown */}
      {stats && (
        <Paper className="p-3 sm:p-4 mt-4 sm:mt-6 glass-card" withBorder>
          <Text fw={600} size="sm" className="sm:text-base" mb="md">Token Breakdown</Text>
          <SimpleGrid cols={{ base: 3 }} spacing={{ base: 'sm', sm: 'md' }}>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Input Tokens</Text>
              <Text size="md" className="sm:text-lg" fw={600}>{(stats.totalTokensInput || 0).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Output Tokens</Text>
              <Text size="md" className="sm:text-lg" fw={600}>{(stats.totalTokensOutput || 0).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" className="sm:text-sm" c="dimmed">Total Tokens</Text>
              <Text size="md" className="sm:text-lg" fw={600}>
                {((stats.totalTokensInput || 0) + (stats.totalTokensOutput || 0)).toLocaleString()}
              </Text>
            </div>
          </SimpleGrid>
        </Paper>
      )}
    </div>
  );
}
