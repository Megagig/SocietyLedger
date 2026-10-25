'use client';

import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getElectionProgress } from '@/lib/api/voting';

const REFRESH_MS = 10_000;

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * How an election is going while members vote: how many of the eligible members have voted, how that built up over the voting window,
 * and how many have voted on each position. It updates every few seconds. It shows turnout only — never who is ahead or who anyone
 * voted for — so seeing it can't sway the vote.
 */
export function ElectionProgress({ electionId, compact = false }: { electionId: number; compact?: boolean }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['election-progress', electionId],
    queryFn: () => getElectionProgress(electionId),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const progress = data?.data;

  if (isLoading) return <div className="animate-pulse h-40 rounded-xl bg-gray-100 dark:bg-gray-800" />;
  if (isError || !progress) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{(error as Error)?.message || 'Turnout isn’t available yet.'}</p>;
  }

  const live = progress.status === 'VOTING_OPEN';
  const quorumLine = progress.requiresQuorum && progress.quorumPercentage ? progress.quorumPercentage : null;

  return (
    <div className="space-y-4" data-testid="election-progress">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {progress.voted} <span className="text-lg font-medium text-gray-500 dark:text-gray-400">of {progress.eligible} members have voted</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {progress.turnoutPercent}% turnout
            {quorumLine !== null && (progress.quorumMet ? ` · the ${quorumLine}% minimum is met` : ` · ${quorumLine}% needed for the result to count`)}
          </p>
        </div>
        {live && (
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Live
          </span>
        )}
      </div>

      <div className="relative h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" role="progressbar" aria-valuenow={progress.turnoutPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Turnout">
        <div className="h-full rounded-full bg-teal-500 transition-all duration-700" style={{ width: `${Math.min(100, progress.turnoutPercent)}%` }} />
        {quorumLine !== null && <div className="absolute top-0 h-full w-0.5 bg-gray-900/60 dark:bg-white/70" style={{ left: `${Math.min(100, quorumLine)}%` }} title={`${quorumLine}% minimum`} />}
      </div>

      {!compact && progress.timeline.length > 1 && (
        <div className="text-teal-500">
          <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Members who have voted, over time</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progress.timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id={`turnout-${electionId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="currentColor" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="currentColor" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                <XAxis dataKey="at" tickFormatter={(v) => new Date(v).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit' })} tick={{ fontSize: 10 }} stroke="currentColor" minTickGap={40} />
                <YAxis allowDecimals={false} domain={[0, Math.max(progress.eligible, 1)]} tick={{ fontSize: 10 }} stroke="currentColor" />
                <Tooltip labelFormatter={(v) => timeLabel(String(v))} formatter={(value) => [`${value} members`, 'Voted']} />
                <Area type="monotone" dataKey="voted" stroke="currentColor" strokeWidth={2} fill={`url(#turnout-${electionId})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!compact && progress.positions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Voting on each position</p>
          {progress.positions.map((p) => {
            const percent = progress.eligible > 0 ? Math.round((p.voted / progress.eligible) * 100) : 0;
            return (
              <div key={p.positionId}>
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>{p.title}</span>
                  <span>{p.voted} of {progress.eligible}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div className="h-full rounded-full bg-teal-500 transition-all duration-700" style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
