'use client';

import Link from 'next/link';
import { MembershipCard } from '@/components/ajo/MembershipCard';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { useMyMemberships, useVerification } from '@/lib/ajo/hooks';

/** THM1 (my groups, next due, payout position) with THM9 (where SocietyLedger's check of me stands). */
export default function MyThriftPage() {
  const mine = useMyMemberships();
  const verification = useVerification();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Thrift</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">Your savings groups, what you owe and when you collect.</p>
      </div>

      {verification.data && verification.data.status !== 'VERIFIED' && (
        <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700" aria-label="Verification">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your payout check</h2>
            <StatusBadge status={verification.data.status} />
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {verification.data.status === 'REJECTED'
              ? `SocietyLedger could not verify you: ${verification.data.rejectionReason ?? 'no reason was given'}. Fix it on your payout account and tell your group officer.`
              : verification.data.status === 'PENDING'
                ? 'SocietyLedger is checking your details. You can pay in as usual; you can only be paid out once this is done.'
                : 'To be paid out you need a payout account, and SocietyLedger checks it first.'}{' '}
            <Link href="/dashboard/my-thrift/payout-account" className="font-medium text-green-700 underline dark:text-green-400">
              Go to my payout account
            </Link>
          </p>
        </section>
      )}

      {mine.isLoading ? (
        <AjoLoading />
      ) : mine.isError ? (
        <AjoError error={mine.error} onRetry={() => mine.refetch()} />
      ) : mine.data && mine.data.length > 0 ? (
        <div className="space-y-4">
          {mine.data.map((item) => (
            <MembershipCard key={item.membershipId} item={item} />
          ))}
        </div>
      ) : (
        <AjoEmpty title="You are not in any savings group yet." hint="When a group officer adds you, it will show here and you will be told what to do next." />
      )}
    </div>
  );
}
