'use client';

import { IconChecklist, IconChartPie, IconBadge } from '@tabler/icons-react';

export default function MyVotingPage() {
  return (
    <>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          My Voting
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Participate in elections and polls
        </p>
      </div>

      <div className="space-y-6">
        {/* Active Elections */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Active Elections
            </h2>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              0 Active
            </span>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconBadge size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No active elections at the moment
            </p>
          </div>
        </div>

        {/* Active Polls */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Active Polls
            </h2>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
              0 Active
            </span>
          </div>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconChartPie size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No active polls at the moment
            </p>
          </div>
        </div>

        {/* My Voting History */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            My Voting History
          </h2>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconChecklist size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              No voting history yet
            </p>
          </div>
        </div>

        {/* Voting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Elections Participated"
            value="0"
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
          <StatCard
            title="Polls Participated"
            value="0"
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            title="Participation Rate"
            value="0%"
            color="text-green-600 dark:text-green-400"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, color, bgColor }: {
  title: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`p-6 rounded-xl ${bgColor}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
