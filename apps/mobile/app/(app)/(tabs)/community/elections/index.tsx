import { useRouter } from 'expo-router';
import { BarChart2, ClipboardCheck, Vote } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ListItem } from '@/components/layout/ListItem';
import { TurnoutCard } from '@/features/voting/components/TurnoutCard';
import { IneligibleNote } from '@/features/electionsManage/components/EligibilityCards';
import { SectionCard } from '@/components/layout/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { computeVotingStats } from '@/features/voting/stats';
import {
  useActiveVoting,
  useElections,
  usePolls,
  useVoterStatuses,
  useVotingHistoryElections,
} from '@/features/voting/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { useThemeTokens } from '@/providers/ThemeProvider';

function RowSkeleton() {
  return (
    <View className="gap-2 px-4 py-3">
      <Skeleton width="70%" height={16} />
      <Skeleton width="45%" height={12} />
    </View>
  );
}

/** project-overview.md §6.5 C5 — "My Voting": active elections + polls, voting history, participation stats (web `member/my-voting`). */
export default function VotingScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const canElections = useCan('ELECTION_VIEW');
  const canPolls = useCan('POLL_VIEW');
  const canNominate = useCan('ELECTION_NOMINATE');
  const memberId = useMemberId();
  const locked = useModuleDisabled('voting');

  const activeQuery = useActiveVoting();
  const pollsQuery = usePolls({ status: 'ACTIVE', limit: 20 });
  const nominationsQuery = useElections({ status: 'NOMINATIONS_OPEN', limit: 10 });
  const historyQuery = useVotingHistoryElections();

  const activeElections = activeQuery.data?.activeElections ?? [];
  const activePolls = pollsQuery.data?.polls ?? [];
  const nominations = canNominate ? (nominationsQuery.data?.elections ?? []) : [];
  const history = historyQuery.data?.elections ?? [];
  const voterStatuses = useVoterStatuses(history.map((e) => e.id));
  const historyLoading = historyQuery.isPending || voterStatuses.some((q) => q.isPending && q.fetchStatus !== 'idle');
  const stats = computeVotingStats(history.length, voterStatuses.map((q) => q.data?.hasVoted));

  const refreshing = activeQuery.isRefetching || pollsQuery.isRefetching || historyQuery.isRefetching;
  const refetchAll = () => {
    activeQuery.refetch();
    pollsQuery.refetch();
    nominationsQuery.refetch();
    historyQuery.refetch();
  };

  if (locked) return <ModuleLockedScreen title="Voting" moduleName="Voting" onBack={() => router.back()} />;

  const goElection = (id: number) => router.push(`/(app)/(tabs)/community/elections/${id}` as never);
  const goPoll = (id: number) => router.push(`/(app)/(tabs)/community/polls/${id}` as never);

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Voting" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={color.primary} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="gap-4">
          <Text variant="body" tone="secondary">
            Participate in elections and polls
          </Text>

          {canElections && (
            <SectionCard title="Active elections" trailing={<Badge tone="success">{`${activeElections.length} Active`}</Badge>}>
              {activeQuery.isPending ? (
                <RowSkeleton />
              ) : activeElections.length > 0 ? (
                activeElections.map((election) => (
                  <View key={election.id}>
                    <ListItem
                      leading={<IconCircle icon={Vote} tone="success" />}
                      title={election.title}
                      meta={`Ends ${format(new Date(election.votingEndDate), 'd MMM yyyy')}`}
                      showChevron
                      onPress={() => goElection(election.id)}
                    />
                    <View className="gap-3 px-4 pb-4">
                      <IneligibleNote electionId={election.id} />
                      <TurnoutCard electionId={election.id} compact />
                    </View>
                  </View>
                ))
              ) : (
                <InlineEmpty icon={Vote} message="No active elections at the moment" />
              )}
            </SectionCard>
          )}

          {nominations.length > 0 && (
            <SectionCard title="Open for nominations" trailing={<Badge tone="warning">{`${nominations.length} Open`}</Badge>}>
              {nominations.map((election) => (
                <ListItem
                  key={election.id}
                  leading={<IconCircle icon={Vote} tone="warning" />}
                  title={election.title}
                  meta={
                    election.nominationEndDate
                      ? `Nominations close ${format(new Date(election.nominationEndDate), 'd MMM yyyy')}`
                      : 'Nominations open'
                  }
                  showChevron
                  onPress={() => goElection(election.id)}
                />
              ))}
            </SectionCard>
          )}

          {canPolls && (
            <SectionCard title="Active polls" trailing={<Badge tone="info">{`${activePolls.length} Active`}</Badge>}>
              {pollsQuery.isPending ? (
                <RowSkeleton />
              ) : activePolls.length > 0 ? (
                activePolls.map((poll) => (
                  <ListItem
                    key={poll.id}
                    leading={<IconCircle icon={BarChart2} tone="info" />}
                    title={poll.title}
                    meta={`Closes ${format(new Date(poll.endDate), 'd MMM yyyy')} · ${poll._count.responses} response${poll._count.responses === 1 ? '' : 's'}`}
                    showChevron
                    onPress={() => goPoll(poll.id)}
                  />
                ))
              ) : (
                <InlineEmpty icon={BarChart2} message="No active polls at the moment" />
              )}
            </SectionCard>
          )}

          {canElections && (
            <>
              <SectionCard title="My voting history">
                {historyLoading ? (
                  <RowSkeleton />
                ) : history.length > 0 ? (
                  history.map((election, i) => {
                    const hasVoted = voterStatuses[i]?.data?.hasVoted;
                    return (
                      <ListItem
                        key={election.id}
                        leading={<IconCircle icon={ClipboardCheck} tone={hasVoted ? 'success' : 'neutral'} />}
                        title={election.title}
                        meta={`Closed ${format(new Date(election.votingEndDate), 'd MMM yyyy')}`}
                        trailing={
                          memberId === undefined ? undefined : hasVoted ? (
                            <StatusChip status="confirmed" label="Voted" />
                          ) : (
                            <StatusChip status="inactive" label="Did not vote" />
                          )
                        }
                        onPress={() => goElection(election.id)}
                      />
                    );
                  })
                ) : (
                  <InlineEmpty icon={ClipboardCheck} message="No voting history yet" />
                )}
              </SectionCard>

              <View className="flex-row gap-3">
                <StatTile label="Elections participated" value={String(stats.participated)} tone="primary" />
                <StatTile label="Elections available" value={String(stats.available)} tone="info" />
                <StatTile label="Participation rate" value={`${stats.participationRate}%`} tone="success" />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
