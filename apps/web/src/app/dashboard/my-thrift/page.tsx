'use client';

import Link from 'next/link';
import { MembershipCard } from '@/components/ajo/MembershipCard';
import { MyPayouts } from '@/components/ajo/member/MyPayouts';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { useMyMemberships, useVerification } from '@/lib/ajo/hooks';

/** THM1 (my circles, next due, payout position) with THM9 (where SocietyLedger's check of me stands). */
export default function MyThriftPage() {
  const mine = useMyMemberships();
  const verification = useVerification();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">My Thrift</h1>
        <p className="mt-1 text-ink-muted">Your savings circles, what you owe and when you collect.</p>
        <p className="mt-2 text-sm">
          <Link href="/dashboard/my-thrift/notifications" className="font-medium text-success-link underline">Circle notifications</Link>
        </p>
      </div>

      {verification.data && verification.data.status !== 'VERIFIED' && (
        <section className="rounded-lg border border-line p-4" aria-label="Verification">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-ink">Your payout check</h2>
            <StatusBadge status={verification.data.status} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {verification.data.status === 'REJECTED'
              ? `SocietyLedger could not verify you: ${verification.data.rejectionReason ?? 'no reason was given'}. Fix it on your payout account and tell your circle officer.`
              : verification.data.status === 'PENDING'
                ? 'SocietyLedger is checking your details. You can pay in as usual; you can only be paid out once this is done.'
                : 'To be paid out you need a payout account, and SocietyLedger checks it first.'}{' '}
            <Link href="/dashboard/my-thrift/payout-account" className="font-medium text-success-link underline">
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
        <AjoEmpty title="You are not in any savings circle yet." hint="When an officer adds you, it will show here and you will be told what to do next." />
      )}

      <MyPayouts />
    </div>
  );
}
