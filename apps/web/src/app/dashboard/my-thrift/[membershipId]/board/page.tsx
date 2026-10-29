'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { CircleBoard } from '@/components/ajo/board/CircleBoard';
import { useMyMemberships } from '@/lib/ajo/hooks';

/** The Circle board for a member of a rotating pot (spec §16.4): the whole circle's progress, in one place. */
export default function MemberCircleBoardPage() {
  const params = useParams<{ membershipId: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);

  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!item) return <AjoEmpty title="We could not find that circle." hint="It may not be one of yours." />;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/my-thrift/${membershipId}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> {item.group.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">Circle board</h1>
        <p className="mt-1 text-ink-muted">How the whole circle is doing: who has paid, who is next, and the circle&apos;s numbers.</p>
      </div>
      <CircleBoard groupId={item.group.id} />
    </div>
  );
}
