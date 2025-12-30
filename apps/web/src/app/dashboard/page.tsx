'use client';

import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDashboardOverview, formatCurrency, formatPercentageChange, getStatusColor } from '@/lib/api/dashboard';

export default function DashboardPage() {
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
          <AlertIcon className="w-12 h-12" />
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's your overview</p>
      </div>

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Members"
            value={data.memberStats.total.toString()}
            icon={<UsersIcon />}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(data.financialSummary.totalInflow)}
            icon={<CashIcon />}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <StatCard
            title="Pending Payments"
            value={data.financialSummary.pendingPayments.toString()}
            icon={<ClockIcon />}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/20"
          />
          <StatCard
            title="Overdue Payments"
            value={data.financialSummary.overduePayments.toString()}
            icon={<AlertIcon />}
            color="text-red-600 dark:text-red-400"
            bgColor="bg-red-50 dark:bg-red-900/20"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Revenue Analytics</h2>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
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
          <div className="glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Payment Methods</h2>
            {paymentMethodsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: number) => [`${value}%`, 'Share']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No payment data yet" />
            )}
          </div>
        </div>


        {/* Quick Stats & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Stats */}
          <div className="glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Stats</h2>
            <div className="space-y-4">
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
          <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Transactions</h2>
            {data.recentTransactions.length > 0 ? (
              <div className="overflow-x-auto">
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
            ) : (
              <EmptyTableState message="No transactions yet" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// SKELETON COMPONENTS
// ============================================

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-8">
        <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      <div className="space-y-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 shadow-xl">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
              <div className="h-[250px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Quick Stats & Transactions Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6 shadow-xl">
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-xl">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ============================================
// EMPTY STATE COMPONENTS
// ============================================

function EmptyDashboard() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome! Let's get started</p>
      </div>

      <div className="glass rounded-2xl p-12 shadow-xl text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <UsersIcon className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to your Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your dashboard will show member statistics, financial summaries, and recent activity once you add members and record transactions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/dashboard/members"
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Add Members
            </a>
            <a
              href="/dashboard/finance"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Set Up Finance
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <ChartIcon className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}

function EmptyTableState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
        <TableIcon className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}

// ============================================
// STAT CARD COMPONENT
// ============================================

function StatCard({ title, value, icon, color, bgColor }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="glass rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================
// QUICK STAT COMPONENT
// ============================================

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

// ============================================
// ICON COMPONENTS
// ============================================

function UsersIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function CashIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ChartIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TableIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
