import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UsersRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { AttendanceMemberRow } from '@/features/meetingsAdmin/components/AttendanceMemberRow';
import { canTakeAttendance, countAttendance, filterAttendance, markAllPresentPayload, quorumMet } from '@/features/meetingsAdmin/labels';
import { useInitializeAttendance, useMarkAttendance, useMarkAttendanceBulk } from '@/features/meetingsAdmin/mutations';
import { MEETINGS_ATTENDANCE_ACCESS, MEETINGS_MODULE, useMeetingAdmin, useMeetingAttendance } from '@/features/meetingsAdmin/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { AttendanceStatus } from '@/types/api/enums';
import type { AttendanceRowDTO } from '@/types/api/meetingsManage';

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/**
 * project-overview.md §6.9 GV4 — take attendance: the roster of active members, each marked Present / Absent / Excused / Late with one tap.
 * A tap shows at once and is put back if saving fails; the counts and quorum follow every tap.
 */
export default function TakeAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const locked = useModuleDisabled(MEETINGS_MODULE);
  const canAttend = useCan(MEETINGS_ATTENDANCE_ACCESS);
  const meetingQuery = useMeetingAdmin(id);
  const attendanceQuery = useMeetingAttendance(id);
  const initialize = useInitializeAttendance(id);
  const mark = useMarkAttendance(id);
  const markAll = useMarkAttendanceBulk(id);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => attendanceQuery.data?.attendance ?? [], [attendanceQuery.data]);
  const visible = useMemo(() => filterAttendance(rows, search), [rows, search]);
  const counts = useMemo(() => countAttendance(rows), [rows]);
  const meeting = meetingQuery.data;
  const editable = meeting ? canTakeAttendance(meeting.status) : false;
  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Attendance" moduleName="Meetings" onBack={back} />;

  if (!canAttend) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Attendance" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const onMark = (row: AttendanceRowDTO, status: AttendanceStatus) => {
    if (row.status === status) return;
    mark.mutate(
      { memberId: row.memberId, status },
      { onError: (error) => toast.error(`${row.member.firstName}: ${error instanceof ApiError ? error.message : 'could not be saved, so it was put back.'}`) },
    );
  };

  const pending = markAllPresentPayload(rows);
  const markEveryone = () =>
    markAll.mutate(pending, {
      onSuccess: () => toast.success(`${pending.length} marked present`),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save. Try again.'),
    });

  const startRoster = () =>
    initialize.mutate(undefined, {
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not start the attendance list. Try again.'),
    });

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Attendance" onBack={back} docsKey="GV4" />

      {meeting ? (
        <Text variant="caption" tone="secondary" className="pb-2" numberOfLines={1}>
          {meeting.title}
        </Text>
      ) : null}

      {attendanceQuery.isPending || meetingQuery.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={96} radius="md" />
          <Skeleton width="100%" height={96} radius="md" />
        </View>
      ) : attendanceQuery.isError ? (
        <ErrorState error={attendanceQuery.error} onRetry={() => attendanceQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No attendance list yet"
          description="Start the list to add every active member as not marked, then tap each person as they arrive."
          actionLabel={editable ? 'Start the attendance list' : undefined}
          onAction={editable ? startRoster : undefined}
        />
      ) : (
        <>
          {!editable ? (
            <View className="mb-3 rounded-lg bg-danger-soft p-3">
              <Text variant="label" tone="danger">
                This meeting was cancelled, so attendance can&apos;t be changed.
              </Text>
            </View>
          ) : null}

          <View className="gap-3 pb-3">
            <View className="flex-row gap-2">
              <StatTile label="Present" value={String(counts.present)} tone="success" />
              <StatTile label="Late" value={String(counts.late)} tone="warning" />
              <StatTile label="Not marked" value={String(counts.pending)} tone="info" />
            </View>
            {meeting?.quorumRequired ? (
              <Text variant="caption" tone={quorumMet(counts.attended, meeting.quorumRequired) ? 'success' : 'warning'} testID="attendance-quorum">
                {quorumMet(counts.attended, meeting.quorumRequired)
                  ? `Quorum met — ${counts.attended} of ${meeting.quorumRequired} needed have attended`
                  : `${counts.attended} of ${meeting.quorumRequired} needed for quorum`}
              </Text>
            ) : null}
            <SearchField value={search} onChangeText={setSearch} placeholder="Search name or member ID" />
          </View>

          <FlashList
            data={visible}
            extraData={rows}
            keyExtractor={(row) => String(row.memberId)}
            renderItem={({ item, index }) => <AttendanceMemberRow row={item} position={positionOf(index, visible.length)} editable={editable} onMark={onMark} />}
            ListEmptyComponent={<EmptyState title="No member matches" description="Try a different name or member ID." />}
            ListFooterComponent={<View className="h-28" />}
            refreshing={attendanceQuery.isRefetching}
            onRefresh={() => void attendanceQuery.refetch()}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {editable && pending.length > 0 ? (
            <StickyFooter>
              <View className="flex-1">
                <Button variant="primary" fullWidth loading={markAll.isPending} onPress={markEveryone} testID="attendance-mark-all">
                  {`Mark the ${pending.length} not marked as present`}
                </Button>
              </View>
            </StickyFooter>
          ) : null}
        </>
      )}
    </Screen>
  );
}
