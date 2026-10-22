import { CalendarCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ListGroup } from '@/components/layout/ListItem';
import { StatTile } from '@/components/ui/StatTile';
import { useMemberAttendance } from '../queries';
import { FactRow } from './FactRow';
import { TabState } from './TabState';

/** MG2 Attendance tab — this member's meeting attendance in totals. Late counts as attended. */
export function MemberAttendanceTab({ memberId }: { memberId: number }) {
  const query = useMemberAttendance(memberId, true);
  const totals = query.data;

  return (
    <TabState isPending={query.isPending} isError={query.isError} error={query.error} onRetry={() => query.refetch()}>
      {!totals ? (
        <EmptyState icon={CalendarCheck} title="No meetings on record" description="Attendance shows up once this member has been marked at a meeting." />
      ) : (
        <View className="gap-6">
          <View className="flex-row gap-3">
            <StatTile label="Attendance" value={`${totals.attendanceRate}%`} tone="primary" />
            <StatTile label="Attended" value={String(totals.attended)} tone="success" />
            <StatTile label="Absent" value={String(totals.absent)} tone="warning" />
          </View>
          <ListGroup>
            <FactRow label="Meetings" value={String(totals.totalMeetings)} />
            <FactRow label="Late" value={String(totals.late)} />
            <FactRow label="Sent apologies" value={String(totals.apologies)} />
          </ListGroup>
        </View>
      )}
    </TabState>
  );
}
