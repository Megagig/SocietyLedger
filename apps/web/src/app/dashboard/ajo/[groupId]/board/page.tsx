'use client';

import { useParams } from 'next/navigation';
import { CircleBoard } from '@/components/ajo/board/CircleBoard';

/** The same Circle board a member sees (spec §16.4), with the same figures. Officers always see names, whatever the circle's setting. */
export default function GroupBoardPage() {
  const params = useParams<{ groupId: string }>();
  return <CircleBoard groupId={Number(params.groupId) || 0} />;
}
