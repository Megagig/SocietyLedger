import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateTimeField } from '@/components/forms/DateTimeField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { canEditElection, ELECTION_TYPE_OPTIONS } from '@/features/electionsManage/labels';
import { useCreateElection, useUpdateElection } from '@/features/electionsManage/mutations';
import { RulesEditor } from '@/features/electionsManage/components/RulesEditor';
import { emptyRulesValues, formValuesToRules, rulesProblem, rulesToFormValues, type RulesFormValues } from '@/features/electionsManage/eligibility';
import { useEligibilityOptions, useEligibilityTemplate, VOTING_MODULE } from '@/features/electionsManage/queries';
import { electionFormSchema, electionToFormValues, emptyElectionValues, toElectionPayload, type ElectionFormValues } from '@/features/electionsManage/schemas';
import { useElectionDetail } from '@/features/voting/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/**
 * project-overview.md §6.10 GV8 — set up an election: what it is, when nominations and voting run, how votes are counted, and the
 * positions people stand for. An election can be changed only until nominations open; positions are changed from the election itself.
 */
export default function ElectionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useModuleAccess('ELECTION_MANAGE', VOTING_MODULE);
  const detail = useElectionDetail(editId);
  const create = useCreateElection();
  const update = useUpdateElection(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<ElectionFormValues>({ resolver: zodResolver(electionFormSchema), defaultValues: emptyElectionValues(), mode: 'onTouched' });
  const positions = useFieldArray({ control, name: 'positions' });
  // Who can vote and stand: starts from the association's template, if it has one; nothing switched on means every active member.
  const template = useEligibilityTemplate();
  const eligibilityOptions = useEligibilityOptions();
  const rulesForm = useForm<RulesFormValues>({ defaultValues: emptyRulesValues() });
  const [rulesTouched, setRulesTouched] = useState(false);
  useEffect(() => {
    if (template.data && !rulesTouched && !isEdit) rulesForm.reset(rulesToFormValues(template.data.rules));
  }, [template.data, rulesTouched, isEdit, rulesForm]);
  const requiresQuorum = useWatch({ control, name: 'requiresQuorum' });
  const back = () => router.back();
  const title = isEdit ? 'Edit election' : 'Add an election';
  const election = detail.data;

  useEffect(() => {
    if (election) reset(electionToFormValues(election));
  }, [election, reset]);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && detail.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (isEdit && (detail.isError || !election)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={detail.error} title={detail.isError ? undefined : 'Election not found'} onRetry={() => detail.refetch()} />
      </Screen>
    );
  }

  if (isEdit && election && !canEditElection(election.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState title="This election can’t be changed" description="An election can only be changed before nominations open." />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the election. Try again.');

  const submit = (values: ElectionFormValues) => {
    const rulesValues = rulesForm.getValues();
    const problem = isEdit ? null : rulesProblem(rulesValues);
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload = { ...toElectionPayload(values, !isEdit), ...(isEdit ? {} : { eligibilityRules: formValuesToRules(rulesValues) }) };
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        router.back();
      },
      onError: fail,
    });
    if (isEdit) update.mutate(payload, done('Election updated'));
    else create.mutate(payload, done('Election added'));
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="GV8" />

      <View className="gap-6 pb-6">
        <Section title="The election">
          <View className="gap-4">
            <TextField control={control} name="title" label="Title" placeholder="2027 executive election" autoCapitalize="sentences" testID="election-title" />
            <SelectSheet control={control} name="electionType" label="Kind of election" options={ELECTION_TYPE_OPTIONS} placeholder="Choose the kind" />
            <TextField control={control} name="description" label="What it is for (optional)" multiline autoCapitalize="sentences" />
          </View>
        </Section>

        <Section title="When">
          <View className="gap-4">
            <DateTimeField control={control} name="nominationStartDate" label="Nominations open (optional)" clearable placeholder="When you open them" testID="election-nom-start" />
            <DateTimeField control={control} name="nominationEndDate" label="Nominations close (optional)" clearable placeholder="When you close them" />
            <DateTimeField control={control} name="votingStartDate" label="Voting starts" testID="election-vote-start" />
            <DateTimeField control={control} name="votingEndDate" label="Voting ends" helper="Votes are refused after this time." testID="election-vote-end" />
          </View>
        </Section>

        <Section title="How votes are counted">
          <View className="gap-4">
            <Switch control={control} name="allowAbstention" label="Members can abstain" helper="They can choose not to back anyone for a position." />
            <Switch control={control} name="isAnonymous" label="Votes are secret" />
            <Switch control={control} name="requiresQuorum" label="Needs a minimum turnout" helper="Results are only published if enough members vote." />
            {requiresQuorum ? (
              <TextField control={control} name="quorumPercentage" label="Share of members who must vote (%)" keyboardType="number-pad" placeholder="50" testID="election-quorum" />
            ) : null}
          </View>
        </Section>

        {isEdit ? (
          <Text variant="caption" tone="secondary">
            Positions, candidates and the rules for who can vote and stand are changed from the election itself.
          </Text>
        ) : (
          <>
          <Section title="Who can vote and stand">
            <View className="gap-3" onTouchStart={() => setRulesTouched(true)}>
              {template.data?.rules && !rulesTouched ? <Text variant="caption" tone="secondary">Starting from your association’s saved rules. Change them for this election if you need to.</Text> : null}
              <RulesEditor control={rulesForm.control} categories={eligibilityOptions.data?.categories ?? ['regular', 'executive', 'honorary', 'student']} />
            </View>
          </Section>
          <Section title="Positions">
            <View className="gap-3">
              <Text variant="caption" tone="secondary">
                What members are voting for, like President or Secretary. Leave them empty if the election has no separate positions. You can add more later.
              </Text>
              {positions.fields.map((field, index) => (
                <View key={field.id} className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <TextField control={control} name={`positions.${index}.title`} placeholder="President" autoCapitalize="words" testID={`election-position-${index}`} />
                  </View>
                  <IconButton icon={X} accessibilityLabel="Remove this position" onPress={() => positions.remove(index)} />
                </View>
              ))}
              <Button variant="secondary" onPress={() => positions.append({ title: '' })} testID="election-add-position">
                Add a position
              </Button>
            </View>
          </Section>
          </>
        )}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(submit)(); }} testID="election-save">
            {isEdit ? 'Save changes' : 'Add election'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
