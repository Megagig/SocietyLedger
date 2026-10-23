import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateTimeField } from '@/components/forms/DateTimeField';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { canEditMeeting, MEETING_TYPE_OPTIONS } from '@/features/meetingsAdmin/labels';
import { useCreateMeeting, useUpdateMeeting } from '@/features/meetingsAdmin/mutations';
import { MEETINGS_CREATE_ACCESS, MEETINGS_EDIT_ACCESS, useMeetingAdmin } from '@/features/meetingsAdmin/queries';
import { emptyMeetingValues, meetingFormSchema, meetingToFormValues, toMeetingPayload, type MeetingFormValues } from '@/features/meetingsAdmin/schemas';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 GV2 — schedule a meeting, or change one (`?id=`). The agenda is built on the meeting's own page. */
export default function MeetingFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isEdit = editId !== undefined;
  const canCreate = useCan(MEETINGS_CREATE_ACCESS);
  const canEdit = useCan(MEETINGS_EDIT_ACCESS);
  const meetingQuery = useMeetingAdmin(editId ?? NaN);
  const create = useCreateMeeting();
  const update = useUpdateMeeting(editId ?? 0);
  const { control, handleSubmit, reset } = useForm<MeetingFormValues>({ resolver: zodResolver(meetingFormSchema), defaultValues: emptyMeetingValues(), mode: 'onTouched' });
  const back = () => router.back();
  const title = isEdit ? 'Edit meeting' : 'Schedule a meeting';
  const meeting = meetingQuery.data;

  useEffect(() => {
    if (meeting) reset(meetingToFormValues(meeting));
  }, [meeting, reset]);

  if (isEdit ? !canEdit : !canCreate) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (isEdit && meetingQuery.isPending) {
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

  if (isEdit && (meetingQuery.isError || !meeting)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState error={meetingQuery.error} onRetry={() => meetingQuery.refetch()} />
      </Screen>
    );
  }

  if (isEdit && meeting && !canEditMeeting(meeting.status)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <ErrorState title="This meeting can't be edited." description="It was cancelled or has already been held." />
      </Screen>
    );
  }

  const fail = (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Could not save the meeting. Try again.');

  const onSubmit = (values: MeetingFormValues) => {
    const payload = toMeetingPayload(values);
    if (isEdit) {
      update.mutate(payload, {
        onSuccess: () => {
          toast.success('Meeting updated');
          router.back();
        },
        onError: fail,
      });
      return;
    }
    create.mutate(payload, {
      onSuccess: (created) => {
        toast.success('Meeting scheduled — members have been told');
        router.replace(`/(app)/(tabs)/manage/meetings/${created.id}` as never);
      },
      onError: fail,
    });
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={title} onBack={back} docsKey="GV2" />

      <View className="gap-6 pb-6">
        <Section title="The meeting">
          <View className="gap-4">
            <TextField control={control} name="title" label="Title" placeholder="October general meeting" autoCapitalize="sentences" testID="meeting-title" />
            <SelectSheet control={control} name="meetingType" label="Kind of meeting" options={MEETING_TYPE_OPTIONS} placeholder="Choose the kind" />
            <TextField control={control} name="description" label="What it is about (optional)" multiline />
          </View>
        </Section>

        <Section title="When">
          <View className="gap-4">
            <DateTimeField control={control} name="startTime" label="Starts" testID="meeting-start" />
            <DateTimeField control={control} name="endTime" label="Ends (optional)" clearable placeholder="Not set" helper="If you leave it empty the meeting counts as over 3 hours after it starts." />
          </View>
        </Section>

        <Section title="Where">
          <View className="gap-4">
            <TextField control={control} name="location" label="Venue (optional)" placeholder="Town hall, Oko" autoCapitalize="sentences" />
            <TextField control={control} name="virtualLink" label="Online link (optional)" placeholder="https://meet.google.com/…" keyboardType="url" />
          </View>
        </Section>

        <Section title="Quorum">
          <TextField control={control} name="quorumRequired" label="Members needed to hold the meeting (optional)" keyboardType="number-pad" helper="Attendance shows whether quorum is met." />
        </Section>

        {!isEdit ? (
          <Text variant="caption" tone="secondary">
            Members are notified when you schedule it. You can add the agenda on the next screen.
          </Text>
        ) : null}
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button variant="primary" fullWidth loading={create.isPending || update.isPending} onPress={() => { void handleSubmit(onSubmit)(); }} testID="meeting-save">
            {isEdit ? 'Save changes' : 'Schedule meeting'}
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
