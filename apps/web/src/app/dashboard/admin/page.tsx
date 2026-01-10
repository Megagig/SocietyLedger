'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDashboardOverview, formatCurrency, formatPercentageChange, getStatusColor } from '@/lib/api/dashboard';
import { useAuthStore } from '@/store/authStore';
import {
  IconWallet,
  IconUsers,
  IconCurrencyNaira,
  IconReceipt,
  IconClock,
  IconAlertTriangle,
  IconChartBar,
} from '@tabler/icons-react';

export default function AdminDashboardPage() {
  const { user } = useAuthStore();

  // Fetch dashboard data
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Loading state
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-500 dark:text-red-400">
          <IconAlertTriangle size={48} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Failed to load dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400">{(error as Error)?.message || 'Something went wrong'}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state check
  const hasNoData = !data || (data.memberStats.total === 0 && data.recentTransactions.length === 0);

  if (hasNoData) {
    return <EmptyDashboard />;
  }

  // Transform data for charts
  const revenueData = data.revenueTrend.map(item => ({
    month: item.month,
    revenue: parseFloat(item.revenue),
  }));

  const paymentMethodsData = data.paymentMethods.map(item => ({
    name: item.name,
    value: item.percentage,
    color: item.color,
  }));

  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Admin Dashboard
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Welcome back, {user?.email?.split('@')[0] || 'Admin'}! Here's your association overview
        </p>
      </div>

      <div className="space-y-6">
        {/* Personal Summary Section (Admin as Member) */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <IconWallet size={20} className="text-teal-600 dark:text-teal-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              My Personal Summary
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PersonalStatCard
              title="My Outstanding Balance"
              value="₦0.00"
              color="text-orange-600 dark:text-orange-400"
            />
            <PersonalStatCard
              title="My Payments This Month"
              value="₦0.00"
              color="text-green-600 dark:text-green-400"
            />
            <PersonalStatCard
              title="My Next Due Date"
              value="No dues"
              color="text-blue-600 dark:text-blue-400"
            />
          </div>
        </div>

        {/* Association Management Section */}
        <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center gap-2 mb-6">
            <IconChartBar size={20} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Association Management
            </h2>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6">
            <StatCard
              title="Total Members"
              value={data.memberStats.total.toString()}
              icon={<IconUsers size={20} />}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-50 dark:bg-blue-900/20"
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(data.financialSummary.totalInflow)}
              icon={<IconCurrencyNaira size={20} />}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            <StatCard
              title="Pending Payments"
              value={data.financialSummary.pendingPayments.toString()}
              icon={<IconClock size={20} />}
              color="text-orange-600 dark:text-orange-400"
              bgColor="bg-orange-50 dark:bg-orange-900/20"
            />
            <StatCard
              title="Overdue Payments"
              value={data.financialSummary.overduePayments.toString()}
              icon={<IconAlertTriangle size={20} />}
              color="text-red-600 dark:text-red-400"
              bgColor="bg-red-50 dark:bg-red-900/20"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {/* Revenue Chart */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Revenue Analytics</h3>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#9ca3af" tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#14b8a6" fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No revenue data yet" />
              )}
            </div>

            {/* Payment Methods */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Payment Methods</h3>
              {paymentMethodsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentMethodsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMethodsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number) => [`${value}%`, 'Share']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No payment data yet" />
              )}
            </div>
          </div>

          {/* Quick Stats & Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Quick Stats */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Stats</h3>
              <div className="space-y-3 sm:space-y-4">
                <QuickStat 
                  label="Active Members" 
                  value={data.quickStats.activeMembers.toString()} 
                  percentage={formatPercentageChange(data.quickStats.activeMembersChange)} 
                  trend={data.quickStats.activeMembersChange >= 0 ? 'up' : 'down'} 
                />
                <QuickStat 
                  label="This Month" 
                  value={formatCurrency(data.quickStats.thisMonthRevenue)} 
                  percentage={formatPercentageChange(data.quickStats.thisMonthRevenueChange)} 
                  trend={data.quickStats.thisMonthRevenueChange >= 0 ? 'up' : 'down'} 
                />
                <QuickStat 
                  label="Collection Rate" 
                  value={`${data.quickStats.collectionRate}%`} 
                  percentage={formatPercentageChange(data.quickStats.collectionRateChange)} 
                  trend={data.quickStats.collectionRateChange >= 0 ? 'up' : 'down'} 
                />
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="lg:col-span-2 glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
              <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Transactions</h3>
              {data.recentTransactions.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {data.recentTransactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{transaction.memberName}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(transaction.amount)}</span>
                          <span className="text-gray-600 dark:text-gray-400">
                            {new Date(transaction.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Member</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentTransactions.slice(0, 5).map((transaction) => (
                          <tr key={transaction.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{transaction.memberName}</td>
                            <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(transaction.amount)}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(transaction.status)}`}>
                                {transaction.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {new Date(transaction.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyTableState message="No transactions yet" />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Personal Stat Card (for admin's personal finances)
function PersonalStatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// Stat Card Component (for association stats)
function StatCard({ title, value, icon, color, bgColor }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">{title}</p>
          <p className={`text-lg sm:text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Quick Stat Component
function QuickStat({ label, value, percentage, trend }: {
  label: string;
  value: string;
  percentage: string;
  trend: 'up' | 'down';
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
      <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {percentage}
      </span>
    </div>
  );
}

// Skeleton, Empty States, etc.
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-6 shadow-xl">
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="glass rounded-2xl p-12 shadow-xl text-center">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Welcome to your Admin Dashboard
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Start by adding members and recording transactions
      </p>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}

function EmptyTableState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}
