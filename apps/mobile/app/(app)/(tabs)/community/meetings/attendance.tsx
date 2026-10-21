import { useRouter } from 'expo-router';
import { CircleCheck, CircleX, Clock, Info, type LucideIcon } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';
import { format } from 'date-fns';

import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Card } from '@/components/ui/Card';
import { IconCircle, type IconCircleTone } from '@/components/ui/IconCircle';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { useMyAttendance, useMyAttendanceRecords } from '@/features/meetings/queries';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { AttendanceStatus } from '@/types/api/enums';

const STATUS_VIEW: Record<AttendanceStatus, { icon: LucideIcon; tone: IconCircleTone; label: string }> = {
  PRESENT: { icon: CircleCheck, tone: 'success', label: 'Present' },
  LATE: { icon: Clock, tone: 'warning', label: 'Late' },
  ABSENT: { icon: CircleX, tone: 'neutral', label: 'Absent' },
  APOLOGY: { icon: Info, tone: 'info', label: 'Apology' },
  PENDING: { icon: Clock, tone: 'neutral', label: 'Pending' },
};

function RowSkeleton() {
  return (
    <View className="gap-2 px-4 py-3">
      <Skeleton width="65%" height={16} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

/** project-overview.md §6.5 C4 — My Attendance: rate ring + breakdown + per-meeting history (web `member/my-meetings`). */
export default function MyAttendanceScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const locked = useModuleDisabled('meetings');
  const memberId = useMemberId();

  const summaryQuery = useMyAttendance();
  const recordsQuery = useMyAttendanceRecords();

  if (locked) return <ModuleLockedScreen title="My attendance" moduleName="Meetings" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My attendance" onBack={() => router.back()} />
        <NoMemberProfile subject="attendance records" />
      </Screen>
    );
  }

  const summary = summaryQuery.data;
  const records = recordsQuery.data ?? [];
  const refreshing = summaryQuery.isRefetching || recordsQuery.isRefetching;

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="My attendance" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              summaryQuery.refetch();
              recordsQuery.refetch();
            }}
            tintColor={color.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="gap-4">
          <Text variant="body" tone="secondary">
            Your attendance across association meetings
          </Text>

          {summaryQuery.isPending ? (
            <Skeleton width="100%" height={220} radius="lg" />
          ) : summaryQuery.isError ? (
            <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
          ) : (
            <Card className="items-center gap-4">
              <ProgressRing percent={summary?.attendanceRate ?? 0} caption="attendance rate" />
              <Text variant="caption" tone="secondary">
                {summary
                  ? `${summary.attended} of ${summary.totalMeetings} meeting${summary.totalMeetings === 1 ? '' : 's'} attended`
                  : 'No attendance records yet'}
              </Text>
              {summary ? (
                <View className="w-full flex-row gap-3">
                  <StatTile label="Attended" value={String(summary.attended)} tone="success" />
                  <StatTile label="Late" value={String(summary.late)} tone="warning" />
                </View>
              ) : null}
              {summary ? (
                <View className="w-full flex-row gap-3">
                  <StatTile label="Absent" value={String(summary.absent)} tone="accent" />
                  <StatTile label="Apologies" value={String(summary.apologies)} tone="info" />
                </View>
              ) : null}
            </Card>
          )}

          <SectionCard title="History">
            {recordsQuery.isPending ? (
              <RowSkeleton />
            ) : recordsQuery.isError ? (
              <ErrorState error={recordsQuery.error} onRetry={() => recordsQuery.refetch()} />
            ) : records.length > 0 ? (
              records.map((r) => {
                const view = STATUS_VIEW[r.status] ?? STATUS_VIEW.PENDING;
                return (
                  <ListItem
                    key={r.meetingId}
                    leading={<IconCircle icon={view.icon} tone={view.tone} />}
                    title={r.title}
                    meta={
                      r.status === 'APOLOGY' && r.apologyReason
                        ? `${format(new Date(r.startTime), 'EEE d MMM yyyy')} · ${r.apologyReason}`
                        : format(new Date(r.startTime), 'EEE d MMM yyyy · h:mm a')
                    }
                    trailing={<StatusChip status={r.status.toLowerCase()} label={view.label} />}
                    onPress={() => router.push(`/(app)/(tabs)/community/meetings/${r.meetingId}` as never)}
                  />
                );
              })
            ) : (
              <InlineEmpty icon={Clock} message="No attendance records yet" />
            )}
          </SectionCard>
        </View>
      </ScrollView>
    </Screen>
  );
}
