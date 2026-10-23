import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, MoreVertical, Pencil, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { ReasonSheet } from '@/features/cash/components/ReasonSheet';
import { AgendaItemSheet } from '@/features/meetingsAdmin/components/AgendaItemSheet';
import { canCancelMeeting, canCompleteMeeting, canEditMeeting, canTakeAttendance, countAttendance, MEETING_STATUS_LABELS, MEETING_TYPE_LABELS, meetingStatusKey, quorumMet } from '@/features/meetingsAdmin/labels';
import {
  useAddAgendaItem,
  useCancelMeeting,
  useCompleteMeeting,
  useDeleteMeeting,
  useRemoveAgendaItem,
  useReorderAgenda,
  useUpdateAgendaItem,
} from '@/features/meetingsAdmin/mutations';
import {
  MEETINGS_ATTENDANCE_ACCESS,
  MEETINGS_DELETE_ACCESS,
  MEETINGS_EDIT_ACCESS,
  MEETINGS_MINUTES_ACCESS,
  MEETINGS_MODULE,
  useMeetingAdmin,
} from '@/features/meetingsAdmin/queries';
import { reorderedAgenda, toAgendaPayload, type AgendaFormValues } from '@/features/meetingsAdmin/schemas';
import { FactRow } from '@/features/members/components/FactRow';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';

/** project-overview.md §6.9 GV3 — one meeting: when and where, the agenda, who came, the minutes; take attendance, write minutes, edit, cancel. */
export default function MeetingAdminDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const locked = useModuleDisabled(MEETINGS_MODULE);
  const canEdit = useCan(MEETINGS_EDIT_ACCESS);
  const canDelete = useCan(MEETINGS_DELETE_ACCESS);
  const canAttend = useCan(MEETINGS_ATTENDANCE_ACCESS);
  const canMinutes = useCan(MEETINGS_MINUTES_ACCESS);
  const query = useMeetingAdmin(id);
  const complete = useCompleteMeeting(id);
  const cancel = useCancelMeeting(id);
  const remove = useDeleteMeeting(id);
  const addItem = useAddAgendaItem(id);
  const updateItem = useUpdateAgendaItem(id);
  const removeItem = useRemoveAgendaItem(id);
  const reorder = useReorderAgenda(id);
  const actionsRef = useRef<BottomSheetModal>(null);
  const cancelRef = useRef<BottomSheetModal>(null);
  const deleteRef = useRef<BottomSheetModal>(null);
  const completeRef = useRef<BottomSheetModal>(null);
  const agendaRef = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<{ id: number | null; values: Partial<AgendaFormValues> } | null>(null);
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/meetings/${path}` as never);

  if (locked) return <ModuleLockedScreen title="Meetings" moduleName="Meetings" onBack={back} />;

  const meeting = query.data;
  const fail = (error: unknown, fallback: string) => {
    toast.error(error instanceof ApiError ? error.message : fallback);
    void query.refetch();
  };

  if (!query.isPending && !query.isError && !meeting) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Meeting" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const status = meeting?.status;
  const counts = meeting ? countAttendance(meeting.attendances) : null;
  const agenda = meeting?.agendaItems ?? [];
  const showEdit = !!meeting && canEdit && canEditMeeting(meeting.status);
  const showComplete = !!meeting && canEdit && canCompleteMeeting(meeting.status);
  const showCancel = !!meeting && canDelete && canCancelMeeting(meeting.status);
  const hasMore = showEdit || showComplete || showCancel || (canDelete && !!meeting);

  const openItem = (item: { id: number; title: string; presenter: string | null; duration: number | null; description: string | null } | null) => {
    setEditing(
      item
        ? { id: item.id, values: { title: item.title, presenter: item.presenter ?? '', duration: item.duration ? String(item.duration) : '', description: item.description ?? '' } }
        : { id: null, values: {} },
    );
    agendaRef.current?.present();
  };

  const saveItem = (values: AgendaFormValues) => {
    const done = {
      onSuccess: () => {
        agendaRef.current?.dismiss();
        toast.success(editing?.id ? 'Agenda item updated' : 'Agenda item added');
      },
      onError: (error: unknown) => fail(error, 'Could not save the agenda item. Try again.'),
    };
    if (editing?.id) updateItem.mutate({ agendaId: editing.id, payload: toAgendaPayload(values, agenda.find((a) => a.id === editing.id)?.orderNumber ?? 1) }, done);
    else addItem.mutate(toAgendaPayload(values, agenda.length + 1), done);
  };

  const move = (itemId: number, direction: 'up' | 'down') => {
    const next = reorderedAgenda(agenda, itemId, direction);
    if (next) reorder.mutate(next, { onError: (error) => fail(error, 'Could not reorder the agenda. Try again.') });
  };

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <ScreenHeader
        title="Meeting"
        onBack={back}
        docsKey="GV3"
        rightActions={hasMore ? <IconButton icon={MoreVertical} accessibilityLabel="More actions" onPress={() => actionsRef.current?.present()} testID="meeting-more" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      ) : query.isError || !meeting ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="h2" align="center">
              {meeting.title}
            </Text>
            <StatusChip status={meetingStatusKey(meeting.status)} label={MEETING_STATUS_LABELS[meeting.status]} />
            <Text variant="caption" tone="secondary" align="center">
              {`${MEETING_TYPE_LABELS[meeting.meetingType]} · ${formatDate(meeting.startTime, 'long')} · ${formatDate(meeting.startTime, 'time')}${meeting.endTime ? ` to ${formatDate(meeting.endTime, 'time')}` : ''}`}
            </Text>
          </View>

          {meeting.status === 'CANCELLED' ? (
            <View className="gap-1 rounded-lg bg-danger-soft p-4" testID="meeting-cancelled">
              <Text variant="label" tone="danger">
                Cancelled{meeting.cancelledAt ? ` on ${formatDate(meeting.cancelledAt, 'long')}` : ''}
              </Text>
              {meeting.cancellationReason ? <Text variant="body">{meeting.cancellationReason}</Text> : null}
            </View>
          ) : null}

          <Section title="Details">
            <ListGroup>
              <FactRow label="Venue" value={meeting.location} />
              {meeting.virtualLink ? (
                <ListItem title="Online link" meta={meeting.virtualLink} showChevron onPress={() => void Linking.openURL(meeting.virtualLink as string)} testID="meeting-link" />
              ) : null}
              <FactRow label="Quorum" value={meeting.quorumRequired ? `${meeting.quorumRequired} members` : 'Not set'} />
              <FactRow label="Scheduled by" value={meeting.creator.email} />
            </ListGroup>
            {meeting.description ? (
              <Text variant="body" tone="secondary">
                {meeting.description}
              </Text>
            ) : null}
          </Section>

          <Section title={agenda.length === 0 ? 'Agenda' : `Agenda · ${agenda.length}`}>
            {agenda.length === 0 ? (
              <Text variant="body" tone="secondary">
                No agenda yet.
              </Text>
            ) : (
              <ListGroup>
                {agenda.map((item, index) => (
                  <ListItem
                    key={item.id}
                    title={`${index + 1}. ${item.title}`}
                    meta={[item.presenter, item.duration ? `${item.duration} min` : null].filter(Boolean).join(' · ') || undefined}
                    trailing={
                      showEdit ? (
                        <View className="flex-row items-center">
                          <IconButton icon={ArrowUp} accessibilityLabel="Move up" onPress={() => move(item.id, 'up')} disabled={index === 0 || reorder.isPending} />
                          <IconButton icon={ArrowDown} accessibilityLabel="Move down" onPress={() => move(item.id, 'down')} disabled={index === agenda.length - 1 || reorder.isPending} />
                          <IconButton icon={Pencil} accessibilityLabel="Edit item" onPress={() => openItem(item)} />
                          <IconButton
                            icon={Trash2}
                            accessibilityLabel="Remove item"
                            tone="danger"
                            onPress={() => removeItem.mutate(item.id, { onError: (error) => fail(error, 'Could not remove the item. Try again.') })}
                          />
                        </View>
                      ) : undefined
                    }
                    testID={`agenda-item-${item.id}`}
                  />
                ))}
              </ListGroup>
            )}
            {showEdit ? (
              <Button variant="soft" onPress={() => openItem(null)} testID="agenda-add">
                Add an agenda item
              </Button>
            ) : null}
          </Section>

          {counts ? (
            <Section title="Attendance">
              <ListGroup>
                <FactRow label="On the list" value={String(counts.total)} />
                <FactRow label="Attended (present or late)" value={String(counts.attended)} />
                <FactRow label="Excused" value={String(counts.excused)} />
                <FactRow label="Absent" value={String(counts.absent)} />
                <FactRow label="Not marked" value={String(counts.pending)} />
                {meeting.quorumRequired ? <FactRow label="Quorum" value={quorumMet(counts.attended, meeting.quorumRequired) ? 'Met' : 'Not met'} /> : null}
              </ListGroup>
            </Section>
          ) : null}

          <Section title="Minutes">
            <ListGroup>
              <ListItem
                title={meeting.minutes ? (meeting.minutes.approvedAt ? 'Approved' : 'Written, waiting for approval') : 'Not written yet'}
                meta={meeting.minutes?.approver ? `Approved by ${meeting.minutes.approver.email}` : meeting.minutes ? `Written by ${meeting.minutes.recorder.email}` : undefined}
                showChevron
                onPress={() => go(`${id}/minutes`)}
                testID="meeting-minutes"
              />
            </ListGroup>
          </Section>
        </View>
      )}

      {meeting && status && canTakeAttendance(status) && (canAttend || canMinutes) ? (
        <StickyFooter>
          {canAttend ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth onPress={() => go(`${id}/attendance`)} testID="meeting-attendance">
                Take attendance
              </Button>
            </View>
          ) : null}
          {canMinutes ? (
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => go(`${id}/minutes`)} testID="meeting-write-minutes">
                Minutes
              </Button>
            </View>
          ) : null}
        </StickyFooter>
      ) : null}

      <BottomSheet ref={actionsRef} title="Meeting actions" snapPoints={['50%']}>
        <View className="gap-3 pb-6">
          {showEdit ? (
            <Button variant="secondary" onPress={() => { actionsRef.current?.dismiss(); router.push(`/(app)/(tabs)/manage/meetings/form?id=${id}` as never); }} testID="meeting-edit">
              Edit details
            </Button>
          ) : null}
          {showComplete ? (
            <Button variant="secondary" onPress={() => { actionsRef.current?.dismiss(); completeRef.current?.present(); }} testID="meeting-complete">
              Mark as held
            </Button>
          ) : null}
          {showCancel ? (
            <Button variant="danger" onPress={() => { actionsRef.current?.dismiss(); cancelRef.current?.present(); }} testID="meeting-cancel">
              Cancel meeting
            </Button>
          ) : null}
          {canDelete && meeting ? (
            <Button variant="danger" onPress={() => { actionsRef.current?.dismiss(); deleteRef.current?.present(); }} testID="meeting-delete">
              Delete meeting
            </Button>
          ) : null}
        </View>
      </BottomSheet>

      <AgendaItemSheet ref={agendaRef} initial={editing ? editing.values : null} loading={addItem.isPending || updateItem.isPending} onSubmit={saveItem} />

      <ConfirmSheet
        ref={completeRef}
        title="Mark this meeting as held?"
        description="It moves to Held. A meeting does this by itself once its end time passes."
        confirmLabel="Mark as held"
        cancelLabel="Not yet"
        destructive={false}
        onConfirm={() =>
          complete.mutate(undefined, {
            onSuccess: () => {
              completeRef.current?.dismiss();
              toast.success('Marked as held');
            },
            onError: (error) => {
              completeRef.current?.dismiss();
              fail(error, 'Could not update the meeting. Try again.');
            },
          })
        }
      />

      <ReasonSheet
        ref={cancelRef}
        title="Cancel this meeting?"
        description="Every member is told, with your reason. This can't be undone."
        placeholder="For example: the venue is no longer available"
        confirmLabel="Cancel meeting"
        keepLabel="Keep it"
        loading={cancel.isPending}
        onSubmit={(reason) =>
          cancel.mutate(reason, {
            onSuccess: () => {
              cancelRef.current?.dismiss();
              toast.success('Meeting cancelled — members have been told');
            },
            onError: (error) => {
              cancelRef.current?.dismiss();
              fail(error, 'Could not cancel the meeting. Try again.');
            },
          })
        }
        testID="cancel-meeting"
      />

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this meeting?"
        description="The meeting, its agenda, attendance and minutes are removed for good. If it was already held, cancel it instead to keep the history."
        confirmLabel="Delete meeting"
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              deleteRef.current?.dismiss();
              toast.success('Meeting deleted');
              router.replace('/(app)/(tabs)/manage/meetings' as never);
            },
            onError: (error) => {
              deleteRef.current?.dismiss();
              fail(error, 'Could not delete the meeting. Try again.');
            },
          })
        }
      />
    </Screen>
  );
}
