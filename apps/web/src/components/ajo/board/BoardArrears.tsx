'use client';

import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { useBoardArrears } from '@/lib/ajo/boardHooks';
import { Card, Stat } from './BoardParts';

/**
 * 4.6 Arrears and accountability. States facts ("Behind by ₦20,000.00"), never a label. The same screen also shows how long officers
 * take to confirm payments, so accountability runs both ways.
 */
export function BoardArrearsView({ groupId }: { groupId: number }) {
  const q = useBoardArrears(groupId);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const { behind, afterPayout, lateFees, confirmation } = q.data;

  return (
    <div className="space-y-5">
      <Card title="Behind on payments">
        {behind.length === 0 ? (
          <p className="text-sm text-ink-muted">Nobody is behind past the grace period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Member</th>
                  <th className="py-2 pr-4 text-right font-medium">Rounds missed</th>
                  <th className="py-2 pr-4 text-right font-medium">Behind by</th>
                  <th className="py-2 pr-4 text-right font-medium">Days overdue</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {behind.map((r) => (
                  <tr key={r.membershipId} className="border-t border-line-soft">
                    <td className="py-2 pr-4">{r.isYou ? 'You' : r.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.roundsMissed}</td>
                    <td className="py-2 pr-4 text-right">
                      <Money kobo={r.behindKobo} />
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.daysOverdue}</td>
                    <td className="py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {afterPayout.length > 0 ? (
        <Card title="Behind after receiving the pot" className="border-warning-line">
          <p className="text-sm text-ink-muted">These matter most, because the rest of the circle has already paid them.</p>
          <ul className="space-y-1 text-sm">
            {afterPayout.map((r) => (
              <li key={r.membershipId}>
                <span className="font-medium">{r.isYou ? 'You' : r.name}</span>: {r.text}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Late fees charged">
          <Money kobo={lateFees.chargedKobo} />
        </Stat>
        <Stat label="Late fees waived">
          <Money kobo={lateFees.waivedKobo} />
        </Stat>
        <Stat label="Late fees paid">
          <Money kobo={lateFees.paidKobo} />
        </Stat>
      </div>
      <p className="text-xs text-ink-faint">Only totals are shown. Each person sees their own late fees on their own page.</p>

      <Card title="How quickly payments are confirmed">
        {confirmation.waitingCount === 0 ? (
          <p className="text-sm text-ink">No payments are waiting for an officer to confirm them.</p>
        ) : (
          <p className="text-sm text-ink">
            Payments waiting for confirmation: {confirmation.waitingCount}
            {confirmation.oldestDays !== null ? ` (oldest ${confirmation.oldestDays} day${confirmation.oldestDays === 1 ? '' : 's'})` : ''}.
            {confirmation.pastTargetCount > 0 ? ` ${confirmation.pastTargetCount} ${confirmation.pastTargetCount === 1 ? 'has' : 'have'} waited more than ${confirmation.targetHours} hours.` : ` The target is ${confirmation.targetHours} hours.`}
          </p>
        )}
      </Card>
      {behind.length === 0 && afterPayout.length === 0 && confirmation.waitingCount === 0 ? <AjoEmpty title="All caught up." /> : null}
    </div>
  );
}
