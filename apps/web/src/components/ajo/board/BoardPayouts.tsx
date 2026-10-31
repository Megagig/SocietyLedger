'use client';

import { IconShieldCheck } from '@tabler/icons-react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { formatDay } from '@/lib/ajo/format';
import { useBoardMembers, useBoardPayouts } from '@/lib/ajo/boardHooks';
import { Card, formatMomentIn, PayoutChip, Stat } from './BoardParts';

/** 4.4 Payouts: the order, where each stands, who recorded and approved, the draw, and every change. */
export function BoardPayoutsView({ groupId }: { groupId: number }) {
  const q = useBoardPayouts(groupId);
  if (q.isLoading) return <AjoLoading rows={5} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { rows, draw, changes, timezone } = q.data;
  if (rows.length === 0) return <AjoEmpty title="The payout order has not been drawn yet." hint="It appears here as soon as the draw is done." />;

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Position</th>
              <th className="px-4 py-2 font-medium">Recipient</th>
              <th className="px-4 py-2 font-medium">Scheduled</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Pot</th>
              <th className="px-4 py-2 font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.position}-${r.shareNo}`} className={`border-t border-line-soft ${r.isYou ? 'bg-surface-muted' : ''}`}>
                <td className="px-4 py-2 tabular-nums">{r.position}</td>
                <td className="px-4 py-2">{r.isYou ? 'You' : r.recipient}</td>
                <td className="px-4 py-2">{r.scheduledOn ? formatDay(r.scheduledOn) : ''}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-1">
                    <PayoutChip status={r.status} />
                    {r.holdReason ? <span className="text-xs text-ink-muted">{r.holdReason}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <Money kobo={r.potKobo} />
                </td>
                <td className="px-4 py-2">
                  {r.recordedAt ? (
                    <div className="text-xs">
                      <p>
                        {formatMomentIn(r.recordedAt, timezone)}
                        {r.referenceLast4 ? ` · ref ••${r.referenceLast4}` : ''}
                      </p>
                      <p className="text-ink-muted">
                        {r.recordedBy ? `Recorded by ${r.recordedBy}` : ''}
                        {r.approvedBy ? ` · approved by ${r.approvedBy}` : ''}
                      </p>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draw ? (
        <Card title="How the order was drawn">
          <p className="flex items-center gap-2 text-sm text-ink">
            <IconShieldCheck size={16} aria-hidden /> Drawn {formatMomentIn(draw.drawnAt, timezone)}
            {draw.seed ? (
              <>
                {' '}
                with seed <code className="rounded bg-surface-muted px-1">{draw.seed}</code>
              </>
            ) : null}
          </p>
          <p className="text-sm text-ink-muted">{draw.howToCheck}</p>
        </Card>
      ) : null}

      <Card title="Changes to the order">
        {changes.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing has been changed since the draw.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {changes.map((c) => (
              <li key={c.id}>
                <p className="text-ink">{c.summary}</p>
                <p className="text-xs text-ink-muted">
                  {formatMomentIn(c.at, timezone)}
                  {c.approvedBy ? ` · approved by ${c.approvedBy}` : ''}
                  {c.reason ? ` · reason: ${c.reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** 4.5 Members: the roster, with counts. */
export function BoardMembersView({ groupId }: { groupId: number }) {
  const q = useBoardMembers(groupId);
  if (q.isLoading) return <AjoLoading rows={5} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { counts, people } = q.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Members">{counts.members}</Stat>
        <Stat label="Shares">{counts.shares}</Stat>
        <Stat label="Verified by SocietyLedger">{counts.verified}</Stat>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 text-right font-medium">Shares</th>
              <th className="px-4 py-2 font-medium">Payout position</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Verified</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.membershipId} className={`border-t border-line-soft ${p.isYou ? 'bg-surface-muted' : ''}`}>
                <td className="px-4 py-2">{p.isYou ? 'You' : p.name}</td>
                <td className="px-4 py-2">{p.joinedOn ? formatDay(p.joinedOn) : ''}</td>
                <td className="px-4 py-2 text-right tabular-nums">{p.shares}</td>
                <td className="px-4 py-2 tabular-nums">{p.positions.join(', ')}</td>
                <td className="px-4 py-2">{p.status}</td>
                <td className="px-4 py-2">{p.verified ? 'Verified' : 'Not yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
