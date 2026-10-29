'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { SavingsView } from '@/components/ajo/savings/SavingsView';
import { useMyMemberships } from '@/lib/ajo/hooks';

/** A collector-thrift saver's own view of their savings (spec §16.6): where they stand, where their cash is, and what they will get back. */
export default function MySavingsPage() {
  const params = useParams<{ membershipId: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);

  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!item) return <AjoEmpty title="We could not find that circle." hint="It may not be one of yours." />;
  if (item.group.model !== 'COLLECTOR_THRIFT') return <AjoEmpty title="Savings are for collector-thrift groups." hint="A rotating pot shows the circle board instead." />;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/my-thrift/${membershipId}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> {item.group.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">My savings</h1>
        <p className="mt-1 text-ink-muted">Every naira you have given, where your cash is, and what you will get back. Only you and the group&apos;s officers can see this page.</p>
      </div>
      <SavingsView membershipId={membershipId} />
    </div>
  );
}
