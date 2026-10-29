import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { CircleBoard } from '@/features/ajo/components/board/CircleBoard';
import { AJO_MEMBER_ACCESS, useMyMemberships } from '@/features/ajo/queries';

/** The Circle board for a member of a rotating pot, opened from the circle page (an association member's way in; spec §16.4). */
export default function MemberCircleBoardScreen() {
  const params = useLocalSearchParams<{ membershipId?: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);

  return (
    <AjoScreen title="Circle board" access={AJO_MEMBER_ACCESS}>
      {mine.isPending ? <AjoLoading /> : item ? <CircleBoard groupId={item.group.id} /> : <EmptyState title="We could not find that circle." description="It may not be one of yours." />}
    </AjoScreen>
  );
}
