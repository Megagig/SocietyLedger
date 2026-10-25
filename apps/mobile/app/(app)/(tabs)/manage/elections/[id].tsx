import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trophy } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/coopManage/components/ReasonSheet';
import { CandidateCard } from '@/features/electionsManage/components/Rows';
import { CandidateSheet, PositionSheet } from '@/features/electionsManage/components/Sheets';
import {
  candidateGuard,
  canAddCandidates,
  canCancelElection,
  canDeleteElection,
  canEditElection,
  countByStatus,
  ELECTION_ADMIN_ACCESS,
  ELECTION_STAGES,
  ELECTION_STATUS_LABELS,
  ELECTION_TYPE_LABELS,
  electionStatusKey,
  nextStep,
  OPEN_VOTING_NOW,
  stageIndex,
  turnoutPercent,
  waitingNote,
  type ElectionStep,
  type ElectionStepAction,
} from '@/features/electionsManage/labels';
import { useCancelElection, useAddPosition, useDecideCandidate, useDeleteElection, useDeletePosition, useElectionStep, useRegisterCandidate, useUpdatePosition } from '@/features/electionsManage/mutations';
import { useElectionEligibility, VOTING_MODULE } from '@/features/electionsManage/queries';
import { toPositionPayload } from '@/features/electionsManage/schemas';
import { FactRow } from '@/features/members/components/FactRow';
import { useElectionDetail } from '@/features/voting/queries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import type { CandidateMemberDTO } from '@/types/api/electionsManage';
import type { CandidateDTO, ElectionPositionDTO } from '@/types/api/voting';

const STEP_DONE: Record<ElectionStepAction, string> = {
  startNominations: 'Nominations are open',
  closeNominations: 'Nominations are closed',
  startVoting: 'Voting is open',
  closeVoting: 'Voting is closed',
  publishResults: 'Results are published',
};

const when = (iso: string | null) => (iso ? `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}` : null);

/**
 * project-overview.md §6.10 GV9 — run one election: where it stands and the next step, who is standing for each position (and the
 * nominations waiting for a decision), turnout, and the results. Each step happens once; nobody decides their own nomination.
 */
export default function ElectionControlScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(ELECTION_ADMIN_ACCESS, VOTING_MODULE);
  const canManage = useCan('ELECTION_MANAGE');
  const canCandidates = useCan('ELECTION_CANDIDATES');
  const canRun = useCan('ELECTION_RUN');
  const canPublish = useCan('ELECTION_RESULTS_PUBLISH');
  const canSeeEarly = useCan('ELECTION_RESULTS_VIEW');
  const ownMemberId = useMemberId();
  const query = useElectionDetail(id);
  const election = query.data;
  const eligibility = useElectionEligibility(id);

  const step = useElectionStep(id);
  const cancel = useCancelElection(id);
  const remove = useDeleteElection();
  const decide = useDecideCandidate();
  const register = useRegisterCandidate(id);
  const addPosition = useAddPosition(id);
  const updatePosition = useUpdatePosition();
  const removePosition = useDeletePosition();

  const stepRef = useRef<BottomSheetModal>(null);
  const cancelRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const rejectRef = useRef<BottomSheetModal>(null);
  const candidateRef = useRef<BottomSheetModal>(null);
  const positionRef = useRef<BottomSheetModal>(null);
  const removePositionRef = useRef<BottomSheetModal>(null);
  const [pendingStep, setPendingStep] = useState<ElectionStep | null>(null);
  const [rejecting, setRejecting] = useState<CandidateDTO | null>(null);
  const [addingFor, setAddingFor] = useState<{ positionId: number | null; title?: string } | null>(null);
  const [editing, setEditing] = useState<ElectionPositionDTO | null>(null);
  const [removing, setRemoving] = useState<ElectionPositionDTO | null>(null);

  const candidates = useMemo(() => election?.candidates ?? [], [election]);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/elections/${path}` as never);
  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Election" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const pending = countByStatus(candidates, 'PENDING');
  const approved = countByStatus(candidates, 'APPROVED');
  const status = election?.status;
  const mainStep = status ? nextStep(status) : null;
  const mainAllowed = mainStep ? (mainStep.access === 'ELECTION_RESULTS_PUBLISH' ? canPublish : canRun) : false;
  const openNow = status === 'DRAFT' && approved > 0 && canRun ? OPEN_VOTING_NOW : null;
  const stage = status ? stageIndex(status) : -1;
  const started = status === 'VOTING_OPEN' || status === 'VOTING_CLOSED' || status === 'RESULTS_PUBLISHED';
  const canSeeResults = status === 'RESULTS_PUBLISHED' || (status === 'VOTING_CLOSED' && canSeeEarly);

  const confirmStep = (s: ElectionStep) => {
    setPendingStep(s);
    stepRef.current?.present();
  };

  const runStep = () => {
    if (!pendingStep) return;
    const taken = pendingStep;
    step.mutate(taken.action, {
      onSuccess: () => {
        stepRef.current?.dismiss();
        toast.success(STEP_DONE[taken.action]);
      },
      onError: (error) => {
        stepRef.current?.dismiss();
        fail(error, 'Could not do that. Try again.');
      },
    });
  };

  const approve = (candidate: CandidateDTO) =>
    decide.mutate(
      { id: candidate.id, payload: { status: 'APPROVED' } },
      { onSuccess: () => toast.success(`${candidate.member.firstName} ${candidate.member.lastName} is approved`), onError: (e) => fail(e, 'Could not save your decision. Try again.') },
    );

  const reject = (reason: string) => {
    if (!rejecting) return;
    decide.mutate(
      { id: rejecting.id, payload: { status: 'REJECTED', rejectionReason: reason } },
      {
        onSuccess: () => {
          rejectRef.current?.dismiss();
          toast.success('Nomination not approved');
        },
        onError: (e) => {
          rejectRef.current?.dismiss();
          fail(e, 'Could not save your decision. Try again.');
        },
      },
    );
  };

  const addCandidate = (member: CandidateMemberDTO, manifesto: string) => {
    if (!addingFor) return;
    register.mutate(
      { memberId: member.id, positionId: addingFor.positionId, manifesto: manifesto || null },
      {
        onSuccess: () => {
          candidateRef.current?.dismiss();
          toast.success(`${member.firstName} ${member.lastName} is added — waiting for approval`);
        },
        onError: (e) => fail(e, 'Could not add the candidate. Try again.'),
      },
    );
  };

  const savePosition = (values: { title: string; description: string }) => {
    const done = {
      onSuccess: () => {
        positionRef.current?.dismiss();
        toast.success(editing ? 'Position updated' : 'Position added');
      },
      onError: (e: unknown) => fail(e, 'Could not save the position. Try again.'),
    };
    if (editing) updatePosition.mutate({ id: editing.id, payload: toPositionPayload(values) }, done);
    else addPosition.mutate(toPositionPayload(values), done);
  };

  const doRemovePosition = () => {
    if (!removing) return;
    removePosition.mutate(removing.id, {
      onSuccess: () => {
        removePositionRef.current?.dismiss();
        toast.success('Position removed');
      },
      onError: (e) => {
        removePositionRef.current?.dismiss();
        fail(e, 'Could not remove the position. Try again.');
      },
    });
  };

  const doCancel = (reason: string) =>
    cancel.mutate(reason, {
      onSuccess: () => {
        cancelRef.current?.dismiss();
        toast.success('Election cancelled');
      },
      onError: (e) => {
        cancelRef.current?.dismiss();
        fail(e, 'Could not cancel the election. Try again.');
      },
    });

  const doDelete = () => {
    if (!election) return;
    remove.mutate(election.id, {
      onSuccess: () => {
        deleteRef.current?.dismiss();
        toast.success('Election deleted');
        router.back();
      },
      onError: (e) => {
        deleteRef.current?.dismiss();
        fail(e, 'Could not delete the election. Try again.');
      },
    });
  };

  const renderCandidates = (list: CandidateDTO[]) =>
    list.length === 0 ? (
      <Text variant="body" tone="secondary">
        Nobody is standing yet.
      </Text>
    ) : (
      <View className="gap-3">
        {list.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            guard={canCandidates && status ? candidateGuard(c, status, ownMemberId) : 'decided'}
            busy={decide.isPending && decide.variables?.id === c.id}
            onApprove={approve}
            onReject={(candidate) => {
              setRejecting(candidate);
              rejectRef.current?.present();
            }}
          />
        ))}
      </View>
    );

  const openAdd = (positionId: number | null, title?: string) => {
    setAddingFor({ positionId, title });
    candidateRef.current?.present();
  };

  const note = waitingNote(canCandidates && status && (status === 'DRAFT' || status === 'NOMINATIONS_OPEN' || status === 'NOMINATIONS_CLOSED') ? pending : 0);
  const blockedByWaiting = status === 'NOMINATIONS_CLOSED' && pending > 0;

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Election"
        onBack={back}
        docsKey="GV9"
        rightActions={
          election && canManage && canEditElection(election.status) ? (
            <IconButton icon={Pencil} accessibilityLabel="Edit this election" onPress={() => go(`form?id=${election.id}`)} testID="election-edit" />
          ) : undefined
        }
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !election ? (
        <ErrorState error={query.error} title={query.isError ? undefined : 'Election not found'} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-3">
            <Text variant="h1">{election.title}</Text>
            <View className="flex-row flex-wrap items-center gap-2">
              <StatusChip status={electionStatusKey(election.status)} label={ELECTION_STATUS_LABELS[election.status]} />
              <Text variant="caption" tone="secondary">
                {ELECTION_TYPE_LABELS[election.electionType]}
              </Text>
            </View>
            {election.description ? <Text variant="body">{election.description}</Text> : null}
            {stage >= 0 ? (
              <View className="gap-1.5" testID="election-stages">
                <ProgressBar percent={((stage + 1) / ELECTION_STAGES.length) * 100} label={`Stage ${stage + 1} of ${ELECTION_STAGES.length}`} />
                <View className="flex-row justify-between">
                  {ELECTION_STAGES.map((label, i) => (
                    <Text key={label} variant="caption" tone={i === stage ? 'primary' : 'secondary'}>
                      {label}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          {election.status === 'CANCELLED' ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4" testID="election-cancelled">
              <Text variant="label" tone="danger">
                Cancelled
              </Text>
              <Text variant="body">{election.cancellationReason ?? 'No reason was given.'}</Text>
            </View>
          ) : null}

          {note ? (
            <View className="rounded-lg bg-warning-soft p-4" testID="election-waiting">
              <Text variant="body">{note}</Text>
            </View>
          ) : null}

          {started ? (
            <View className="flex-row gap-3">
              <StatTile label="Members who voted" value={String(election.totalVotesCast)} tone="success" testID="election-voted" />
              <StatTile label="Turnout" value={`${turnoutPercent(election.totalVotesCast, election.eligibleVoterCount)}%`} tone="info" />
              <StatTile label="Could vote" value={String(election.eligibleVoterCount)} tone="primary" />
            </View>
          ) : null}

          <Section title="When">
            <ListGroup>
              <FactRow label="Nominations open" value={when(election.nominationStartDate)} />
              <FactRow label="Nominations close" value={when(election.nominationEndDate)} />
              <FactRow label="Voting starts" value={when(election.votingStartDate)} />
              <FactRow label="Voting ends" value={when(election.votingEndDate)} />
              <FactRow label="Minimum turnout" value={election.requiresQuorum ? `${election.quorumPercentage}% of members` : 'None'} />
              <FactRow label="Abstaining" value={election.allowAbstention ? 'Allowed' : 'Not allowed'} />
            </ListGroup>
          </Section>

          {canManage ? (
            <Section title="Who can vote and stand">
              <View className="gap-3">
                {(eligibility.data?.requirements.voters.length ?? 0) + (eligibility.data?.requirements.candidates.length ?? 0) === 0 ? (
                  <Text variant="body" tone="secondary">No rules are set, so every active member can vote and stand.</Text>
                ) : (
                  [...(eligibility.data?.requirements.voters.map((l) => `To vote: ${l}`) ?? []), ...(eligibility.data?.requirements.candidates.map((l) => `To stand: ${l}`) ?? [])].map((line) => (
                    <Text key={line} variant="body" tone="secondary">{`• ${line}`}</Text>
                  ))
                )}
                {(eligibility.data?.exceptions.length ?? 0) > 0 ? (
                  <Text variant="caption" tone="secondary">{`${eligibility.data?.exceptions.length} ${eligibility.data?.exceptions.length === 1 ? 'exception' : 'exceptions'} made`}</Text>
                ) : null}
                <Button variant="secondary" onPress={() => go(`rules?id=${election.id}`)} testID="election-rules">
                  {canEditElection(election.status) || election.status === 'NOMINATIONS_OPEN' || election.status === 'NOMINATIONS_CLOSED' ? 'Change the rules and exceptions' : 'See the rules and exceptions'}
                </Button>
              </View>
            </Section>
          ) : null}

          {canSeeResults ? (
            <Section title="Results">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={Trophy} tone="primary" />}
                  title={election.status === 'RESULTS_PUBLISHED' ? 'See the results' : 'See the results (not published yet)'}
                  meta={election.status === 'RESULTS_PUBLISHED' ? 'Published to every member' : 'Only the committee can see them until you publish'}
                  showChevron
                  onPress={() => go(`results?id=${election.id}`)}
                  testID="election-results"
                />
              </ListGroup>
            </Section>
          ) : null}

          {election.positions.length > 0 ? (
            election.positions.map((position) => (
              <Section key={position.id} title={position.title}>
                <View className="gap-3">
                  {position.description ? (
                    <Text variant="caption" tone="secondary">
                      {position.description}
                    </Text>
                  ) : null}
                  {renderCandidates(candidates.filter((c) => c.positionId === position.id))}
                  {canCandidates && canAddCandidates(election.status) ? (
                    <Button variant="secondary" onPress={() => openAdd(position.id, position.title)} testID={`add-candidate-${position.id}`}>
                      Add a candidate
                    </Button>
                  ) : null}
                  {canManage && canEditElection(election.status) ? (
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Button
                          variant="ghost"
                          onPress={() => {
                            setEditing(position);
                            positionRef.current?.present();
                          }}
                          testID={`edit-position-${position.id}`}
                        >
                          Change position
                        </Button>
                      </View>
                      <View className="flex-1">
                        <Button
                          variant="danger-ghost"
                          onPress={() => {
                            setRemoving(position);
                            removePositionRef.current?.present();
                          }}
                          testID={`remove-position-${position.id}`}
                        >
                          Remove position
                        </Button>
                      </View>
                    </View>
                  ) : null}
                </View>
              </Section>
            ))
          ) : (
            <Section title="Candidates">
              <View className="gap-3">
                {renderCandidates(candidates.filter((c) => c.positionId === null))}
                {canCandidates && canAddCandidates(election.status) ? (
                  <Button variant="secondary" onPress={() => openAdd(null)} testID="add-candidate-general">
                    Add a candidate
                  </Button>
                ) : null}
              </View>
            </Section>
          )}

          {canManage && canEditElection(election.status) ? (
            <Button
              variant="soft"
              onPress={() => {
                setEditing(null);
                positionRef.current?.present();
              }}
              testID="election-add-position"
            >
              Add a position
            </Button>
          ) : null}

          {canManage && (canCancelElection(election.status) || canDeleteElection(election)) ? (
            <View className="gap-3">
              {canCancelElection(election.status) ? (
                <Button variant="danger-ghost" onPress={() => cancelRef.current?.present()} testID="election-cancel">
                  Cancel this election
                </Button>
              ) : null}
              {canDeleteElection(election) ? (
                <Button variant="danger" onPress={() => deleteRef.current?.present()} testID="election-delete">
                  Delete this election
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {election && mainStep && mainAllowed ? (
        <StickyFooter>
          <View className="flex-1 flex-row gap-3">
            {openNow ? (
              <View className="flex-1">
                <Button variant="secondary" fullWidth onPress={() => confirmStep(openNow)} testID="election-open-now">
                  {openNow.label}
                </Button>
              </View>
            ) : null}
            <View className="flex-1">
              <Button variant="primary" fullWidth disabled={blockedByWaiting} loading={step.isPending} onPress={() => confirmStep(mainStep)} testID="election-step">
                {mainStep.label}
              </Button>
            </View>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={stepRef}
        title={pendingStep?.confirmTitle ?? ''}
        description={pendingStep?.confirmDescription ?? ''}
        confirmLabel={pendingStep?.label ?? 'Confirm'}
        cancelLabel="Not now"
        destructive={false}
        onConfirm={runStep}
      />
      <ReasonSheet ref={rejectRef} title="Reject this nomination?" description="The member is told, and sees your reason." confirmLabel="Reject nomination" loading={decide.isPending} onConfirm={reject} />
      <ReasonSheet ref={cancelRef} title="Cancel this election?" description="Members will see why it was cancelled. This can’t be undone." confirmLabel="Cancel election" loading={cancel.isPending} onConfirm={doCancel} />
      <ConfirmSheet ref={deleteRef} title="Delete this election?" description="It has no votes, so nothing is lost. This can’t be undone." confirmLabel="Delete election" onConfirm={doDelete} />
      <ConfirmSheet ref={removePositionRef} title={`Remove ${removing?.title ?? 'this position'}?`} description="Nobody is standing for it, so nothing is lost." confirmLabel="Remove position" onConfirm={doRemovePosition} />
      <CandidateSheet ref={candidateRef} positionTitle={addingFor?.title} enabled={addingFor !== null} loading={register.isPending} onAdd={addCandidate} onDismiss={() => setAddingFor(null)} />
      <PositionSheet
        ref={positionRef}
        initial={editing ? { title: editing.title, description: editing.description } : undefined}
        loading={addPosition.isPending || updatePosition.isPending}
        onSave={savePosition}
        onDismiss={() => setEditing(null)}
      />
    </Screen>
  );
}
