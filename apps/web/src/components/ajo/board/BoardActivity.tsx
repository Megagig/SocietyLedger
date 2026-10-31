'use client';

import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { useBoardActivity } from '@/lib/ajo/boardHooks';
import { formatMomentIn } from './BoardParts';

/** 4.8 Circle activity: a read-only log, newest first. A correction is a new entry; nothing here is ever edited or removed. */
export function BoardActivityView({ groupId }: { groupId: number }) {
  const q = useBoardActivity(groupId);
  if (q.isLoading) return <AjoLoading rows={5} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.entries.length === 0) return <AjoEmpty title="Nothing has happened yet." hint="Confirmed payments, payouts and rule changes appear here." />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Everyone in the circle sees the same log. Times are in {q.data.timezone}.</p>
      <ul className="divide-y divide-line-soft rounded-lg border border-line">
        {q.data.entries.map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
            <span className="text-ink">{e.text}</span>
            <span className="text-xs text-ink-faint tabular-nums">{formatMomentIn(e.at, q.data.timezone)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
