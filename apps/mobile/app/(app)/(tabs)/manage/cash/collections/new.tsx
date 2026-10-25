import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useCreateCashCollection } from '@/features/cash/mutations';
import { CASH_COLLECT_ACCESS } from '@/features/cash/queries';
import { collectionFormSchema, emptyCollectionValues, type CollectionFormValues } from '@/features/cash/schemas';
import { useRecentMeetings, useUpcomingMeetings } from '@/features/meetings/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.9 CA3 — open a collection: one occasion (a meeting, or just a day) on which you will take cash. */
export default function NewCollectionScreen() {
  const router = useRouter();
  const canCollect = useCan(CASH_COLLECT_ACCESS);
  const create = useCreateCashCollection();
  const upcoming = useUpcomingMeetings(10);
  const recent = useRecentMeetings(10);
  const { control, handleSubmit } = useForm<CollectionFormValues>({ resolver: zodResolver(collectionFormSchema), defaultValues: emptyCollectionValues(), mode: 'onTouched' });
  const back = () => router.back();

  // Meetings are optional context — if the meetings module is off or the list fails, the collection simply isn't tied to one.
  const meetingOptions = useMemo(() => {
    const seen = new Set<number>();
    const options = [{ label: 'Not tied to a meeting', value: '' }];
    for (const meeting of [...(upcoming.data ?? []), ...(recent.data ?? [])]) {
      if (seen.has(meeting.id)) continue;
      seen.add(meeting.id);
      options.push({ label: `${meeting.title} · ${formatDate(meeting.startTime, 'long')}`, value: String(meeting.id) });
    }
    return options;
  }, [upcoming.data, recent.data]);

  if (!canCollect) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Open a collection" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const onSubmit = (values: CollectionFormValues) =>
    create.mutate(
      { title: values.title.trim(), meetingId: values.meetingId ? Number(values.meetingId) : null, notes: values.notes.trim() || null },
      {
        onSuccess: (created) => {
          toast.success('Collection opened');
          router.replace(`/(app)/(tabs)/manage/cash/collections/${created.id}` as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not open the collection. Try again.'),
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Open a collection" onBack={back} docsKey="CA3" />

      <View className="gap-6 pb-6">
        <Text variant="body" tone="secondary">
          A collection is one occasion on which you take cash — a meeting, or a day. Every receipt you write goes into it, and when you are done you close it and lodge the cash.
        </Text>

        <Section title="This collection">
          <View className="gap-4">
            <TextField control={control} name="title" label="Name" placeholder="October general meeting" autoCapitalize="sentences" testID="collection-title" />
            {meetingOptions.length > 1 ? <SelectSheet control={control} name="meetingId" label="Meeting (optional)" options={meetingOptions} placeholder="Not tied to a meeting" /> : null}
            <TextField control={control} name="notes" label="Note (optional)" multiline />
          </View>
        </Section>
      </View>

      <StickyFooter>
        <Button variant="primary" loading={create.isPending} onPress={() => { handleSubmit(onSubmit)(); }} testID="collection-save">
          Open collection
        </Button>
      </StickyFooter>
    </Screen>
  );
}
