import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Divider } from '@/components/ui/Divider';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { MEETINGS_ATTENDANCE_ACCESS, MEETINGS_MODULE, useAttendanceHistoryAll } from '@/features/meetingsAdmin/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { cn } from '@/lib/cn';
import type { MemberAttendanceHistoryDTO } from '@/types/api/meetings';

/** A rate worth worrying about is under half; worth praising is 80% and above. */
const rateTone = (rate: number) => (rate >= 80 ? 'success' : rate < 50 ? 'danger' : 'default');

/** project-overview.md §6.9 GV6 — how often each member comes to meetings: attended, late, excused, absent, and the rate. */
export default function AttendanceHistoryScreen() {
  const router = useRouter();
  const locked = useModuleDisabled(MEETINGS_MODULE);
  const canView = useCan(MEETINGS_ATTENDANCE_ACCESS);
  const query = useAttendanceHistoryAll();
  const [search, setSearch] = useState('');
  const back = () => router.back();

  const rows = useMemo(() => {
    const all = query.data ?? [];
    const term = search.trim().toLowerCase();
    // Lowest attendance first — the members worth a call.
    return [...all].filter((r) => !term || r.memberName.toLowerCase().includes(term)).sort((a, b) => a.attendanceRate - b.attendanceRate);
  }, [query.data, search]);

  if (locked) return <ModuleLockedScreen title="Attendance history" moduleName="Meetings" onBack={back} />;

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Attendance history" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Attendance history" onBack={back} docsKey="GV6" />

      <View className="pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search a member" />
      </View>

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={64} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlashList<MemberAttendanceHistoryDTO>
          data={rows}
          keyExtractor={(row) => String(row.memberId)}
          ItemSeparatorComponent={Divider}
          renderItem={({ item }) => (
            <View className="min-h-[64px] flex-row items-center gap-3 py-3" testID={`history-row-${item.memberId}`}>
              <View className="flex-1 gap-0.5">
                <Text variant="body-lg" numberOfLines={1}>
                  {item.memberName}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {`${item.attended} of ${item.totalMeetings} attended · ${item.late} late · ${item.apologies} excused · ${item.absent} absent`}
                </Text>
              </View>
              <Text variant="h3" tone={rateTone(item.attendanceRate)} className={cn('w-[64px] text-right')}>
                {`${item.attendanceRate}%`}
              </Text>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon={ClipboardList} title={search ? 'No member matches' : 'No attendance yet'} description={search ? 'Try a different name.' : 'Rates appear once attendance has been taken at a meeting.'} />}
          ListFooterComponent={<View className="h-6" />}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
