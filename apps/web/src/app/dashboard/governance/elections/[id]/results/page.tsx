'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { IconArrowLeft, IconTrophy, IconUsers, IconChecklist } from '@tabler/icons-react';
import { getElectionResults } from '@/lib/api/voting';
import { HelpLink } from '@/components/docs/HelpLink';

export default function ElectionResultsPage() {
  const params = useParams();
  const electionId = parseInt(params.id as string);

  const { data, isPending, error } = useQuery({
    queryKey: ['election-results', electionId],
    queryFn: () => getElectionResults(electionId),
    enabled: !!electionId,
  });

  const results = data?.data;

  if (isPending) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          {error instanceof Error ? error.message : 'Results are not yet available'}
        </p>
        <Link href={`/dashboard/governance/elections/${electionId}`} className="text-teal-600 hover:underline">
          Back to election
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/governance/elections/${electionId}`}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <IconArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{results.electionTitle}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {results.published === false ? 'Election Results (not published yet — only the Election Committee can see these)' : 'Election Results'}
            </p>
          </div>
        </div>
        <HelpLink />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconUsers size={20} />
            <span className="text-sm font-medium">Turnout</span>
          </div>
          <p className="text-gray-900 dark:text-white text-lg font-semibold">
            {results.voterTurnout}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {results.totalVotesCast} of {results.totalEligibleVoters} eligible members voted
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconChecklist size={20} />
            <span className="text-sm font-medium">Quorum</span>
          </div>
          <p className={`text-lg font-semibold ${results.quorumMet ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {!results.requiresQuorum ? 'Not required' : results.quorumMet ? 'Met' : 'Not Met'}
          </p>
          {results.requiresQuorum && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{results.quorumPercentage}% of members needed to vote</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
            <IconTrophy size={20} />
            <span className="text-sm font-medium">Status</span>
          </div>
          <p className="text-gray-900 dark:text-white text-lg font-semibold capitalize">
            {results.status.replace(/_/g, ' ').toLowerCase()}
          </p>
        </div>
      </div>

      {/* Per-position results */}
      {results.positions.map((position) => (
        <div key={position.positionId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{position.positionTitle}</h2>
          {position.tied && position.tied.length > 1 && (
            <p className="mb-3 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
              {position.tied.map((c) => c.memberName).join(' and ')} have the same number of votes, so there is no winner yet. The committee decides what happens next.
            </p>
          )}
          <div className="space-y-3">
            {position.candidates.map((candidate) => {
              const isWinner = position.winner?.candidateId === candidate.candidateId;
              return (
                <div
                  key={candidate.candidateId}
                  className={`relative p-4 rounded-lg border overflow-hidden ${
                    isWinner ? 'border-teal-500' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-teal-100 dark:bg-teal-900/30"
                    style={{ width: `${candidate.votePercentage}%` }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isWinner && <IconTrophy size={18} className="text-teal-600 dark:text-teal-400" />}
                      <span className="font-medium text-gray-900 dark:text-white">{candidate.memberName}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {candidate.voteCount} votes ({candidate.votePercentage}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {!!position.abstentions && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{position.abstentions} abstained</p>
          )}
        </div>
      ))}

      {/* General (no-position) results */}
      {results.generalResults && results.generalResults.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Results</h2>
          <div className="space-y-3">
            {results.generalResults.map((candidate) => (
              <div key={candidate.candidateId} className="relative p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div
                  className="absolute inset-0 bg-teal-100 dark:bg-teal-900/30"
                  style={{ width: `${candidate.votePercentage}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">{candidate.memberName}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {candidate.voteCount} votes ({candidate.votePercentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
