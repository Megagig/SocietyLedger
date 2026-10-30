'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { formatDay, formatMoment } from '@/lib/ajo/format';
import { useContributions, useMyMemberships } from '@/lib/ajo/hooks';
import type { MyMembershipDTO } from '@/lib/ajo/types';

const STATUS_WORDS: Record<string, string> = { REPORTED: 'Reported, waiting to be confirmed', CASH_RECEIVED: 'Cash recorded, waiting to be counted', CONFIRMED: 'Confirmed', REJECTED: 'Turned down', REVERSED: 'Reversed' };

function CirclePayments({ item, canWrite }: { item: MyMembershipDTO; canWrite: boolean }) {
  const payments = useContributions(item.membershipId);
  const running = item.status === 'ACTIVE' && item.group.status === 'ACTIVE';
  return (
    <section className="space-y-3 rounded-lg border border-line p-4" aria-label={item.group.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">{item.group.name}</h2>
          <p className="text-sm text-ink-muted">
            {item.nextDue ? (
              <>
                Next payment <Money kobo={item.nextDue.remainingKobo} /> due {formatDay(item.nextDue.dueDate)}
              </>
            ) : (
              'Nothing coming up'
            )}
            {Number(item.overdueKobo) > 0 && (
              <>
                {' · '}
                <span className="text-danger">
                  Overdue <Money kobo={item.overdueKobo} />
                </span>
              </>
            )}
          </p>
        </div>
        {running && canWrite ? (
          <Button component={Link} href={`/dashboard/my-thrift/${item.membershipId}/pay`} color="green">
            Report a payment
          </Button>
        ) : null}
      </div>
      {!running && (
        <p className="rounded-md bg-info-soft p-3 text-sm text-info-text">
          {item.status !== 'ACTIVE'
            ? 'You can pay once you have been approved. The circle’s officers will tell you when.'
            : item.group.status === 'ACTIVE'
              ? 'Payments are paused.'
              : `Payments open when ${item.group.name} starts on ${formatDay(item.group.startDate)}.`}
        </p>
      )}
      {running && (
        <p className="text-xs text-ink-muted">
          Pay into the circle&apos;s bank account, then report it here with your slip. It counts once an officer has confirmed it against the bank statement.
        </p>
      )}
      {payments.isLoading ? (
        <AjoLoading />
      ) : payments.data && payments.data.length > 0 ? (
        <ul className="divide-y divide-line-soft rounded-md border border-line">
          {payments.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink">
                  <Money kobo={p.amountKobo} /> · {p.method === 'CASH' ? 'Cash to collector' : 'Bank transfer'}
                </p>
                <p className="text-xs text-ink-muted">
                  {formatMoment(p.receivedAt)}
                  {p.recordedByOfficer ? ' · recorded by an officer from the bank' : ''}
                  {p.reason ? ` · ${p.reason}` : ''}
                </p>
              </div>
              <StatusBadge status={p.status} label={STATUS_WORDS[p.status] ?? p.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No payments yet.</p>
      )}
    </section>
  );
}

/** Every circle I am in: what I owe, how to pay and report it with a slip, and each payment with where it stands. */
export default function MyPaymentsPage() {
  const mine = useMyMemberships();
  const { canWrite } = useAjoAccess();
  const circles = (mine.data ?? []).filter((m) => m.status !== 'LEFT');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">My payments</h1>
        <p className="mt-1 text-ink-muted">Report what you paid with your slip, and see where each payment stands.</p>
      </div>
      {mine.isLoading ? (
        <AjoLoading />
      ) : mine.isError ? (
        <AjoError error={mine.error} onRetry={() => mine.refetch()} />
      ) : circles.length > 0 ? (
        circles.map((c) => <CirclePayments key={c.membershipId} item={c} canWrite={canWrite} />)
      ) : (
        <AjoEmpty title="You are not in a circle yet." hint="When an officer adds you, you can pay and report payments here." />
      )}
    </div>
  );
}
