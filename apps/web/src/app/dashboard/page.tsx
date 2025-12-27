'use client';

import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Mock data for charts
const revenueData = [
  { month: 'Jan', revenue: 32000 },
  { month: 'Feb', revenue: 38000 },
  { month: 'Mar', revenue: 42000 },
  { month: 'Apr', revenue: 39000 },
  { month: 'May', revenue: 45000 },
  { month: 'Jun', revenue: 52000 },
];

const paymentMethodsData = [
  { name: 'Bank Transfer', value: 45, color: '#14b8a6' },
  { name: 'Cash', value: 30, color: '#f59e0b' },
  { name: 'Mobile Money', value: 25, color: '#8b5cf6' },
];

const activityData = [
  { time: '00:00', activity: 120 },
  { time: '04:00', activity: 80 },
  { time: '08:00', activity: 200 },
  { time: '12:00', activity: 350 },
  { time: '16:00', activity: 280 },
  { time: '20:00', activity: 180 },
];

const recentTransactions = [
  { id: 1, member: 'John Doe', amount: 5000, status: 'Completed', date: '2025-12-24' },
  { id: 2, member: 'Jane Smith', amount: 3500, status: 'Pending', date: '2025-12-24' },
  { id: 3, member: 'Mike Johnson', amount: 7200, status: 'Completed', date: '2025-12-23' },
  { id: 4, member: 'Sarah Williams', amount: 4100, status: 'Completed', date: '2025-12-23' },
];

export default function DashboardPage() {
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
            value="150"
            icon={<UsersIcon />}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            title="Total Revenue"
            value="₦45,230"
            icon={<CashIcon />}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <StatCard
            title="Pending Payments"
            value="23"
            icon={<ClockIcon />}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/20"
          />
          <StatCard
            title="Overdue Payments"
            value="8"
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
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Methods */}
          <div className="glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Payment Methods</h2>
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
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Activity */}
          <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Today's Activity</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="time" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Bar dataKey="activity" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Stats */}
          <div className="glass rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Stats</h2>
            <div className="space-y-4">
              <QuickStat label="Active Members" value="142" percentage="+12%" trend="up" />
              <QuickStat label="This Month" value="₦52,000" percentage="+8%" trend="up" />
              <QuickStat label="Collection Rate" value="94%" percentage="-2%" trend="down" />
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Transactions</h2>
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
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{transaction.member}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">₦{transaction.amount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.status === 'Completed' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{transaction.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color, bgColor }: any) {
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

// Quick Stat Component
function QuickStat({ label, value, percentage, trend }: any) {
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

// Icon Components
function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}