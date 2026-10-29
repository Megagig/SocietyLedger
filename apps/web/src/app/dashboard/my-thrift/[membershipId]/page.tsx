'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { DisputeDialog } from '@/components/ajo/DisputeDialog';
import { CycleCard } from '@/components/ajo/member/CycleCard';
import { LeaveGroup, PhoneConfirmCard, ReceiptsDialog, SwapRequestCard } from '@/components/ajo/member/MemberExtras';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { frequencyText, MODEL_LABEL, formatDay, formatKobo, formatMoment, koboPositive, ordinal } from '@/lib/ajo/format';
import { useContributions, useDisputes, useLateFees, useMyMemberships, useSchedule, useTrust } from '@/lib/ajo/hooks';
import type { InstallmentDTO } from '@/lib/ajo/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
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
  const [receiptFor, setReceiptFor] = useState<number | null>(null);
  const router = useRouter();

  const item = mine.data?.find((m) => m.membershipId === membershipId);
  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!item) return <AjoEmpty title="We could not find that circle." hint="It may not be one of yours." action={<Link href="/dashboard/my-thrift" className="text-success-link underline">Back to my circles</Link>} />;

  const openDispute = new Set((disputes.data ?? []).filter((d) => d.status === 'OPEN').map((d) => d.installmentId));
  const base = `/dashboard/my-thrift/${membershipId}`;
  const owes = koboPositive(item.totalOwedKobo);
  const needsPhone = item.status === 'PENDING' && item.waitingFor.some((w) => w.requirement === 'PHONE_CONFIRMATION');

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/my-thrift" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> My circles
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-ink">{item.group.name}</h1>
            <p className="mt-1 text-ink-muted">
              {MODEL_LABEL[item.group.model]} · {frequencyText(item.group)} · {formatKobo(item.amountKobo ?? item.group.contributionKobo)}
              {item.shares > 1 ? ` × ${item.shares} shares` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {item.group.model === 'COLLECTOR_THRIFT' && item.status !== 'LEFT' && (
              <Button component={Link} href={`${base}/savings`} variant="default" size="sm">
                My savings
              </Button>
            )}
            {item.group.model === 'ROTATING_POT' && item.status !== 'LEFT' && (
              <Button component={Link} href={`${base}/board`} variant="default" size="sm">
                Circle board
              </Button>
            )}
            <Button component={Link} href={`${base}/rules`} variant="default" size="sm">
              Circle rules
            </Button>
            {canWrite && item.status === 'ACTIVE' && owes && (
              <Button component={Link} href={`${base}/pay`} color="green" size="sm">
                Pay
              </Button>
            )}
          </div>
        </div>
        {item.group.model === 'ROTATING_POT' && item.payoutPositions.length > 0 && (
          <p className="mt-2 text-sm text-ink-soft">You collect {item.payoutPositions.map(ordinal).join(' and ')}{item.rounds ? ` of ${item.rounds} rounds` : ''}.</p>
        )}
      </div>

      {needsPhone && canWrite && <PhoneConfirmCard membershipId={membershipId} />}
      {item.group.model === 'ROTATING_POT' && item.status !== 'LEFT' && <SwapRequestCard groupId={item.group.id} />}
      {item.group.model === 'COLLECTOR_THRIFT' && item.status !== 'LEFT' && <CycleCard membershipId={membershipId} />}

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
                <div key={label} className="rounded-lg border border-line p-4">
                  <p className="text-xs text-ink-faint">{label}</p>
                  <p className="text-xl font-semibold"><Money kobo={kobo} /></p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left text-ink-muted">
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
                      <tr key={i.id} className="border-t border-line-soft">
                        <td className="px-4 py-2">{formatDay(i.dueDate)}</td>
                        <td className="px-4 py-2 text-right"><Money kobo={i.amountKobo} /></td>
                        <td className="px-4 py-2 text-right"><Money kobo={i.paidKobo} /></td>
                        <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                        <td className="px-4 py-2 text-right">
                          {openDispute.has(i.id) ? (
                            <span className="text-xs text-ink-faint">Claim sent</span>
                          ) : canWrite && unpaid && i.pastDue ? (
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
          <AjoEmpty title="No payments are scheduled yet." hint="Your schedule appears once the circle has started." />
        )}
      </Section>

      <Section title="Your payments">
        {payments.isLoading ? (
          <AjoLoading rows={2} />
        ) : payments.isError ? (
          <AjoError error={payments.error} onRetry={() => payments.refetch()} />
        ) : payments.data && payments.data.length > 0 ? (
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {payments.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium"><Money kobo={p.amountKobo} /> <span className="font-normal text-ink-faint">by {p.method === 'CASH' ? 'cash' : 'bank transfer'}</span></p>
                  <p className="text-xs text-ink-faint">
                    {formatMoment(p.receivedAt)}
                    {p.reversed && p.reversalReason ? ` · reversed: ${p.reversalReason}` : ''}
                    {p.status === 'REJECTED' && p.reason ? ` · turned down: ${p.reason}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.counts && <Button variant="subtle" size="compact-xs" onClick={() => setReceiptFor(p.id)}>Receipt</Button>}
                  <StatusBadge status={p.reversed ? 'REVERSED' : p.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <AjoEmpty title="You have not paid anything yet." />
        )}
      </Section>

      {fees.data && fees.data.length > 0 && (
        <Section title="Late fees">
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {fees.data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium"><Money kobo={f.feeKobo} /></p>
                  <p className="text-xs text-ink-muted">{f.calculation?.text ?? ''}</p>
                  {f.status === 'PENDING' && <p className="text-xs text-ink-faint">You are told first. It only becomes payable 48 hours after you have been told.</p>}
                  {f.status === 'WAIVED' && f.waivedReason && <p className="text-xs text-ink-faint">Waived: {f.waivedReason}</p>}
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
          <div className="rounded-lg border border-line p-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={trust.data.band} />
              {trust.data.onTimePercent !== null && <span className="text-2xl font-semibold tabular-nums">{trust.data.onTimePercent}%</span>}
            </div>
            <p className="mt-2 text-sm text-ink-soft">{trust.data.text}</p>
            <p className="mt-1 text-xs text-ink-faint">It looks at how many of your payments in the last 12 months were made on time, across your circles. It never stops you from joining or being paid.</p>
          </div>
        ) : null}
      </Section>

      {disputes.data && disputes.data.length > 0 && (
        <Section title="Your claims">
          <ul className="divide-y divide-line-soft rounded-lg border border-line">
            {disputes.data.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{formatMoment(d.createdAt)}</p>
                  <StatusBadge status={d.outcome === 'OPEN' ? 'PENDING' : d.outcome} label={d.outcome === 'OPEN' ? 'With the officers' : undefined} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{d.claim}</p>
                {d.resolution && <p className="mt-1 text-xs text-ink-faint">Decision: {d.resolution}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <DisputeDialog membershipId={membershipId} installment={disputing} onClose={() => setDisputing(null)} />
      <ReceiptsDialog contributionId={receiptFor} onClose={() => setReceiptFor(null)} />
      {canWrite && <LeaveGroup membershipId={membershipId} groupName={item.group.name} onLeft={() => router.push('/dashboard/my-thrift')} />}
    </div>
  );
}
