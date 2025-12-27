'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import Link from 'next/link';

type AnalyticsData = {
  dailySignups: { date: string; count: number }[];
  dailyRevenue: { date: string; total: number }[];
  subscriptionDistribution: { status: string; count: number }[];
  tierDistribution: { tier: string; count: number }[];
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user, days]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_ROUTES.ADMIN.ANALYTICS}?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Analytics</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Platform Analytics
          </h1>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : data ? (
        <>
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Signups */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Daily Signups
              </h3>
              <div className="h-64">
                <SimpleBarChart data={data.dailySignups} dataKey="count" />
              </div>
            </div>

            {/* Daily Revenue */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Daily Revenue (₦)
              </h3>
              <div className="h-64">
                <SimpleBarChart data={data.dailyRevenue} dataKey="total" color="#10b981" />
              </div>
            </div>

            {/* Subscription Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Subscription Status
              </h3>
              <div className="space-y-4">
                {data.subscriptionDistribution.map((item) => {
                  const total = data.subscriptionDistribution.reduce((sum, i) => sum + i.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={item.status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-300 capitalize">
                          {item.status.toLowerCase().replace('_', ' ')}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.status === 'ACTIVE' ? 'bg-green-500' :
                            item.status === 'TRIALING' ? 'bg-blue-500' :
                            item.status === 'PAST_DUE' ? 'bg-yellow-500' :
                            item.status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tier Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Tier Distribution
              </h3>
              <div className="space-y-4">
                {data.tierDistribution.map((item) => {
                  const total = data.tierDistribution.reduce((sum, i) => sum + i.count, 0);
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={item.tier}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-300 capitalize">
                          {item.tier.toLowerCase()}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {item.count} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.tier === 'ENTERPRISE' ? 'bg-purple-500' :
                            item.tier === 'PROFESSIONAL' ? 'bg-blue-500' : 'bg-gray-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Signups"
              value={data.dailySignups.reduce((sum, d) => sum + d.count, 0)}
              period={`Last ${days} days`}
            />
            <SummaryCard
              label="Total Revenue"
              value={`₦${data.dailyRevenue.reduce((sum, d) => sum + d.total, 0).toLocaleString()}`}
              period={`Last ${days} days`}
            />
            <SummaryCard
              label="Avg Daily Signups"
              value={(data.dailySignups.reduce((sum, d) => sum + d.count, 0) / Math.max(data.dailySignups.length, 1)).toFixed(1)}
              period={`Last ${days} days`}
            />
            <SummaryCard
              label="Avg Daily Revenue"
              value={`₦${(data.dailyRevenue.reduce((sum, d) => sum + d.total, 0) / Math.max(data.dailyRevenue.length, 1)).toLocaleString()}`}
              period={`Last ${days} days`}
            />
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-gray-500">
          No analytics data available
        </div>
      )}
    </div>
  );
}

function SimpleBarChart({ 
  data, 
  dataKey, 
  color = '#3b82f6' 
}: { 
  data: { date: string; [key: string]: any }[]; 
  dataKey: string;
  color?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d[dataKey] || 0), 1);

  return (
    <div className="h-full flex items-end gap-1">
      {data.map((item, index) => {
        const value = item[dataKey] || 0;
        const height = (value / maxValue) * 100;
        const date = new Date(item.date);
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return (
          <div
            key={index}
            className="flex-1 flex flex-col items-center group"
          >
            <div className="relative w-full flex justify-center mb-1">
              <div
                className="w-full max-w-[20px] rounded-t transition-all group-hover:opacity-80"
                style={{ 
                  height: `${Math.max(height, 2)}%`,
                  backgroundColor: color,
                  minHeight: '4px'
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                {typeof value === 'number' && dataKey === 'total' 
                  ? `₦${value.toLocaleString()}` 
                  : value}
              </div>
            </div>
            {index % Math.ceil(data.length / 7) === 0 && (
              <span className="text-xs text-gray-400 mt-1">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value, period }: { label: string; value: string | number; period: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{period}</p>
    </div>
  );
}
