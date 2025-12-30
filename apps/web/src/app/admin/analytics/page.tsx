'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { API_ROUTES } from '@/utils/constants';
import { toast } from '@/lib/toast';
import Link from 'next/link';

type AnalyticsOverview = {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
    trialing: number;
    newThisMonth: number;
    newLastMonth: number;
    growthRate: number;
  };
  subscriptions: Record<string, number>;
  tiers: Record<string, number>;
  revenue: {
    thisMonth: number;
    lastMonth: number;
    total: number;
    growthRate: number;
    mrr: number;
    arr: number;
  };
  users: { total: number; activeIn30Days: number };
  members: { total: number };
};

type ModuleAdoption = {
  totalAssociations: number;
  modules: {
    code: string;
    name: string;
    isCore: boolean;
    enabledCount: number;
    adoptionRate: number;
    plans: string[];
  }[];
};

type ChurnData = {
  months: {
    month: string;
    cancelled: number;
    suspended: number;
    newSignups: number;
    churnRate: number;
  }[];
  averageChurnRate: string;
};

type RevenueData = {
  months: { month: string; revenue: number; transactions: number }[];
  totalRevenue: number;
  averageMonthlyRevenue: string;
};

export default function PlatformAnalyticsPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [moduleAdoption, setModuleAdoption] = useState<ModuleAdoption | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'churn' | 'revenue'>('overview');

  useEffect(() => {
    if (user?.platformRole !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [token, user]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overviewRes, modulesRes, churnRes, revenueRes] = await Promise.all([
        fetch(API_ROUTES.PLATFORM_ADMIN.ANALYTICS_OVERVIEW, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(API_ROUTES.PLATFORM_ADMIN.ANALYTICS_MODULE_ADOPTION, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(`${API_ROUTES.PLATFORM_ADMIN.ANALYTICS_CHURN}?months=6`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
        fetch(`${API_ROUTES.PLATFORM_ADMIN.ANALYTICS_REVENUE}?months=12`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        }),
      ]);

      const [overviewData, modulesData, churnDataRes, revenueDataRes] = await Promise.all([
        overviewRes.json(),
        modulesRes.json(),
        churnRes.json(),
        revenueRes.json(),
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (modulesData.success) setModuleAdoption(modulesData.data);
      if (churnDataRes.success) setChurnData(churnDataRes.data);
      if (revenueDataRes.success) setRevenueData(revenueDataRes.data);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (user?.platformRole !== 'SUPER_ADMIN') return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
          <Link href="/admin" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Platform Analytics</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor platform health, growth, and revenue metrics</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {(['overview', 'modules', 'churn', 'revenue'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize transition ${
                activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              {tab === 'modules' ? 'Module Adoption' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Tenants" value={overview.tenants.total} icon="🏢" />
            <MetricCard label="Active" value={overview.tenants.active} icon="✅" color="green" />
            <MetricCard label="Trialing" value={overview.tenants.trialing} icon="⏳" color="blue" />
            <MetricCard label="Suspended" value={overview.tenants.suspended} icon="⏸️" color="yellow" />
            <MetricCard label="Total Users" value={overview.users.total} icon="👥" />
            <MetricCard label="Total Members" value={overview.members.total} icon="👤" />
          </div>

          {/* Growth & Revenue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
              <p className="text-blue-100 text-sm">New This Month</p>
              <p className="text-3xl font-bold mt-1">{overview.tenants.newThisMonth}</p>
              <p className={`text-sm mt-2 ${overview.tenants.growthRate >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {overview.tenants.growthRate >= 0 ? '↑' : '↓'} {Math.abs(overview.tenants.growthRate)}% vs last month
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
              <p className="text-green-100 text-sm">MRR</p>
              <p className="text-3xl font-bold mt-1">₦{overview.revenue.mrr.toLocaleString()}</p>
              <p className={`text-sm mt-2 ${overview.revenue.growthRate >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {overview.revenue.growthRate >= 0 ? '↑' : '↓'} {Math.abs(overview.revenue.growthRate)}% growth
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
              <p className="text-purple-100 text-sm">ARR</p>
              <p className="text-3xl font-bold mt-1">₦{overview.revenue.arr.toLocaleString()}</p>
              <p className="text-purple-200 text-sm mt-2">Projected annual</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 text-white">
              <p className="text-teal-100 text-sm">Active Users (30d)</p>
              <p className="text-3xl font-bold mt-1">{overview.users.activeIn30Days}</p>
              <p className="text-teal-200 text-sm mt-2">
                {overview.users.total > 0 ? ((overview.users.activeIn30Days / overview.users.total) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>

          {/* Tier & Subscription Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tier Distribution</h3>
              <div className="space-y-3">
                {Object.entries(overview.tiers).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        tier === 'ENTERPRISE' ? 'bg-purple-500' : tier === 'PROFESSIONAL' ? 'bg-blue-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{tier.toLowerCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                      <span className="text-xs text-gray-500">
                        ({overview.tenants.total > 0 ? ((count / overview.tenants.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Subscription Status</h3>
              <div className="space-y-3">
                {Object.entries(overview.subscriptions).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        status === 'ACTIVE' ? 'bg-green-500' : status === 'TRIALING' ? 'bg-blue-500' :
                        status === 'PAST_DUE' ? 'bg-yellow-500' : status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{status.toLowerCase().replace('_', ' ')}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Adoption Tab */}
      {activeTab === 'modules' && moduleAdoption && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Module Adoption Rates</h3>
            <span className="text-sm text-gray-500">{moduleAdoption.totalAssociations} active associations</span>
          </div>
          <div className="space-y-4">
            {moduleAdoption.modules.map((module) => (
              <div key={module.code} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{module.name}</span>
                    {module.isCore && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Core</span>}
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900 dark:text-white">{module.adoptionRate}%</span>
                    <span className="text-xs text-gray-500 ml-2">({module.enabledCount} tenants)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${module.isCore ? 'bg-blue-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(module.adoptionRate, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500">
                  Available in: {module.plans.join(', ') || 'All plans'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Churn Tab */}
      {activeTab === 'churn' && churnData && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Churn Analysis (Last 6 Months)</h3>
              <span className="text-sm px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                Avg Churn: {churnData.averageChurnRate}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Month</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">New Signups</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">Cancelled</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">Suspended</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">Churn Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {churnData.months.map((month) => (
                    <tr key={month.month} className="border-b border-gray-100 dark:border-gray-700/50">
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{month.month}</td>
                      <td className="py-3 px-2 text-center text-green-600">+{month.newSignups}</td>
                      <td className="py-3 px-2 text-center text-red-600">{month.cancelled}</td>
                      <td className="py-3 px-2 text-center text-yellow-600">{month.suspended}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          month.churnRate < 2 ? 'bg-green-100 text-green-800' :
                          month.churnRate < 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {month.churnRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && revenueData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
              <p className="text-green-100 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold mt-1">₦{revenueData.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
              <p className="text-blue-100 text-sm">Avg Monthly Revenue</p>
              <p className="text-3xl font-bold mt-1">₦{Number(revenueData.averageMonthlyRevenue).toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
              <p className="text-purple-100 text-sm">Total Transactions</p>
              <p className="text-3xl font-bold mt-1">{revenueData.months.reduce((sum, m) => sum + m.transactions, 0)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Revenue Trends (Last 12 Months)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Month</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium">Revenue</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium">Transactions</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.months.map((month, idx) => {
                    const prevRevenue = idx > 0 ? revenueData.months[idx - 1].revenue : month.revenue;
                    const change = prevRevenue > 0 ? ((month.revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : '0';
                    return (
                      <tr key={month.month} className="border-b border-gray-100 dark:border-gray-700/50">
                        <td className="py-3 px-2 font-medium text-gray-900 dark:text-white">{month.month}</td>
                        <td className="py-3 px-2 text-right text-gray-900 dark:text-white">₦{month.revenue.toLocaleString()}</td>
                        <td className="py-3 px-2 text-center text-gray-600 dark:text-gray-300">{month.transactions}</td>
                        <td className="py-3 px-2">
                          {idx > 0 && (
                            <span className={`text-xs ${Number(change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {Number(change) >= 0 ? '↑' : '↓'} {Math.abs(Number(change))}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: number; icon: string; color?: 'green' | 'blue' | 'yellow' | 'red' }) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  };

  return (
    <div className={`rounded-xl p-4 border ${color ? colorClasses[color] : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${
        color === 'green' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' :
        color === 'yellow' ? 'text-yellow-600' : color === 'red' ? 'text-red-600' : 'text-gray-900 dark:text-white'
      }`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
