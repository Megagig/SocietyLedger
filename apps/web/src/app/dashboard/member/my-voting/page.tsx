'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { IconChecklist, IconChartPie, IconBadge, IconCheck } from '@tabler/icons-react';
import { ElectionProgress } from '@/components/voting/ElectionProgress';
import { IneligibleNote } from '@/components/voting/EligibilityPanel';
import { getActiveVotingItems, getElections, getVoterStatus, Election } from '@/lib/api/voting';

// R2.7/G19: this page was a static placeholder — no fetch of any kind.
// /voting/active, /voting/elections (closed) and per-election voter-status
// already existed.
export default function MyVotingPage() {
  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['active-voting-items'],
    queryFn: () => getActiveVotingItems(),
  });

  const { data: closedData, isLoading: closedLoading } = useQuery({
    queryKey: ['closed-elections'],
    queryFn: () => getElections({ status: 'RESULTS_PUBLISHED', limit: 10 }),
  });

  const activeElections = activeData?.data?.elections || [];
  const activePolls = activeData?.data?.polls || [];
  const closedElections: Election[] = closedData?.data?.elections || [];

  const voterStatusQueries = useQueries({
    queries: closedElections.map((election) => ({
      queryKey: ['voter-status', election.id],
      queryFn: () => getVoterStatus(election.id),
      enabled: closedElections.length > 0,
    })),
  });

  const votedCount = voterStatusQueries.filter((q) => q.data?.data?.hasVoted).length;
  const historyLoading = closedLoading || voterStatusQueries.some((q) => q.isLoading);

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
              {activeElections.length} Active
            </span>
          </div>
          {activeLoading ? (
            <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ) : activeElections.length > 0 ? (
            <div className="space-y-3">
              {activeElections.map((election: Election) => (
                <div key={election.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <Link
                  href={`/dashboard/governance/elections/${election.id}`}
                  className="block hover:text-teal-600 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{election.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Voting open{election.votingEndDate ? ` · ends ${new Date(election.votingEndDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                  </p>
                </Link>
                <IneligibleNote electionId={election.id} />
                <ElectionProgress electionId={election.id} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconBadge size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No active elections at the moment
              </p>
            </div>
          )}
        </div>

        {/* Active Polls */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Active Polls
            </h2>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
              {activePolls.length} Active
            </span>
          </div>
          {activeLoading ? (
            <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ) : activePolls.length > 0 ? (
            <div className="space-y-3">
              {activePolls.map((poll: any) => (
                <Link
                  key={poll.id}
                  href={`/dashboard/governance/polls/${poll.id}`}
                  className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{poll.title}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconChartPie size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No active polls at the moment
              </p>
            </div>
          )}
        </div>

        {/* My Voting History */}
        <div className="glass rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            My Voting History
          </h2>
          {historyLoading ? (
            <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          ) : closedElections.length > 0 ? (
            <div className="space-y-3">
              {closedElections.map((election, i) => {
                const hasVoted = voterStatusQueries[i]?.data?.data?.hasVoted;
                return (
                  <Link
                    key={election.id}
                    href={`/dashboard/governance/elections/${election.id}/results`}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 transition-colors"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{election.title}</p>
                    {hasVoted ? (
                      <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                        <IconCheck size={16} /> Voted
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Did not vote</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconChecklist size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                No voting history yet
              </p>
            </div>
          )}
        </div>

        {/* Voting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Elections Participated"
            value={String(votedCount)}
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
          <StatCard
            title="Elections Available"
            value={String(closedElections.length)}
            color="text-blue-600 dark:text-blue-400"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <StatCard
            title="Participation Rate"
            value={closedElections.length > 0 ? `${Math.round((votedCount / closedElections.length) * 100)}%` : '0%'}
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
