import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PollOptionSheet } from '@/features/electionsManage/components/Sheets';
import { canCancelPoll, canDeletePoll, canEditPoll, pollStatusKey, POLL_STATUS_LABELS, POLL_TYPE_LABELS } from '@/features/electionsManage/labels';
import { useAddPollOption, useDeletePoll, useDeletePollOption, usePollStep } from '@/features/electionsManage/mutations';
import { usePollResults, VOTING_MODULE } from '@/features/electionsManage/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { usePollDetail } from '@/features/voting/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import type { PollStatus, PollType } from '@/types/api/enums';

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

/**
 * project-overview.md §6.10 GV10 — one poll: its answers, how many members have answered, the live results, and the step it can take
 * next (start it, close it, cancel it). A poll can be started once and closed once.
 */
export default function PollControlScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess('POLL_MANAGE', VOTING_MODULE);
  const query = usePollDetail(id);
  const poll = query.data;
  const status = poll?.status as PollStatus | undefined;
  const results = usePollResults(id, allowed && (status === 'ACTIVE' || status === 'CLOSED'));
  const step = usePollStep(id);
  const remove = useDeletePoll();
  const addOption = useAddPollOption(id);
  const removeOption = useDeletePollOption();

  const stepRef = useRef<BottomSheetModal>(null);
  const cancelRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const optionRef = useRef<BottomSheetModal>(null);
  const [pendingStep, setPendingStep] = useState<'startPoll' | 'closePoll' | null>(null);
  const back = () => router.back();
  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Poll" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const mainStep = status === 'DRAFT' ? ('startPoll' as const) : status === 'ACTIVE' ? ('closePoll' as const) : null;
  const STEP_COPY = {
    startPoll: { label: 'Start poll', title: 'Start this poll?', description: 'Members can answer straight away. You can no longer change the question or the answers.', done: 'The poll is open' },
    closePoll: { label: 'Close poll', title: 'Close this poll?', description: 'No more answers are taken. This can’t be undone.', done: 'The poll is closed' },
  } as const;

  const runStep = () => {
    if (!pendingStep) return;
    const taken = pendingStep;
    step.mutate(taken, {
      onSuccess: () => {
        stepRef.current?.dismiss();
        toast.success(STEP_COPY[taken].done);
      },
      onError: (e) => {
        stepRef.current?.dismiss();
        fail(e, 'Could not do that. Try again.');
      },
    });
  };

  const doCancel = () =>
    step.mutate('cancelPoll', {
      onSuccess: () => {
        cancelRef.current?.dismiss();
        toast.success('Poll cancelled');
      },
      onError: (e) => {
        cancelRef.current?.dismiss();
        fail(e, 'Could not cancel the poll. Try again.');
      },
    });

  const doDelete = () =>
    remove.mutate(id, {
      onSuccess: () => {
        deleteRef.current?.dismiss();
        toast.success('Poll deleted');
        router.back();
      },
      onError: (e) => {
        deleteRef.current?.dismiss();
        fail(e, 'Could not delete the poll. Try again.');
      },
    });

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Poll"
        onBack={back}
        docsKey="GV10"
        rightActions={
          poll && canEditPoll(poll.status) ? (
            <IconButton icon={Pencil} accessibilityLabel="Edit this poll" onPress={() => router.push(`/(app)/(tabs)/manage/polls/form?id=${poll.id}` as never)} testID="poll-edit" />
          ) : undefined
        }
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={100} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !poll ? (
        <ErrorState error={query.error} title={query.isError ? undefined : 'Poll not found'} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="gap-3">
            <Text variant="h1">{poll.title}</Text>
            <View className="flex-row items-center gap-2">
              <StatusChip status={pollStatusKey(poll.status)} label={POLL_STATUS_LABELS[poll.status as PollStatus] ?? poll.status} />
              <Text variant="caption" tone="secondary">
                {POLL_TYPE_LABELS[poll.pollType as PollType] ?? poll.pollType}
              </Text>
            </View>
            {poll.description ? <Text variant="body">{poll.description}</Text> : null}
          </View>

          {status === 'ACTIVE' || status === 'CLOSED' ? (
            <View className="flex-row gap-3">
              <StatTile label="Members who answered" value={String(results.data?.totalResponses ?? poll.totalResponses)} tone="success" testID="poll-answered" />
            </View>
          ) : null}

          <Section title="Answers">
            <View className="gap-3">
              {status === 'ACTIVE' || status === 'CLOSED' ? (
                results.isPending ? (
                  <Skeleton width="100%" height={120} radius="md" />
                ) : results.isError || !results.data ? (
                  <ErrorState error={results.error} onRetry={() => results.refetch()} />
                ) : (
                  results.data.options.map((o) => (
                    <View key={o.optionId} className="gap-1.5" testID={`poll-result-${o.optionId}`}>
                      <Text variant="body-lg">{o.optionText}</Text>
                      <ProgressBar percent={o.votePercentage} label={`${o.optionText}, ${o.votePercentage} percent`} />
                      <Text variant="caption" tone="secondary">{`${o.voteCount} ${o.voteCount === 1 ? 'answer' : 'answers'} · ${o.votePercentage}%`}</Text>
                    </View>
                  ))
                )
              ) : (
                poll.options.map((o) => (
                  <View key={o.id} className="min-h-[44px] flex-row items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 dark:border-transparent">
                    <Text variant="body" className="flex-1">
                      {o.optionText}
                    </Text>
                    {status === 'DRAFT' && poll.options.length > 2 ? (
                      <IconButton
                        icon={X}
                        accessibilityLabel={`Remove ${o.optionText}`}
                        onPress={() => removeOption.mutate(o.id, { onError: (e) => fail(e, 'Could not remove the answer. Try again.') })}
                        testID={`poll-remove-option-${o.id}`}
                      />
                    ) : null}
                  </View>
                ))
              )}
              {status === 'DRAFT' && poll.pollType !== 'YES_NO' ? (
                <Button variant="secondary" onPress={() => optionRef.current?.present()} testID="poll-add-option">
                  Add an answer
                </Button>
              ) : null}
            </View>
          </Section>

          <Section title="Details">
            <ListGroup>
              <FactRow label="Starts" value={when(poll.startDate)} />
              <FactRow label="Ends" value={when(poll.endDate)} />
              <FactRow label="Answers" value={poll.isAnonymous ? 'Secret' : 'Not secret'} />
              <FactRow label="Results while open" value={poll.showResultsBeforeEnd ? 'Members can see them' : 'Only you can see them'} />
              {poll.pollType === 'MULTIPLE_CHOICE' ? <FactRow label="Most answers each" value={poll.maxChoices ? String(poll.maxChoices) : 'No limit'} /> : null}
            </ListGroup>
          </Section>

          {canCancelPoll(poll.status) || canDeletePoll(poll) ? (
            <View className="gap-3">
              {canCancelPoll(poll.status) ? (
                <Button variant="danger-ghost" onPress={() => cancelRef.current?.present()} testID="poll-cancel">
                  Cancel this poll
                </Button>
              ) : null}
              {canDeletePoll(poll) ? (
                <Button variant="danger" onPress={() => deleteRef.current?.present()} testID="poll-delete">
                  Delete this poll
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {poll && mainStep ? (
        <StickyFooter>
          <View className="flex-1">
            <Button
              variant="primary"
              fullWidth
              loading={step.isPending}
              onPress={() => {
                setPendingStep(mainStep);
                stepRef.current?.present();
              }}
              testID="poll-step"
            >
              {STEP_COPY[mainStep].label}
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={stepRef}
        title={pendingStep ? STEP_COPY[pendingStep].title : ''}
        description={pendingStep ? STEP_COPY[pendingStep].description : ''}
        confirmLabel={pendingStep ? STEP_COPY[pendingStep].label : 'Confirm'}
        cancelLabel="Not now"
        destructive={false}
        onConfirm={runStep}
      />
      <ConfirmSheet ref={cancelRef} title="Cancel this poll?" description="No more answers are taken. This can’t be undone." confirmLabel="Cancel poll" onConfirm={doCancel} />
      <ConfirmSheet ref={deleteRef} title="Delete this poll?" description="Nobody has answered it, so nothing is lost. This can’t be undone." confirmLabel="Delete poll" onConfirm={doDelete} />
      <PollOptionSheet
        ref={optionRef}
        loading={addOption.isPending}
        onSave={(values) =>
          addOption.mutate(
            { optionText: values.optionText },
            { onSuccess: () => optionRef.current?.dismiss(), onError: (e) => fail(e, 'Could not add the answer. Try again.') },
          )
        }
      />
    </Screen>
  );
}
