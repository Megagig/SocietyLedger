'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { ActionDialog } from '@/components/ajo/ActionDialog';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { useGroupCycle, useStartNextCycle } from '@/lib/ajo/cycleHooks';
import { formatDay } from '@/lib/ajo/format';
import { useAjoCan } from '@/lib/ajo/useAjoCan';

const CHOICE_TEXT = { CONTINUE: 'Continuing', WITHDRAW: 'Withdrawing' } as const;

/**
 * The running cycle of a collector-thrift scheme (spec §16.5): who continues, who withdraws, and who has said nothing (and so withdraws).
 * When the cycle is over and every saver who is leaving has been paid, the admin starts the next one.
 */
export default function GroupCyclePage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const { canWrite } = useAjoAccess();
  const { approvePayout } = useAjoCan();
  const q = useGroupCycle(groupId);
  const start = useStartNextCycle(groupId);
  const [confirming, setConfirming] = useState(false);

  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-ink">Savings cycle {c.cycleNo}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDay(c.startsOn)}
          {c.endsOn ? ` to ${formatDay(c.endsOn)}` : ''}. Savers are asked from {c.promptOpensOn ? formatDay(c.promptOpensOn) : 'three days before the end'} whether to withdraw or continue. If someone does not answer, their savings are paid out to them.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Continuing', c.counts.continuing],
          ['Withdrawing', c.counts.withdrawing],
          ['Have not answered', c.counts.noAnswer],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-lg border border-line p-4">
            <p className="text-xs text-ink-faint">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      {c.people.length === 0 ? (
        <AjoEmpty title="No savers in this cycle." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Saver</th>
                <th className="px-4 py-2 text-right font-medium">Saves each time</th>
                <th className="px-4 py-2 text-right font-medium">Saved so far</th>
                <th className="px-4 py-2 font-medium">At the end</th>
                <th className="px-4 py-2 text-right font-medium">Next cycle</th>
              </tr>
            </thead>
            <tbody>
              {c.people.map((p) => (
                <tr key={p.membershipId} className="border-t border-line-soft">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right"><Money kobo={p.amountKobo} /></td>
                  <td className="px-4 py-2 text-right"><Money kobo={p.savedKobo} /></td>
                  <td className="px-4 py-2">
                    {CHOICE_TEXT[p.effectiveChoice]}
                    {p.choice === 'PENDING' ? <span className="text-ink-faint"> (no answer yet)</span> : p.decidedVia === 'officer' ? <span className="text-ink-faint"> (recorded by an officer)</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right">{p.effectiveChoice === 'CONTINUE' && p.nextAmountKobo ? <Money kobo={p.nextAmountKobo} /> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canWrite && approvePayout && (
        <div className="space-y-2 rounded-lg border border-line p-4">
          <p className="text-sm text-ink">
            {c.canStartNext
              ? 'The cycle is over. Starting the next cycle takes each continuing saver\'s collector fee (one of their contributions) from their savings, carries the rest forward, and closes the places of everyone who withdrew. Savers who are withdrawing must have been paid first.'
              : c.cycleOver
                ? 'Nobody is continuing, so there is no next cycle. Pay everyone out and complete the group instead.'
                : 'The next cycle can be started once this one is over.'}
          </p>
          <Button color="green" disabled={!c.canStartNext} onClick={() => setConfirming(true)}>Start the next cycle</Button>
        </div>
      )}

      <ActionDialog
        opened={confirming}
        onClose={() => setConfirming(false)}
        title="Start the next cycle"
        summary={<p>{c.counts.continuing} continuing and {c.counts.withdrawing} withdrawing. Everyone who is withdrawing will be taken out of the group.</p>}
        confirmLabel="Start the next cycle"
        successMessage="The next cycle has started."
        onConfirm={() => start.mutateAsync()}
      />
    </div>
  );
}
