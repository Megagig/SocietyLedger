import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { IconCircle } from '@/components/ui/IconCircle';
import { AjoLoading } from '@/features/ajo/components/AjoStates';
import { AjoScreen } from '@/features/ajo/components/AjoScreen';
import { CircleBoard } from '@/features/ajo/components/board/CircleBoard';
import { formatKobo, frequencyText } from '@/features/ajo/format';
import { AJO_MEMBER_ACCESS, AJO_STAFF_ACCESS, useRotatingCircles } from '@/features/ajo/queries';

/**
 * The Circle tab of a standalone rotating pot (spec §16.4): the board for the person's circle, or a list to pick from when they are
 * in several. A standalone group has no Community, so this is where its members see how the circle is doing.
 */
export default function CircleTabScreen() {
  const router = useRouter();
  const mine = useRotatingCircles();
  const circles = mine.circles;
  const only = circles.length === 1 ? circles[0] : undefined;

  return (
    <AjoScreen title={only ? only.name : 'Circle'} access={[...AJO_MEMBER_ACCESS, ...AJO_STAFF_ACCESS]} refreshing={mine.isRefetching} onRefresh={() => void mine.refetch()}>
      {mine.isPending ? (
        <AjoLoading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
      ) : only ? (
        <CircleBoard groupId={only.id} />
      ) : circles.length === 0 ? (
        <EmptyState icon={Users} title="No rotating pot yet." description="When a rotating pot is created, or an officer adds you to one, how the whole circle is doing shows here." />
      ) : (
        <ListGroup>
          {circles.map((g) => (
            <ListItem
              key={g.id}
              leading={<IconCircle icon={Users} tone="primary" />}
              title={g.name}
              meta={`${frequencyText(g)} · ${formatKobo(g.contributionKobo)}`}
              showChevron
              onPress={() => router.push(`/(app)/(tabs)/circle/${g.id}` as never)}
              testID={`circle-open-${g.id}`}
            />
          ))}
        </ListGroup>
      )}
    </AjoScreen>
  );
}
