import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { RulesEditor } from '@/features/electionsManage/components/RulesEditor';
import { ExceptionSheet } from '@/features/electionsManage/components/Sheets';
import { emptyRulesValues, formValuesToRules, rulesProblem, rulesToFormValues, type RulesFormValues } from '@/features/electionsManage/eligibility';
import { useAddEligibilityException, usePreviewEligibility, useRemoveEligibilityException, useSetElectionEligibility, useSetEligibilityTemplate } from '@/features/electionsManage/mutations';
import { useEligibilityOptions, useEligibilityTemplate, useElectionEligibility, VOTING_MODULE } from '@/features/electionsManage/queries';
import { useElectionDetail } from '@/features/voting/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import type { ElectionStatus } from '@/types/api/enums';

const BEFORE_VOTING: ElectionStatus[] = ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'];
const EXCEPTIONS_OPEN: ElectionStatus[] = [...BEFORE_VOTING, 'VOTING_OPEN'];

/**
 * project-overview.md §6.10 GV8 — who can vote and who can stand. With `?id=` it is the rules and exceptions of one election (the rules
 * until voting opens, exceptions until it closes); without, it is the association's template that new elections start from. Nothing is
 * set until the association chooses to: without it every active member can vote and stand.
 */
export default function VotingRulesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const electionId = params.id ? Number(params.id) : undefined;
  const isElection = electionId !== undefined;
  const canManage = useModuleAccess('ELECTION_MANAGE', VOTING_MODULE);
  const canTemplate = useModuleAccess('ELECTION_RULES', VOTING_MODULE);
  const allowed = isElection ? canManage : canManage || canTemplate;
  const title = isElection ? 'Rules for this election' : 'Voting rules';

  const detail = useElectionDetail(electionId);
  const eligibility = useElectionEligibility(electionId);
  const template = useEligibilityTemplate();
  const options = useEligibilityOptions();
  const saveElection = useSetElectionEligibility(electionId ?? 0);
  const saveTemplate = useSetEligibilityTemplate();
  const preview = usePreviewEligibility();
  const addException = useAddEligibilityException(electionId ?? 0);
  const removeException = useRemoveEligibilityException();
  const exceptionRef = useRef<BottomSheetModal>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);

  const { control, handleSubmit, reset } = useForm<RulesFormValues>({ defaultValues: emptyRulesValues() });
  const values = useWatch({ control }) as RulesFormValues;
  const back = () => router.back();

  const source = isElection ? eligibility.data : template.data;
  useEffect(() => {
    if (source) reset(rulesToFormValues(source.rules));
  }, [source, reset]);

  const status = detail.data?.status;
  const editable = isElection ? !!status && BEFORE_VOTING.includes(status) : canTemplate;
  const exceptionsOpen = isElection && !!status && EXCEPTIONS_OPEN.includes(status);
  const loading = isElection ? eligibility.isPending || detail.isPending : template.isPending;
  const failed = isElection ? eligibility.isError || detail.isError : template.isError;
  const fail = (error: unknown, fallback: string) => toast.error(error instanceof ApiError ? error.message : fallback);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const submit = (v: RulesFormValues) => {
    const problem = rulesProblem(v);
    if (problem) {
      toast.error(problem);
      return;
    }
    const rules = formValuesToRules(v);
    const done = {
      onSuccess: () => {
        toast.success(rules ? (isElection ? 'Rules saved' : 'Saved. New elections will start from these rules.') : 'No rules: every active member can vote and stand.');
        router.back();
      },
      onError: (e: unknown) => fail(e, 'Could not save the rules. Try again.'),
    };
    if (isElection) saveElection.mutate(rules, done);
    else saveTemplate.mutate(rules, done);
  };

  const runPreview = () => {
    const problem = rulesProblem(values);
    if (problem) {
      toast.error(problem);
      return;
    }
    preview.mutate(formValuesToRules(values), { onError: (e) => fail(e, 'Could not preview the rules. Try again.') });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="GV8" />

      {loading ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={60} radius="md" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : failed ? (
        <ErrorState error={isElection ? eligibility.error ?? detail.error : template.error} onRetry={() => (isElection ? eligibility.refetch() : template.refetch())} />
      ) : (
        <View className="gap-6 pb-8">
          {isElection && detail.data ? <Text variant="h2">{detail.data.title}</Text> : <Text variant="body" tone="secondary">New elections start from these rules. An election that already exists is never changed by them.</Text>}

          {editable ? (
            <RulesEditor control={control} categories={options.data?.categories ?? ['regular', 'executive', 'honorary', 'student']} />
          ) : (
            <View className="gap-2 rounded-lg bg-surface-sunken p-4">
              <Text variant="label">The rules are fixed once voting opens</Text>
              {(eligibility.data?.requirements.voters.length ?? 0) + (eligibility.data?.requirements.candidates.length ?? 0) === 0 ? (
                <Text variant="body" tone="secondary">No rules were set, so every active member can vote and stand.</Text>
              ) : (
                [...(eligibility.data?.requirements.voters.map((l) => `To vote: ${l}`) ?? []), ...(eligibility.data?.requirements.candidates.map((l) => `To stand: ${l}`) ?? [])].map((line) => (
                  <Text key={line} variant="body" tone="secondary">{`• ${line}`}</Text>
                ))
              )}
              <Text variant="caption" tone="secondary">Use an exception below to let one member in, or keep one out.</Text>
            </View>
          )}

          {editable ? (
            <View className="gap-3">
              <Button variant="secondary" loading={preview.isPending} onPress={runPreview} testID="rules-preview">
                See who this would let in
              </Button>
              {preview.data ? (
                <View className="gap-2 rounded-lg bg-surface-sunken p-4" testID="rules-preview-result">
                  <Text variant="body">{`${preview.data.canVote} of ${preview.data.activeMembers} active members could vote, and ${preview.data.canStand} could stand.`}</Text>
                  {preview.data.turnedAway.slice(0, 20).map((t, i) => (
                    <Text key={`${t.memberId}-${t.scope}-${i}`} variant="caption" tone="secondary">{`${t.name} (${t.memberNumber}) can’t ${t.scope === 'VOTE' ? 'vote' : 'stand'}: ${t.reason}`}</Text>
                  ))}
                  {preview.data.turnedAway.length > 20 ? <Text variant="caption" tone="secondary">…and more.</Text> : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {exceptionsOpen ? (
            <Section title="Exceptions">
              <View className="gap-3">
                {eligibility.data && eligibility.data.exceptions.length > 0 ? (
                  eligibility.data.exceptions.map((x) => (
                    <View key={x.id} className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`exception-${x.id}`}>
                      <Text variant="body-lg">{`${x.member.firstName} ${x.member.lastName}`}</Text>
                      <Text variant="caption" tone="secondary">{`${x.kind === 'ALLOW' ? 'Allowed to' : 'Barred from'} ${x.scope === 'VOTE' ? 'vote' : 'stand'} · ${x.reason}`}</Text>
                      <Button variant="danger-ghost" onPress={() => removeException.mutate(x.id, { onError: (e) => fail(e, 'Could not remove it. Try again.') })} testID={`exception-remove-${x.id}`}>
                        Remove
                      </Button>
                    </View>
                  ))
                ) : (
                  <Text variant="body" tone="secondary">None. An exception lets one member in, or keeps one out, whatever the rules say.</Text>
                )}
                <Button
                  variant="secondary"
                  onPress={() => {
                    setExceptionOpen(true);
                    exceptionRef.current?.present();
                  }}
                  testID="exception-add"
                >
                  Add an exception
                </Button>
              </View>
            </Section>
          ) : null}
        </View>
      )}

      {editable && !loading && !failed ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth loading={saveElection.isPending || saveTemplate.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="rules-save">
              Save rules
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ExceptionSheet
        ref={exceptionRef}
        enabled={exceptionOpen}
        loading={addException.isPending}
        onDismiss={() => setExceptionOpen(false)}
        onSave={({ member, scope, kind, reason }) =>
          addException.mutate(
            { memberId: member.id, scope, kind, reason },
            {
              onSuccess: () => {
                exceptionRef.current?.dismiss();
                toast.success('Exception saved');
              },
              onError: (e) => fail(e, 'Could not save the exception. Try again.'),
            },
          )
        }
      />
    </Screen>
  );
}
