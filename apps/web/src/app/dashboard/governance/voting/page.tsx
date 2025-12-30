'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { 
  IconChecklist, 
  IconChartBar, 
  IconUsers, 
  IconCalendarEvent,
  IconPlus,
  IconChevronRight,
  IconClock,
  IconCheck,
  IconX,
  IconChartPie
} from '@tabler/icons-react';
import { getVotingDashboard, getActiveVotingItems, Election, Poll } from '@/lib/api/voting';

// Helper functions
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Draft' },
    NOMINATIONS_OPEN: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Nominations Open' },
    NOMINATIONS_CLOSED: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Nominations Closed' },
    VOTING_OPEN: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Voting Open' },
    VOTING_CLOSED: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Voting Closed' },
    RESULTS_PUBLISHED: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Results Published' },
    CANCELLED: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Cancelled' },
    ACTIVE: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Active' },
    CLOSED: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: 'Closed' },
  };

  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-700', label: status };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

// Stat card component
function StatCard({ title, value, icon: Icon, color, href }: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Election card component
function ElectionCard({ election }: { election: Election }) {
  return (
    <Link href={`/dashboard/governance/elections/${election.id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{election.title}</h3>
          <StatusBadge status={election.status} />
        </div>
        {election.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{election.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {election._count?.positions && (
            <span className="flex items-center gap-1">
              <IconUsers size={16} />
              {election._count.positions} positions
            </span>
          )}
          {election.votingStartDate && (
            <span className="flex items-center gap-1">
              <IconCalendarEvent size={16} />
              {formatDate(election.votingStartDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Poll card component
function PollCard({ poll }: { poll: Poll }) {
  return (
    <Link href={`/dashboard/governance/polls/${poll.id}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{poll.title}</h3>
          <StatusBadge status={poll.status} />
        </div>
        {poll.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{poll.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          {poll._count?.options && (
            <span className="flex items-center gap-1">
              <IconChartPie size={16} />
              {poll._count.options} options
            </span>
          )}
          {poll._count?.responses !== undefined && (
            <span className="flex items-center gap-1">
              <IconUsers size={16} />
              {poll._count.responses} responses
            </span>
          )}
          {poll.endDate && (
            <span className="flex items-center gap-1">
              <IconClock size={16} />
              Ends {formatDate(poll.endDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function VotingDashboardPage() {
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['voting-dashboard'],
    queryFn: getVotingDashboard,
  });

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['voting-active'],
    queryFn: getActiveVotingItems,
  });

  const dashboard = dashboardData?.data;
  const activeItems = activeData?.data;

  if (dashboardLoading || activeLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
            Voting & Elections
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Conduct digital voting, manage elections, and run polls
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/governance/polls/new"
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <IconPlus size={18} />
            New Poll
          </Link>
          <Link
            href="/dashboard/governance/elections/new"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <IconPlus size={18} />
            New Election
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Elections"
          value={dashboard?.totalElections || 0}
          icon={IconChecklist}
          color="bg-teal-500"
          href="/dashboard/governance/elections"
        />
        <StatCard
          title="Active Elections"
          value={dashboard?.activeElections || 0}
          icon={IconClock}
          color="bg-green-500"
        />
        <StatCard
          title="Total Polls"
          value={dashboard?.totalPolls || 0}
          icon={IconChartBar}
          color="bg-blue-500"
          href="/dashboard/governance/polls"
        />
        <StatCard
          title="Active Polls"
          value={dashboard?.activePolls || 0}
          icon={IconChartPie}
          color="bg-purple-500"
        />
      </div>

      {/* Active Elections */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Elections</h2>
          <Link
            href="/dashboard/governance/elections"
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            View all <IconChevronRight size={16} />
          </Link>
        </div>
        {activeItems?.elections && activeItems.elections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeItems.elections.slice(0, 4).map((election) => (
              <ElectionCard key={election.id} election={election} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <IconChecklist size={48} className="mx-auto mb-3 opacity-50" />
            <p>No active elections</p>
            <Link
              href="/dashboard/governance/elections/new"
              className="text-teal-600 dark:text-teal-400 hover:underline text-sm"
            >
              Create your first election
            </Link>
          </div>
        )}
      </div>

      {/* Active Polls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Polls</h2>
          <Link
            href="/dashboard/governance/polls"
            className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            View all <IconChevronRight size={16} />
          </Link>
        </div>
        {activeItems?.polls && activeItems.polls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeItems.polls.slice(0, 4).map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <IconChartBar size={48} className="mx-auto mb-3 opacity-50" />
            <p>No active polls</p>
            <Link
              href="/dashboard/governance/polls/new"
              className="text-teal-600 dark:text-teal-400 hover:underline text-sm"
            >
              Create your first poll
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/governance/elections">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
            <IconChecklist size={32} className="mb-3" />
            <h3 className="font-semibold text-lg mb-1">Manage Elections</h3>
            <p className="text-teal-100 text-sm">Create and manage elections with positions and candidates</p>
          </div>
        </Link>
        <Link href="/dashboard/governance/polls">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
            <IconChartBar size={32} className="mb-3" />
            <h3 className="font-semibold text-lg mb-1">Manage Polls</h3>
            <p className="text-blue-100 text-sm">Create quick polls to gather member opinions</p>
          </div>
        </Link>
        <Link href="/dashboard/governance/elections?status=RESULTS_PUBLISHED">
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
            <IconChartPie size={32} className="mb-3" />
            <h3 className="font-semibold text-lg mb-1">View Results</h3>
            <p className="text-purple-100 text-sm">See election results and poll analytics</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
