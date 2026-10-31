'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { frequencyText, MODEL_LABEL, formatDay, formatKobo, koboPositive, ordinal } from '@/lib/ajo/format';
import type { MyMembershipDTO } from '@/lib/ajo/types';
import { useAjoAccess } from './AjoGate';
import { Money } from './Money';
import { StatusBadge } from './StatusBadge';

/** One of the person's groups: what is owed, what is next, and where they stand in the payout order. */
export function MembershipCard({ item }: { item: MyMembershipDTO }) {
  const { canWrite } = useAjoAccess();
  const { group } = item;
  const owes = koboPositive(item.totalOwedKobo);
  const overdue = koboPositive(item.overdueKobo);
  const base = `/dashboard/my-thrift/${item.membershipId}`;

  return (
    <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={base} className="text-lg font-semibold text-ink hover:underline">
            {group.name}
          </Link>
          <p className="mt-1 text-sm text-ink-muted">
            {MODEL_LABEL[group.model]} · {frequencyText(group)} · {formatKobo(item.amountKobo ?? group.contributionKobo)}
            {item.shares > 1 ? ` × ${item.shares} shares` : ''}
          </p>
        </div>
        <StatusBadge status={item.status === 'ACTIVE' ? group.status : item.status} />
      </div>

      {item.waitingFor.length > 0 && (
        <div className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
          <p className="font-medium">Before you can start, the circle is waiting for:</p>
          <ul className="mt-1 list-disc pl-5">
            {item.waitingFor.map((w) => (
              <li key={w.requirement}>{w.text}</li>
            ))}
          </ul>
          {item.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE') && (
            <Button component={Link} href={`${base}/rules`} color="green" size="sm" className="mt-3">
              Read and accept the rules
            </Button>
          )}
        </div>
      )}

      {item.status === 'ACTIVE' && (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-faint">Overdue</dt>
            <dd className={`text-lg font-semibold ${overdue ? 'text-danger' : ''}`}>
              <Money kobo={item.overdueKobo} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Next payment</dt>
            <dd className="text-lg font-semibold">
              {item.nextDue ? (
                <>
                  <Money kobo={item.nextDue.remainingKobo} />
                  <span className="block text-xs font-normal text-ink-faint">due {formatDay(item.nextDue.dueDate)}</span>
                </>
              ) : (
                <span className="text-sm font-normal text-ink-faint">Nothing coming up</span>
              )}
            </dd>
          </div>
          {group.model === 'ROTATING_POT' && (
            <div>
              <dt className="text-xs text-ink-faint">Your turn to collect</dt>
              <dd className="text-lg font-semibold">
                {item.payoutPositions.length ? item.payoutPositions.map(ordinal).join(', ') : <span className="text-sm font-normal text-ink-faint">Not drawn yet</span>}
                {item.rounds ? <span className="block text-xs font-normal text-ink-faint">of {item.rounds} rounds</span> : null}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button component={Link} href={base} variant="light" size="sm">
          Open
        </Button>
        {canWrite && item.status === 'ACTIVE' && owes && (
          <Button component={Link} href={`${base}/pay`} size="sm" color="green">
            Pay
          </Button>
        )}
      </div>
    </article>
  );
}
