import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { CalendarDays, ClipboardList, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { StatTile } from '@/components/ui/StatTile';
import { MeetingRow } from '@/features/meetingsAdmin/components/MeetingRow';
import { MEETINGS_ADMIN_ACCESS, MEETINGS_CREATE_ACCESS, MEETINGS_ATTENDANCE_ACCESS, MEETINGS_MODULE, useMeetingList, useMeetingStats } from '@/features/meetingsAdmin/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import type { MeetingStatus } from '@/types/api/enums';
import type { MeetingListItemDTO } from '@/types/api/meetingsManage';

type Tab = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  SCHEDULED: { title: 'No meetings coming up', description: 'Schedule one and members are told about it.' },
  COMPLETED: { title: 'No meetings held yet', description: 'A meeting moves here by itself once it is over.' },
  CANCELLED: { title: 'No cancelled meetings', description: 'Meetings you cancel show up here, with the reason.' },
};

function positionOf(index: number, count: number): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/** project-overview.md §6.9 GV1 — meetings by status with this year's numbers; schedule a new one. */
export default function MeetingsAdminScreen() {
  const router = useRouter();
  const canAdmin = useCan(MEETINGS_ADMIN_ACCESS);
  const canCreate = useCan(MEETINGS_CREATE_ACCESS);
  const canHistory = useCan(MEETINGS_ATTENDANCE_ACCESS);
  const locked = useModuleDisabled(MEETINGS_MODULE);
  const [tab, setTab] = useState<Tab>('SCHEDULED');
  const stats = useMeetingStats().data;
  const query = useMeetingList(tab as MeetingStatus);
  const meetings = useMemo(() => {
    const all = query.data?.pages.flatMap((page) => page.meetings) ?? [];
    // Upcoming reads best soonest-first; the others newest-first as the API returns them.
    return tab === 'SCHEDULED' ? [...all].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) : all;
  }, [query.data, tab]);
  const back = () => router.back();
  const open = (meeting: MeetingListItemDTO) => router.push(`/(app)/(tabs)/manage/meetings/${meeting.id}` as never);
  const openNew = () => router.push('/(app)/(tabs)/manage/meetings/form' as never);

  if (locked) return <ModuleLockedScreen title="Meetings" moduleName="Meetings" onBack={back} />;

  if (!canAdmin) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Meetings" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const empty = EMPTY_COPY[tab];

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader
        title="Meetings"
        onBack={back}
        docsKey="GV1"
        rightActions={
          <View className="flex-row gap-1">
            {canHistory ? <IconButton icon={ClipboardList} accessibilityLabel="Attendance history" onPress={() => router.push('/(app)/(tabs)/manage/meetings/attendance' as never)} testID="meetings-history" /> : null}
            {canCreate ? <IconButton icon={Plus} accessibilityLabel="Schedule a meeting" onPress={openNew} testID="meetings-new" /> : null}
          </View>
        }
      />

      <View className="gap-3 pb-3">
        {stats ? (
          <View className="flex-row gap-2">
            <StatTile label="Coming up" value={String(stats.scheduledMeetings)} tone="info" />
            <StatTile label="This year" value={String(stats.meetingsThisYear)} tone="primary" />
            <StatTile label="Held" value={String(stats.completedMeetings)} tone="success" />
          </View>
        ) : null}
        <SegmentedControl<Tab>
          options={[
            { label: 'Upcoming', value: 'SCHEDULED' },
            { label: 'Held', value: 'COMPLETED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ]}
          value={tab}
          onChange={setTab}
          testID="meetings-tab"
        />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
          <Skeleton width="100%" height={72} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList
          data={meetings}
          keyExtractor={(meeting) => String(meeting.id)}
          renderItem={({ item, index }) => <MeetingRow meeting={item} position={positionOf(index, meetings.length)} onPress={open} />}
          ListEmptyComponent={
            <EmptyState icon={CalendarDays} title={empty.title} description={empty.description} actionLabel={tab === 'SCHEDULED' && canCreate ? 'Schedule a meeting' : undefined} onAction={tab === 'SCHEDULED' && canCreate ? openNew : undefined} />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner />
              </View>
            ) : (
              <View className="h-6" />
            )
          }
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
