import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
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
import { canEditPoll, POLL_TYPE_OPTIONS } from '@/features/electionsManage/labels';
import { useCreatePoll, useUpdatePoll } from '@/features/electionsManage/mutations';
import { VOTING_MODULE } from '@/features/electionsManage/queries';
import { emptyPollValues, pollFormSchema, pollOptionsProblem, pollToFormValues, toPollPayload, toPollUpdatePayload, type PollFormValues } from '@/features/electionsManage/schemas';
import { usePollDetail } from '@/features/voting/queries';
import { useModuleAccess } from '@/hooks/useModuleAccess';

/**
 * project-overview.md §6.10 GV10 — ask the members a question: what it is, how they answer, the answers to choose from, and when it
 * runs. A poll can be changed until it starts; its answers are changed from the poll itself.
 */
export default function PollFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const allowed = useModuleAccess('POLL_MANAGE', VOTING_MODULE);
  const detail = usePollDetail(editId);
  const create = useCreatePoll();
  const update = useUpdatePoll(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<PollFormValues>({ resolver: zodResolver(pollFormSchema), defaultValues: emptyPollValues(), mode: 'onTouched' });
  const options = useFieldArray({ control, name: 'options' });
  const pollType = useWatch({ control, name: 'pollType' });
  const back = () => router.back();
  const title = isEdit ? 'Edit poll' : 'Add a poll';
  const poll = detail.data;

  useEffect(() => {
    if (poll) reset(pollToFormValues(poll));
  }, [poll, reset]);

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

  if (isEdit && (detail.isError || !poll)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={detail.error} title={detail.isError ? undefined : 'Poll not found'} onRetry={() => detail.refetch()} />
      </Screen>
    );
  }

  if (isEdit && poll && !canEditPoll(poll.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState title="This poll can’t be changed" description="A poll can only be changed before it starts." />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the poll. Try again.');

  const submit = (values: PollFormValues) => {
    const problem = isEdit ? null : pollOptionsProblem(values);
    if (problem) {
      toast.error(problem);
      return;
    }
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        router.back();
      },
      onError: fail,
    });
    if (isEdit) update.mutate(toPollUpdatePayload(values), done('Poll updated'));
    else create.mutate(toPollPayload(values), done('Poll added'));
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="GV10" />

      <View className="gap-6 pb-6">
        <Section title="The poll">
          <View className="gap-4">
            <TextField control={control} name="title" label="Question" placeholder="Which day should we meet?" autoCapitalize="sentences" testID="poll-title" />
            <TextField control={control} name="description" label="More about it (optional)" multiline autoCapitalize="sentences" />
            {isEdit ? null : <SelectSheet control={control} name="pollType" label="How members answer" options={POLL_TYPE_OPTIONS} placeholder="Choose" />}
            {pollType === 'MULTIPLE_CHOICE' ? (
              <TextField control={control} name="maxChoices" label="Most answers a member can pick (optional)" keyboardType="number-pad" placeholder="No limit" />
            ) : null}
          </View>
        </Section>

        <Section title="When">
          <View className="gap-4">
            <DateTimeField control={control} name="startDate" label="Starts" testID="poll-start" />
            <DateTimeField control={control} name="endDate" label="Ends" helper="Answers are refused after this time." testID="poll-end" />
          </View>
        </Section>

        <Section title="Who sees what">
          <View className="gap-4">
            <Switch control={control} name="isAnonymous" label="Answers are secret" />
            <Switch control={control} name="showResultsBeforeEnd" label="Show results while it is open" helper="Otherwise members see them when the poll closes." />
          </View>
        </Section>

        {isEdit ? (
          <Text variant="caption" tone="secondary">
            The answers are changed from the poll itself.
          </Text>
        ) : pollType === 'YES_NO' ? (
          <Text variant="caption" tone="secondary">
            Members will choose between Yes and No.
          </Text>
        ) : (
          <Section title="Answers to choose from">
            <View className="gap-3">
              {options.fields.map((field, index) => (
                <View key={field.id} className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <TextField control={control} name={`options.${index}.text`} placeholder={`Answer ${index + 1}`} autoCapitalize="sentences" testID={`poll-option-${index}`} />
                  </View>
                  {options.fields.length > 2 ? <IconButton icon={X} accessibilityLabel="Remove this answer" onPress={() => options.remove(index)} /> : null}
                </View>
              ))}
              <Button variant="secondary" onPress={() => options.append({ text: '' })} testID="poll-add-option">
                Add another answer
              </Button>
            </View>
          </Section>
        )}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={create.isPending || update.isPending}
            onPress={() => {
              void handleSubmit(submit)();
            }}
            testID="poll-save"
          >
            {isEdit ? 'Save changes' : 'Add poll'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
