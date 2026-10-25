import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useApproveMinutes, useSaveMinutes } from '@/features/meetingsAdmin/mutations';
import { MEETINGS_MINUTES_ACCESS, MEETINGS_MODULE, useMeetingAdmin, useMeetingMinutes } from '@/features/meetingsAdmin/queries';
import { minutesFormSchema, toMinutesPayload, type MinutesFormValues } from '@/features/meetingsAdmin/schemas';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { useSessionStore } from '@/stores/session';

/**
 * project-overview.md §6.9 GV5 — the minutes: what was discussed, decisions and action items. Once another officer approves them they are
 * locked. Everyone who can see the meeting can read approved minutes; writing and approving need the minutes permission.
 */
export default function MinutesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const locked = useModuleDisabled(MEETINGS_MODULE);
  const canWrite = useCan(MEETINGS_MINUTES_ACCESS);
  const userId = useSessionStore((state) => state.user?.id);
  const meetingQuery = useMeetingAdmin(id);
  const minutesQuery = useMeetingMinutes(id);
  const save = useSaveMinutes(id);
  const approve = useApproveMinutes(id);
  const approveRef = useRef<BottomSheetModal>(null);
  const { control, handleSubmit, reset } = useForm<MinutesFormValues>({ resolver: zodResolver(minutesFormSchema), defaultValues: { content: '', decisions: '', actionItems: '' }, mode: 'onTouched' });
  const back = () => router.back();
  const minutes = minutesQuery.data;
  const approved = !!minutes?.approvedAt;
  const own = !!minutes && minutes.recordedBy === userId;

  useEffect(() => {
    if (minutes) reset({ content: minutes.content, decisions: minutes.decisions ?? '', actionItems: minutes.actionItems ?? '' });
  }, [minutes, reset]);

  if (locked) return <ModuleLockedScreen title="Minutes" moduleName="Meetings" onBack={back} />;

  if (minutesQuery.isPending || meetingQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Minutes" onBack={back} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      </Screen>
    );
  }

  if (minutesQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Minutes" onBack={back} />
        <ErrorState error={minutesQuery.error} onRetry={() => minutesQuery.refetch()} />
      </Screen>
    );
  }

  // A member who isn't an officer can read approved minutes but not write them.
  if (!canWrite && !approved) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Minutes" onBack={back} />
        {minutes ? <ErrorState title="These minutes aren't approved yet." description="They show here once an officer approves them." /> : <NoPermission />}
      </Screen>
    );
  }

  const editable = canWrite && !approved && meetingQuery.data?.status !== 'CANCELLED';
  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the minutes. Try again.');

  const onSave = (values: MinutesFormValues) =>
    save.mutate(
      { payload: toMinutesPayload(values), exists: !!minutes },
      {
        onSuccess: () => toast.success('Minutes saved'),
        onError: fail,
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Minutes" onBack={back} docsKey="GV5" />

      {meetingQuery.data ? (
        <Text variant="caption" tone="secondary" className="pb-2" numberOfLines={1}>
          {`${meetingQuery.data.title} · ${formatDate(meetingQuery.data.startTime, 'long')}`}
        </Text>
      ) : null}

      <View className="gap-6 pb-6">
        {approved ? (
          <View className="gap-1 rounded-lg bg-success-soft p-4" testID="minutes-approved">
            <Text variant="label" tone="success">
              Approved{minutes?.approvedAt ? ` on ${formatDate(minutes.approvedAt, 'long')}` : ''}
            </Text>
            <Text variant="body">{minutes?.approver ? `by ${minutes.approver.email}. They can no longer be edited.` : 'They can no longer be edited.'}</Text>
          </View>
        ) : minutes ? (
          <View className="gap-1 rounded-lg bg-warning-soft p-4">
            <Text variant="label" tone="warning">
              Waiting for approval
            </Text>
            <Text variant="body">{own ? 'You wrote these minutes, so another officer has to approve them.' : 'Read them through, then approve — they lock once approved.'}</Text>
          </View>
        ) : null}

        <Section title="What was discussed">
          <TextField control={control} name="content" label="Minutes" placeholder="Who was there, what was discussed…" multiline editable={editable} testID="minutes-content" />
        </Section>
        <Section title="Decisions">
          <TextField control={control} name="decisions" label="Decisions taken (optional)" multiline editable={editable} />
        </Section>
        <Section title="Action items">
          <TextField control={control} name="actionItems" label="Who does what, by when (optional)" multiline editable={editable} />
        </Section>
      </View>

      {canWrite && !approved ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant={minutes && !own ? 'secondary' : 'primary'} fullWidth loading={save.isPending} disabled={!editable} onPress={() => { void handleSubmit(onSave)(); }} testID="minutes-save">
              {minutes ? 'Save changes' : 'Save minutes'}
            </Button>
          </View>
          {minutes && !own ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth disabled={approve.isPending} onPress={() => approveRef.current?.present()} testID="minutes-approve">
                Approve
              </Button>
            </View>
          ) : null}
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={approveRef}
        title="Approve these minutes?"
        description="Once approved they are locked and can't be edited. Make sure you have read them."
        confirmLabel="Approve minutes"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() =>
          approve.mutate(undefined, {
            onSuccess: () => {
              approveRef.current?.dismiss();
              toast.success('Minutes approved');
            },
            onError: (error) => {
              approveRef.current?.dismiss();
              fail(error);
              void minutesQuery.refetch();
            },
          })
        }
      />
    </Screen>
  );
}
