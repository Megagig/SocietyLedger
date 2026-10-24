import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { ResultBar } from '@/features/electionsManage/components/Rows';
import { ELECTION_ADMIN_ACCESS } from '@/features/electionsManage/labels';
import { useElectionResults, VOTING_MODULE } from '@/features/electionsManage/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { CandidateResultDTO } from '@/types/api/electionsManage';

function Standings({ rows, winner, tied, abstentions }: { rows: CandidateResultDTO[]; winner?: CandidateResultDTO; tied: CandidateResultDTO[]; abstentions: number }) {
  return (
    <View className="gap-4">
      {tied.length > 1 ? (
        <View className="rounded-lg bg-warning-soft p-4" testID="results-tie">
          <Text variant="body">{`${tied.map((c) => c.memberName).join(' and ')} have the same number of votes, so there is no winner yet. The committee decides what happens next.`}</Text>
        </View>
      ) : null}
      {rows.map((row) => (
        <ResultBar key={row.candidateId} row={row} winner={winner?.candidateId === row.candidateId} tied={tied.some((t) => t.candidateId === row.candidateId)} />
      ))}
      {abstentions > 0 ? (
        <Text variant="caption" tone="secondary">{`${abstentions} ${abstentions === 1 ? 'member abstained' : 'members abstained'}`}</Text>
      ) : null}
    </View>
  );
}

/**
 * project-overview.md §6.10 GV9 — the result of an election: turnout, whether the minimum turnout was met, and who won each position.
 * The committee can read it as soon as voting closes; members only once it is published. A tie has no winner.
 */
export default function ElectionResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(ELECTION_ADMIN_ACCESS, VOTING_MODULE);
  const query = useElectionResults(id, allowed);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Results" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const results = query.data;

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader title="Results" onBack={back} docsKey="GV9" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={90} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !results ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-1">
            <Text variant="h1">{results.electionTitle}</Text>
            <Text variant="caption" tone="secondary">
              {results.published ? 'Published to every member' : 'Not published yet — only the Election Committee can see this'}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <StatTile label="Turnout" value={`${results.voterTurnout}%`} tone="info" testID="results-turnout" />
            <StatTile label="Members who voted" value={`${results.totalVotesCast} of ${results.totalEligibleVoters}`} tone="success" />
            <StatTile
              label="Minimum turnout"
              value={!results.requiresQuorum ? 'Not needed' : results.quorumMet ? 'Met' : 'Not met'}
              tone={!results.requiresQuorum || results.quorumMet ? 'primary' : 'warning'}
              testID="results-quorum"
            />
          </View>

          {results.positions.map((position) => (
            <Section key={position.positionId} title={position.positionTitle}>
              <Standings rows={position.candidates} winner={position.winner} tied={position.tied} abstentions={position.abstentions} />
            </Section>
          ))}

          {results.generalResults && results.generalResults.length > 0 ? (
            <Section title="Candidates">
              <Standings rows={results.generalResults} winner={results.generalWinner} tied={results.generalTied} abstentions={results.generalAbstentions} />
            </Section>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
