'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button } from '@mantine/core';
import { IconAlertTriangle, IconDownload } from '@tabler/icons-react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { useAccountability } from '@/lib/ajo/accountabilityHooks';
import { formatDay, formatMoment, formatKobo } from '@/lib/ajo/format';
import { downloadFile } from '@/lib/ajo/savingsHooks';
import { toast } from '@/lib/toast';

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-line p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * What officers answer to (spec §16.7): who prepared, approved and recorded each payout, how long payments wait for confirmation,
 * cash by collector and day, and every exception with its reason. For the group's own meetings and auditors.
 */
export default function AccountabilityPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const q = useAccountability(groupId);
  const [busy, setBusy] = useState(false);
  if (q.isLoading) return <AjoLoading rows={4} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const a = q.data;

  const exportCsv = async () => {
    setBusy(true);
    try {
      await downloadFile(`/ajo/groups/${groupId}/accountability/export.csv`, 'accountability.csv');
    } catch {
      toast.error('Could not make the report. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-muted">Officers answer to members as well as the other way round. Members see the number of payments waiting and how long the oldest has waited; this page shows who each one is.</p>
        <Button variant="default" size="xs" leftSection={<IconDownload size={14} />} loading={busy} onClick={exportCsv}>Download report (CSV)</Button>
      </div>

      <Card title="Who prepared, approved and recorded each payout" hint="One person preparing and approving a payout is allowed in a group with a single admin, but it is shown here.">
        {a.separation.payouts.length === 0 ? (
          <p className="text-sm text-ink-muted">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Recipient</th>
                  <th className="py-2 pr-4 text-right font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Prepared by</th>
                  <th className="py-2 pr-4 font-medium">Approved by</th>
                  <th className="py-2 pr-4 font-medium">Recorded paid by</th>
                  <th className="py-2 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {a.separation.payouts.map((p) => (
                  <tr key={p.id} className="border-t border-line-soft">
                    <td className="py-2 pr-4">{p.recipient}<span className="block text-xs text-ink-faint">{p.round !== null ? `Round ${p.round}` : `Cycle ${p.cycleNo}`}</span></td>
                    <td className="py-2 pr-4 text-right"><Money kobo={p.netKobo} /></td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 pr-4">{p.preparedBy}</td>
                    <td className="py-2 pr-4">{p.approvedBy}</td>
                    <td className="py-2 pr-4">{p.recordedPaidBy}</td>
                    <td className="py-2">
                      {p.singleAdminApproval && <Badge color="yellow" variant="light" leftSection={<IconAlertTriangle size={12} aria-hidden />}>One person prepared and approved</Badge>}
                      {p.sameRecorder && <Badge color="yellow" variant="light" leftSection={<IconAlertTriangle size={12} aria-hidden />}>Recorder also prepared or approved</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Payments waiting for confirmation" hint={`The target is ${a.backlog.targetHours} hours. Members see how many are waiting and how long the oldest has waited.`}>
        <p className="text-sm text-ink">
          {a.backlog.total === 0 ? 'Nothing is waiting.' : `${a.backlog.total} waiting, ${a.backlog.pastTarget} past the target${a.backlog.oldestHours !== null ? `, the oldest for ${a.backlog.oldestHours} hours` : ''}.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          {a.backlog.buckets.map((b) => (
            <div key={b.key} className="rounded-lg border border-line p-3">
              <p className="text-xs text-ink-faint">{b.label}</p>
              <p className="text-xl font-semibold tabular-nums">{b.count}</p>
            </div>
          ))}
        </div>
        {a.backlog.oldest.length > 0 && (
          <ul className="divide-y divide-line-soft text-sm">
            {a.backlog.oldest.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{w.member}</span>
                <span className="tabular-nums"><Money kobo={w.amountKobo} /></span>
                <span>{w.method === 'CASH' ? 'Cash' : 'Transfer'}</span>
                <span className={w.ageHours >= a.backlog.targetHours ? 'text-warning-strong' : 'text-ink-muted'}>{w.ageHours} hours</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {a.cash && (
        <Card title="Cash by collector and day" hint="What each collector was expected to bring in, what they recorded, what they handed in, and what the office counted.">
          {a.cash.length === 0 ? (
            <p className="text-sm text-ink-muted">No handovers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Day</th>
                    <th className="py-2 pr-4 font-medium">Collector</th>
                    <th className="py-2 pr-4 text-right font-medium">Expected</th>
                    <th className="py-2 pr-4 text-right font-medium">Collected</th>
                    <th className="py-2 pr-4 text-right font-medium">Handed in</th>
                    <th className="py-2 pr-4 text-right font-medium">Counted</th>
                    <th className="py-2 pr-4 text-right font-medium">Difference</th>
                    <th className="py-2 font-medium">Counted by</th>
                  </tr>
                </thead>
                <tbody>
                  {a.cash.map((c) => (
                    <tr key={c.id} className="border-t border-line-soft">
                      <td className="py-2 pr-4">{formatDay(c.date)}</td>
                      <td className="py-2 pr-4">{c.collector}</td>
                      <td className="py-2 pr-4 text-right"><Money kobo={c.expectedKobo} /></td>
                      <td className="py-2 pr-4 text-right"><Money kobo={c.collectedKobo} /></td>
                      <td className="py-2 pr-4 text-right"><Money kobo={c.handedOverKobo} /></td>
                      <td className="py-2 pr-4 text-right">{c.countedKobo === null ? 'Not counted' : <Money kobo={c.countedKobo} />}</td>
                      <td className="py-2 pr-4 text-right">{BigInt(c.differenceKobo) === BigInt(0) ? 'None' : formatKobo(c.differenceKobo)}</td>
                      <td className="py-2">{c.reconciledBy ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card title="Exceptions" hint="Reversals, waived fees, payout-order changes, rule changes and payouts that were voided or reversed, each with its reason and who did it.">
        {a.exceptions.length === 0 ? (
          <AjoEmpty title="No exceptions." hint="Nothing has been reversed, waived or changed." />
        ) : (
          <ul className="divide-y divide-line-soft text-sm">
            {a.exceptions.map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-2">
                <p className="text-ink">{e.text}</p>
                <p className="text-xs text-ink-muted">{formatMoment(e.at)}{e.by ? ` · ${e.by}` : ''}{e.reason ? ` · reason: ${e.reason}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
