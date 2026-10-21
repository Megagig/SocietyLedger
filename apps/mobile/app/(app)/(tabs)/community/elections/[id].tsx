import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner-native';
import { format } from 'date-fns';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useBulkCastVotes, useElectionDetail, useSelfNominate, useVoterStatuses } from '@/features/voting/queries';
import { t } from '@/lib/i18n';
import { useCan } from '@/hooks/useCan';
import type { ElectionPositionDTO } from '@/types/api/voting';

const nominateSchema = z.object({
  manifesto: z.string().max(5000).optional(),
});

type NominateFormValues = z.infer<typeof nominateSchema>;

type BallotState = Record<number, number | 'abstain'>;

function BallotPosition({
  position,
  selected,
  onSelect,
  onAbstain,
  allowAbstention,
}: {
  position: ElectionPositionDTO;
  selected: number | 'abstain' | undefined;
  onSelect: (candidateId: number) => void;
  onAbstain: () => void;
  allowAbstention: boolean;
}) {
  const { color } = useThemeTokens();
  return (
    <View className="rounded-xl border border-border bg-surface overflow-hidden">
      <View className="px-4 py-3 border-b border-border bg-surface-raised">
        <Text variant="label">{position.title}</Text>
      </View>
      {position.candidates.map((candidate) => {
        const isSelected = selected === candidate.id;
        return (
          <Pressable
            key={candidate.id}
            onPress={() => onSelect(candidate.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            android_ripple={{ color: `${color.primary}1F` }}
            className={['flex-row items-center gap-3 px-4 py-3 border-b border-border', isSelected ? 'bg-primary-soft' : ''].join(' ')}
          >
            <View className={['h-5 w-5 rounded-full border-2 items-center justify-center', isSelected ? 'border-primary' : 'border-border'].join(' ')}>
              {isSelected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </View>
            <View className="flex-1">
              <Text variant="body-strong">
                {candidate.member.firstName} {candidate.member.lastName}
              </Text>
              <Text variant="caption" tone="secondary">{candidate.member.memberId}</Text>
            </View>
            {candidate.voteCount > 0 && (
              <Text variant="caption" tone="tertiary">{candidate.voteCount} votes</Text>
            )}
          </Pressable>
        );
      })}
      {allowAbstention && (
        <Pressable
          onPress={onAbstain}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === 'abstain' }}
          android_ripple={{ color: `${color.primary}1F` }}
          className={['flex-row items-center gap-3 px-4 py-3', selected === 'abstain' ? 'bg-primary-soft' : ''].join(' ')}
        >
          <View className={['h-5 w-5 rounded-full border-2 items-center justify-center', selected === 'abstain' ? 'border-primary' : 'border-border'].join(' ')}>
            {selected === 'abstain' && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </View>
          <Text variant="body" tone="secondary">{t('elections.abstain')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** project-overview.md §6.5 C6 — Election detail with self-nominate and ballot. */
export default function ElectionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const electionId = id ? Number(id) : undefined;
  const { color } = useThemeTokens();

  const canNominate = useCan('ELECTION_NOMINATE');
  const canVote = useCan('ELECTION_VOTE');

  const query = useElectionDetail(electionId);
  const selfNominate = useSelfNominate();
  const bulkCastVotes = useBulkCastVotes();

  const [mode, setMode] = useState<'view' | 'nominate' | 'ballot'>('view');
  const [ballot, setBallot] = useState<BallotState>({});

  const nominateForm = useForm<NominateFormValues>({
    resolver: zodResolver(nominateSchema),
    defaultValues: { manifesto: '' },
  });

  const election = query.data;
  const [voterStatus] = useVoterStatuses(election && election.status === 'VOTING_OPEN' ? [election.id] : []);
  const hasVoted = voterStatus?.data?.hasVoted ?? false;

  function handleNominate(values: NominateFormValues) {
    if (!electionId) return;
    selfNominate.mutate(
      { electionId, payload: { manifesto: values.manifesto || undefined } },
      {
        onSuccess: () => {
          toast.success(t('elections.nominateSuccess'));
          setMode('view');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Nomination failed'),
      },
    );
  }

  function handleSubmitBallot() {
    if (!electionId || !election) return;
    const votes = election.positions.map((pos) => {
      const choice = ballot[pos.id];
      return {
        positionId: pos.id,
        candidateId: typeof choice === 'number' ? choice : null,
        isAbstention: choice === 'abstain',
      };
    });
    const allSelected = election.positions.every((pos) => ballot[pos.id] !== undefined);
    if (!allSelected) {
      toast.error('Please select a candidate or abstain for each position.');
      return;
    }
    bulkCastVotes.mutate(
      { electionId, payload: { votes } },
      {
        onSuccess: () => {
          toast.success(t('elections.voteSubmitted'));
          setMode('view');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Vote failed'),
      },
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => { if (mode !== 'view') setMode('view'); else router.back(); }} title="" />
        <View className="gap-4">
          <Skeleton width="70%" height={28} />
          <Skeleton width="50%" height={16} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  if (query.isError || !election) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader onBack={() => router.back()} title="" />
        <ErrorState onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const isActive = election.status === 'VOTING_OPEN';
  const isNominating = election.status === 'NOMINATIONS_OPEN';

  return (
    <Screen edges={['top', 'bottom']} scroll keyboard>
      <ScreenHeader
        title={mode === 'ballot' ? t('elections.ballotTitle') : mode === 'nominate' ? t('elections.nominate') : t('elections.title')}
        onBack={() => { if (mode !== 'view') setMode('view'); else router.back(); }}
      />

      {/* ----- VIEW MODE ----- */}
      {mode === 'view' && (
        <View className="gap-6">
          {/* Hero */}
          <View className="gap-2">
            <StatusChip status={election.status} />
            <Text variant="h2">{election.title}</Text>
            {election.description ? (
              <Text variant="body" tone="secondary">{election.description}</Text>
            ) : null}
            <Text variant="caption" tone="tertiary">
              Voting: {format(new Date(election.votingStartDate), 'd MMM')} – {format(new Date(election.votingEndDate), 'd MMM yyyy')}
            </Text>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <StatTile label="Eligible voters" value={String(election.eligibleVoterCount)} tone="info" />
            <StatTile label="Votes cast" value={String(election.totalVotesCast)} tone="success" />
            <StatTile label="Candidates" value={String(election._count.candidates)} tone="primary" />
          </View>

          {/* Positions + candidates */}
          {election.positions.length > 0 && (
            <Section title={t('elections.positionsSection')}>
              {election.positions.map((pos) => (
                <View key={pos.id} className="rounded-xl border border-border bg-surface overflow-hidden gap-0">
                  <View className="px-4 py-3 border-b border-border bg-surface-raised">
                    <Text variant="label">{pos.title}</Text>
                  </View>
                  {pos.candidates.map((candidate) => (
                    <View key={candidate.id} className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
                      <User size={18} color={color.textTertiary} strokeWidth={1.75} />
                      <View className="flex-1">
                        <Text variant="body">{candidate.member.firstName} {candidate.member.lastName}</Text>
                        <Text variant="caption" tone="secondary">{candidate.member.memberId}</Text>
                      </View>
                      {election.status === 'RESULTS_PUBLISHED' && (
                        <Text variant="caption" tone="secondary">{candidate.voteCount} votes</Text>
                      )}
                    </View>
                  ))}
                  {pos.candidates.length === 0 && (
                    <View className="px-4 py-3">
                      <Text variant="caption" tone="tertiary">No candidates yet</Text>
                    </View>
                  )}
                </View>
              ))}
            </Section>
          )}

          {/* Actions */}
          <View className="gap-2">
            {canVote && isActive && hasVoted && <StatusChip status="confirmed" label={t('elections.alreadyVoted')} />}
            {canVote && isActive && !hasVoted && (
              <Button variant="primary" onPress={() => setMode('ballot')}>
                {t('elections.vote')}
              </Button>
            )}
            {canNominate && isNominating && (
              <Button variant="secondary" onPress={() => setMode('nominate')}>
                {t('elections.nominate')}
              </Button>
            )}
          </View>
        </View>
      )}

      {/* ----- NOMINATE MODE ----- */}
      {mode === 'nominate' && (
        <View className="gap-6">
          <Text variant="body" tone="secondary">
            Submit your self-nomination for this election. You can add an optional manifesto.
          </Text>
          <TextField
            control={nominateForm.control}
            name="manifesto"
            label={t('elections.manifesto')}
            placeholder="Tell voters why you are running…"
            multiline
            maxLength={5000}
          />
          <StickyFooter>
            <Button
              variant="primary"
              loading={selfNominate.isPending}
              onPress={() => { nominateForm.handleSubmit(handleNominate)(); }}
              fullWidth
            >
              {t('elections.nominate')}
            </Button>
          </StickyFooter>
        </View>
      )}

      {/* ----- BALLOT MODE ----- */}
      {mode === 'ballot' && (
        <View className="gap-6">
          <Text variant="body" tone="secondary">
            Select one candidate per position. {election.allowAbstention ? 'You may abstain for any position.' : ''}
          </Text>
          {election.positions.map((pos) => (
            <BallotPosition
              key={pos.id}
              position={pos}
              selected={ballot[pos.id]}
              onSelect={(candidateId) => setBallot((prev) => ({ ...prev, [pos.id]: candidateId }))}
              onAbstain={() => setBallot((prev) => ({ ...prev, [pos.id]: 'abstain' }))}
              allowAbstention={election.allowAbstention}
            />
          ))}
          <StickyFooter>
            <Button
              variant="primary"
              loading={bulkCastVotes.isPending}
              onPress={handleSubmitBallot}
              fullWidth
            >
              {t('elections.ballotSubmit')}
            </Button>
          </StickyFooter>
        </View>
      )}
    </Screen>
  );
}
