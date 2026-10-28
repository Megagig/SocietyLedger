'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { DisputeDialog } from '@/components/ajo/DisputeDialog';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { FREQUENCY_LABEL, MODEL_LABEL, formatDay, formatKobo, formatMoment, koboPositive, ordinal } from '@/lib/ajo/format';
import { useContributions, useDisputes, useLateFees, useMyMemberships, useSchedule, useTrust } from '@/lib/ajo/hooks';
import type { InstallmentDTO } from '@/lib/ajo/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  );
}

/** THM2 (schedule, my payments, rules), with THM7 (my trust score) and THM8 (raise a dispute). */
export default function MembershipDetailPage() {
  const params = useParams<{ membershipId: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const { canWrite } = useAjoAccess();
  const mine = useMyMemberships();
  const schedule = useSchedule(membershipId);
  const payments = useContributions(membershipId);
  const fees = useLateFees(membershipId);
  const trust = useTrust(membershipId);
  const disputes = useDisputes(membershipId);
  const [disputing, setDisputing] = useState<InstallmentDTO | null>(null);

  const item = mine.data?.find((m) => m.membershipId === membershipId);
  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!item) return <AjoEmpty title="We could not find that group." hint="It may not be one of yours." action={<Link href="/dashboard/my-thrift" className="text-green-700 underline">Back to my groups</Link>} />;

  const openDispute = new Set((disputes.data ?? []).filter((d) => d.status === 'OPEN').map((d) => d.installmentId));
  const base = `/dashboard/my-thrift/${membershipId}`;
  const owes = koboPositive(item.totalOwedKobo);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/my-thrift" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline dark:text-gray-400">
          <IconArrowLeft size={14} /> My groups
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{item.group.name}</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              {MODEL_LABEL[item.group.model]} · {FREQUENCY_LABEL[item.group.frequency]} · {formatKobo(item.group.contributionKobo)}
              {item.shares > 1 ? ` × ${item.shares} shares` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button component={Link} href={`${base}/rules`} variant="default" size="sm">
              Group rules
            </Button>
            {canWrite && item.status === 'ACTIVE' && owes && (
              <Button component={Link} href={`${base}/pay`} color="green" size="sm">
                Pay
              </Button>
            )}
          </div>
        </div>
        {item.group.model === 'ROTATING_POT' && item.payoutPositions.length > 0 && (
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">You collect {item.payoutPositions.map(ordinal).join(' and ')}{item.rounds ? ` of ${item.rounds} rounds` : ''}.</p>
        )}
      </div>

      <Section title="Your schedule">
        {schedule.isLoading ? (
          <AjoLoading rows={4} />
        ) : schedule.isError ? (
          <AjoError error={schedule.error} onRetry={() => schedule.refetch()} />
        ) : schedule.data && schedule.data.installments.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['To pay in all', schedule.data.totals.expectedKobo],
                ['Paid so far', schedule.data.totals.paidKobo],
                ['Still to pay', schedule.data.totals.remainingKobo],
              ].map(([label, kobo]) => (
                <div key={label} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className="text-xl font-semibold"><Money kobo={kobo} /></p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Due</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 text-right font-medium">Paid</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {schedule.data.installments.map((i) => {
                    const unpaid = i.status === 'OVERDUE' || i.status === 'PARTIAL' || i.status === 'DUE';
                    return (
                      <tr key={i.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-4 py-2">{formatDay(i.dueDate)}</td>
                        <td className="px-4 py-2 text-right"><Money kobo={i.amountKobo} /></td>
                        <td className="px-4 py-2 text-right"><Money kobo={i.paidKobo} /></td>
                        <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                        <td className="px-4 py-2 text-right">
                          {openDispute.has(i.id) ? (
                            <span className="text-xs text-gray-500">Claim sent</span>
                          ) : canWrite && unpaid && new Date(i.dueDate).getTime() < Date.now() ? (
                            <Button variant="subtle" size="compact-xs" onClick={() => setDisputing(i)}>
                              I already paid this
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <AjoEmpty title="No payments are scheduled yet." hint="Your schedule appears once the group has started." />
        )}
      </Section>

      <Section title="Your payments">
        {payments.isLoading ? (
          <AjoLoading rows={2} />
        ) : payments.isError ? (
          <AjoError error={payments.error} onRetry={() => payments.refetch()} />
        ) : payments.data && payments.data.length > 0 ? (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {payments.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium"><Money kobo={p.amountKobo} /> <span className="font-normal text-gray-500">by {p.method === 'CASH' ? 'cash' : 'bank transfer'}</span></p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatMoment(p.receivedAt)}
                    {p.reversed && p.reversalReason ? ` · reversed: ${p.reversalReason}` : ''}
                    {p.status === 'REJECTED' && p.reason ? ` · turned down: ${p.reason}` : ''}
                  </p>
                </div>
                <StatusBadge status={p.reversed ? 'REVERSED' : p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <AjoEmpty title="You have not paid anything yet." />
        )}
      </Section>

      {fees.data && fees.data.length > 0 && (
        <Section title="Late fees">
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {fees.data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium"><Money kobo={f.feeKobo} /></p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{f.calculation?.text ?? ''}</p>
                  {f.status === 'PENDING' && <p className="text-xs text-gray-500">You are told first. It only becomes payable 48 hours after you have been told.</p>}
                  {f.status === 'WAIVED' && f.waivedReason && <p className="text-xs text-gray-500">Waived: {f.waivedReason}</p>}
                </div>
                <StatusBadge status={f.status} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your trust score">
        {trust.isLoading ? (
          <AjoLoading rows={1} />
        ) : trust.isError ? (
          <AjoError error={trust.error} onRetry={() => trust.refetch()} />
        ) : trust.data ? (
          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <StatusBadge status={trust.data.band} />
              {trust.data.onTimePercent !== null && <span className="text-2xl font-semibold tabular-nums">{trust.data.onTimePercent}%</span>}
            </div>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{trust.data.text}</p>
            <p className="mt-1 text-xs text-gray-500">It looks at how many of your payments in the last 12 months were made on time, across your groups. It never stops you from joining or being paid.</p>
          </div>
        ) : null}
      </Section>

      {disputes.data && disputes.data.length > 0 && (
        <Section title="Your claims">
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {disputes.data.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{formatMoment(d.createdAt)}</p>
                  <StatusBadge status={d.outcome === 'OPEN' ? 'PENDING' : d.outcome} label={d.outcome === 'OPEN' ? 'With the officers' : undefined} />
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{d.claim}</p>
                {d.resolution && <p className="mt-1 text-xs text-gray-500">Decision: {d.resolution}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <DisputeDialog membershipId={membershipId} installment={disputing} onClose={() => setDisputing(null)} />
    </div>
  );
}
