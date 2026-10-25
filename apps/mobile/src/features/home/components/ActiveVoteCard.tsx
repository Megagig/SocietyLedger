import { Pressable, View } from 'react-native';
import { Vote } from 'lucide-react-native';
import type { UseQueryResult } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ActiveVotingItemsDTO } from '@/types/api/voting';

export type ActiveVoteCardProps = {
  query: UseQueryResult<ActiveVotingItemsDTO, unknown>;
  canView: boolean;
  onPressElection: (electionId: number) => void;
  onPressPoll: (pollId: number) => void;
};

/** H1's "Active vote/poll card" — a preview of C5–C10 (Community tab, F3.5/F3.6), which don't
 * exist yet. Shows the single most time-sensitive item (soonest-closing election, else soonest
 * poll); degrades silently when there's nothing active or the user lacks `ELECTION_VIEW`, same
 * reasoning as `UpcomingMeetingCard`. */
export function ActiveVoteCard({ query, canView, onPressElection, onPressPoll }: ActiveVoteCardProps) {
  const { color } = useThemeTokens();

  if (!canView) return null;
  if (query.isPending) return <Skeleton width="100%" height={88} radius="lg" />;
  // Silent degrade on error — see UpcomingMeetingCard for the rationale.
  if (query.isError) return null;

  const election = query.data?.activeElections[0];
  const poll = query.data?.activePolls[0];
  if (!election && !poll) return null;

  const item = election
    ? { title: election.title, endDate: election.votingEndDate, onPress: () => onPressElection(election.id) }
    : { title: poll!.title, endDate: poll!.endDate, onPress: () => onPressPoll(poll!.id) };

  return (
    <Pressable onPress={item.onPress} testID="home-active-vote">
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-accent-soft">
            <Vote size={20} color={color.accent} strokeWidth={1.75} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body-strong" numberOfLines={1}>
              {item.title}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {t('home.vote.closes', { date: formatDate(item.endDate, 'short') })}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
