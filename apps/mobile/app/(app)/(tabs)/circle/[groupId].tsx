import { useLocalSearchParams } from 'expo-router';

import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { CircleBoard } from '@/features/ajo/components/board/CircleBoard';
import { AJO_MEMBER_ACCESS, useMyMemberships } from '@/features/ajo/queries';

/** One circle's board, opened from the Circle tab's list when the person is in more than one rotating pot. */
export default function CircleBoardScreen() {
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groupId = Number(params.groupId) || 0;
  const mine = useMyMemberships();
  const name = mine.data?.find((m) => m.group.id === groupId)?.group.name;

  return (
    <AjoScreen title={name ?? 'Circle'} access={AJO_MEMBER_ACCESS}>
      <CircleBoard groupId={groupId} />
    </AjoScreen>
  );
}
