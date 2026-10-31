'use client';

import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { formatDay, formatKobo } from '@/lib/ajo/format';
import { useBoardOverview } from '@/lib/ajo/boardHooks';
import { Card, PayoutChip, percent, ProgressBar, Stat, StatusChip } from './BoardParts';

/** 4.1 Overview: the first screen. */
export function BoardOverview({ groupId }: { groupId: number }) {
  const q = useBoardOverview(groupId);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { header, thisRound: r, upNext, you, health } = q.data;
  const counts = r.counts;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-ink">{header.name}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Round {header.round} of {header.totalRounds} · <Money kobo={header.contributionPerShareKobo} /> per share, {header.cadence} · {formatDay(header.startDate)}
          {header.endsOn ? ` to ${formatDay(header.endsOn)}` : ''} · times are in {header.timezone}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`This round${r.dueDate ? `, due ${formatDay(r.dueDate)}${r.dueIn ? ` (${r.dueIn})` : ''}` : ''}`}>
          <ProgressBar collected={BigInt(r.collectedKobo)} expected={BigInt(r.expectedKobo)} label="Collected this round" />
          <p className="text-sm text-ink">
            <Money kobo={r.collectedKobo} /> of <Money kobo={r.expectedKobo} /> collected ({r.paidCount} of {r.expectedCount} paid)
          </p>
          <p className="text-sm text-ink-muted">
            Paid {counts.PAID_ON_TIME + counts.PAID_LATE} · Reported {counts.REPORTED} · Due {counts.DUE} · Overdue {counts.OVERDUE + counts.MISSED}
            {counts.UNDER_REVIEW ? ` · Under review ${counts.UNDER_REVIEW}` : ''}
          </p>
        </Card>

        <Card title="Up next">
          {upNext ? (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-ink">
                {upNext.isYou ? 'You' : upNext.recipient} · position {upNext.position}
              </p>
              <p className="text-sm text-ink-muted">{upNext.scheduledOn ? `Scheduled ${formatDay(upNext.scheduledOn)}` : 'No date yet'}</p>
              <div className="flex items-center gap-2">
                <PayoutChip status={upNext.status} />
                {upNext.holdReason ? <span className="text-sm text-ink-muted">{upNext.holdReason}</span> : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">The payout order has not been drawn yet.</p>
          )}
        </Card>
      </div>

      {you ? (
        <Card title="You">
          <div className="flex flex-wrap items-center gap-3">
            {you.thisRound ? <StatusChip status={you.thisRound.status} label={you.thisRound.label} graceEndsOn={you.thisRound.graceEndsOn} /> : null}
            <span className="text-sm text-ink">{you.upToDate ? "You're up to date." : `You're behind by ${formatKobo(you.behindKobo)}.`}</span>
          </div>
          {you.positions.length > 0 ? (
            <p className="text-sm text-ink-muted">{you.positions.map((p) => `Your turn: round ${p.position}${p.scheduledOn ? `, ${formatDay(p.scheduledOn)}` : ''}`).join(' · ')}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Collected this round">{percent(health.collectionBps)}</Stat>
        <Stat label="Paid on time, all rounds">{percent(health.onTimeBps)}</Stat>
        <Stat label="Rounds completed">
          {health.roundsCompleted} of {health.totalRounds}
        </Stat>
        <Stat label="Payouts recorded" hint={`${health.payoutsRecordedCount} so far`}>
          <Money kobo={health.payoutsRecordedKobo} />
        </Stat>
      </div>
      {q.data.visibility.anonymisedUntilAccepted ? <p className="text-xs text-ink-faint">Members who have not yet accepted the circle board rule show as &quot;Member&quot; and a number.</p> : null}
    </div>
  );
}
