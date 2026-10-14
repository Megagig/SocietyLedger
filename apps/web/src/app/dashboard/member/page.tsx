'use client';

import { useAuthStore } from '@/store/authStore';
import {
  IconWallet,
  IconCalendarEvent,
  IconReceipt,
  IconCreditCard,
  IconChartBar,
  IconArrowRight,
} from '@tabler/icons-react';
import Link from 'next/link';
import { HelpLink } from '@/components/docs/HelpLink';

export default function MemberDashboardPage() {
  const { user } = useAuthStore();

  return (
    <>
      {/* Header - matches admin dashboard */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            My Dashboard
          </h1>
          <HelpLink />
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Welcome back, {user?.email?.split('@')[0] || 'Member'}!
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Personal Financial Summary - matches admin dashboard grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <QuickStatCard
            title="Outstanding Balance"
            value="₦0.00"
            icon={<IconWallet size={20} />}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/20"
          />
          <QuickStatCard
            title="Paid This Month"
            value="₦0.00"
            icon={<IconCreditCard size={20} />}
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <QuickStatCard
            title="Next Due Date"
            value="No dues"
            icon={<IconCalendarEvent size={20} />}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <QuickStatCard
            title="Upcoming Meetings"
            value="0"
            icon={<IconReceipt size={20} />}
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>

        {/* Quick Actions */}
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <ActionCard
              title="My Finances"
              description="View your financial records"
              icon={<IconWallet size={32} />}
              href="/dashboard/my-finances"
              color="teal"
            />
            <ActionCard
              title="Make Payment"
              description="Pay your dues online"
              icon={<IconCreditCard size={32} />}
              href="/dashboard/my-finances/pay"
              color="green"
            />
            <ActionCard
              title="My Meetings"
              description="View upcoming meetings"
              icon={<IconCalendarEvent size={32} />}
              href="/dashboard/member/my-meetings"
              color="blue"
            />
            <ActionCard
              title="My Profile"
              description="Update your information"
              icon={<IconReceipt size={32} />}
              href="/dashboard/member/my-profile"
              color="purple"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Recent Activity
          </h2>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconChartBar size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No recent activity to display
            </p>
          </div>
        </div>

        {/* Upcoming Obligations */}
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
          <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Upcoming Obligations
          </h2>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCalendarEvent size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No upcoming obligations
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Quick Stat Card Component
function QuickStatCard({
  title,
  value,
  icon,
  color,
  bgColor,
}: {
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

// Action Card Component
function ActionCard({
  title,
  description,
  icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}) {
  const colorClasses = {
    teal: 'from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
  };

  return (
    <Link
      href={href}
      className={`block p-6 rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} text-white shadow-lg hover:shadow-xl transition-all duration-200 group`}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-white/80 mb-3">{description}</p>
      <div className="flex items-center text-sm font-medium">
        <span>Go</span>
        <IconArrowRight
          size={16}
          className="ml-1 group-hover:translate-x-1 transition-transform"
        />
      </div>
    </Link>
  );
}
