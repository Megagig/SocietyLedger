'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { FREQUENCY_LABEL, MODEL_LABEL, formatDay, formatKobo, koboPositive, ordinal } from '@/lib/ajo/format';
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
    <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={base} className="text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100">
            {group.name}
          </Link>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {MODEL_LABEL[group.model]} · {FREQUENCY_LABEL[group.frequency]} · {formatKobo(group.contributionKobo)}
            {item.shares > 1 ? ` × ${item.shares} shares` : ''}
          </p>
        </div>
        <StatusBadge status={item.status === 'ACTIVE' ? group.status : item.status} />
      </div>

      {item.waitingFor.length > 0 && (
        <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">
          <p className="font-medium">Before you can start, the group is waiting for:</p>
          <ul className="mt-1 list-disc pl-5">
            {item.waitingFor.map((w) => (
              <li key={w.requirement}>{w.text}</li>
            ))}
          </ul>
        </div>
      )}

      {item.status === 'ACTIVE' && (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Overdue</dt>
            <dd className={`text-lg font-semibold ${overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
              <Money kobo={item.overdueKobo} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Next payment</dt>
            <dd className="text-lg font-semibold">
              {item.nextDue ? (
                <>
                  <Money kobo={item.nextDue.remainingKobo} />
                  <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">due {formatDay(item.nextDue.dueDate)}</span>
                </>
              ) : (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Nothing coming up</span>
              )}
            </dd>
          </div>
          {group.model === 'ROTATING_POT' && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Your turn to collect</dt>
              <dd className="text-lg font-semibold">
                {item.payoutPositions.length ? item.payoutPositions.map(ordinal).join(', ') : <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Not drawn yet</span>}
                {item.rounds ? <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">of {item.rounds} rounds</span> : null}
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
