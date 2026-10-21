import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CalendarDays, MapPin, Users, Video } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { format, isToday, isTomorrow } from 'date-fns';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { ErrorState } from '@/components/feedback/ErrorState';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { Text } from '@/components/ui/Text';
import { useMyAttendance, useRecentMeetings, useUpcomingMeetings } from '@/features/meetings/queries';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { MeetingBaseDTO } from '@/types/api/meetings';

type Tab = 'upcoming' | 'past';

function formatMeetingTime(isoDate: string): string {
  const d = new Date(isoDate);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'EEE d MMM · h:mm a');
}

function MeetingCard({ meeting, onPress }: { meeting: MeetingBaseDTO; onPress: () => void }) {
  const { color } = useThemeTokens();
  const start = new Date(meeting.startTime);
  const isOnline = !!meeting.virtualLink && !meeting.location;
  const PlaceIcon = isOnline ? Video : MapPin;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" android_ripple={{ color: `${color.primary}1F` }}>
      <Card className="flex-row gap-3">
        <View className="h-[56px] w-[56px] items-center justify-center rounded-md bg-primary-soft">
          <Text variant="h3" tone="primary">
            {format(start, 'd')}
          </Text>
          <Text variant="micro" tone="secondary">
            {format(start, 'MMM')}
          </Text>
        </View>
        <View className="flex-1 gap-1">
          <Text variant="body-strong" numberOfLines={2}>
            {meeting.title}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatMeetingTime(meeting.startTime)}
          </Text>
          <View className="flex-row items-center gap-1">
            <PlaceIcon size={14} color={color.textTertiary} strokeWidth={1.75} />
            <Text variant="caption" tone="tertiary" numberOfLines={1} className="flex-1">
              {isOnline ? t('meetings.joinOnline') : (meeting.location ?? t('home.meeting.noLocation'))}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/** project-overview.md §6.5 C2 — Meetings: upcoming/past list + the caller's attendance stats (web "My Meetings"). */
export default function MeetingsScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();
  const [tab, setTab] = useState<Tab>('upcoming');

  const upcomingQuery = useUpcomingMeetings(20);
  const recentQuery = useRecentMeetings(20);
  const attendanceQuery = useMyAttendance();
  const locked = useModuleDisabled('meetings');
  const memberId = useMemberId();

  const activeQuery = tab === 'upcoming' ? upcomingQuery : recentQuery;
  const meetings: MeetingBaseDTO[] = activeQuery.data ?? [];
  const attendance = attendanceQuery.data;

  if (locked) return <ModuleLockedScreen title={t('meetings.title')} moduleName="Meetings" onBack={() => router.back()} />;

  const goAttendance = () => router.push('/(app)/(tabs)/community/meetings/attendance' as never);

  const header = (
    <View className="gap-4 pb-4">
      <SegmentedControl<Tab>
        options={[
          { label: t('meetings.upcoming'), value: 'upcoming' },
          { label: t('meetings.past'), value: 'past' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {!memberId ? (
        <Card>
          <Text variant="caption" tone="secondary">
            Attendance is tracked per member — this account has no member profile.
          </Text>
        </Card>
      ) : attendanceQuery.isPending ? (
        <View className="flex-row gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width="30%" height={76} radius="lg" />
          ))}
        </View>
      ) : (
        <View className="gap-2">
          <Pressable onPress={goAttendance} accessibilityRole="button" accessibilityLabel="View my attendance" className="flex-row gap-3">
            <StatTile label="Total meetings" value={String(attendance?.totalMeetings ?? 0)} tone="info" />
            <StatTile label="Attended" value={String(attendance?.attended ?? 0)} tone="success" />
            <StatTile label="Attendance rate" value={`${attendance?.attendanceRate ?? 0}%`} tone="accent" />
          </Pressable>
          <Pressable onPress={goAttendance} accessibilityRole="button" hitSlop={8} className="self-end">
            <Text variant="label" tone="primary">
              View my attendance
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const footer =
    attendanceQuery.isSuccess && !attendance ? (
      <Card className="mt-4 items-center gap-2 py-8">
        <View className="h-[56px] w-[56px] items-center justify-center rounded-full bg-surface-sunken">
          <Users size={28} color={color.textTertiary} strokeWidth={1.5} />
        </View>
        <Text variant="body" tone="secondary">
          No attendance records yet
        </Text>
      </Card>
    ) : undefined;

  let empty: React.ReactElement;
  if (activeQuery.isPending) {
    empty = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={88} radius="lg" />
        ))}
      </View>
    );
  } else if (activeQuery.isError) {
    empty = <ErrorState error={activeQuery.error} onRetry={() => activeQuery.refetch()} />;
  } else {
    empty = (
      <EmptyState
        icon={CalendarDays}
        title={tab === 'upcoming' ? 'No upcoming meetings scheduled' : t('meetings.emptyPast')}
      />
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title={t('meetings.title')} onBack={() => router.back()} />

      <FlatList
        data={activeQuery.isSuccess ? meetings : []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        renderItem={({ item }) => (
          <View className="pb-3">
            <MeetingCard
              meeting={item}
              onPress={() => router.push(`/(app)/(tabs)/community/meetings/${item.id}` as never)}
            />
          </View>
        )}
        refreshing={activeQuery.isRefetching}
        onRefresh={() => {
          activeQuery.refetch();
          attendanceQuery.refetch();
        }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
