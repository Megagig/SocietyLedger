import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Divider } from '@/components/ui/Divider';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { MeetingListItemDTO } from '@/types/api/meetingsManage';
import { MEETING_STATUS_LABELS, MEETING_TYPE_LABELS, meetingStatusKey } from '../labels';

export type MeetingRowProps = {
  meeting: MeetingListItemDTO;
  position: 'first' | 'middle' | 'last' | 'only';
  onPress: (meeting: MeetingListItemDTO) => void;
};

/** One meeting: its title, kind and when, where it is, and its status. */
function MeetingRowBase({ meeting, position, onPress }: MeetingRowProps) {
  const { color } = useThemeTokens();
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const statusLabel = MEETING_STATUS_LABELS[meeting.status];
  const where = meeting.location || (meeting.virtualLink ? 'Online' : null);

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')}>
      {isFirst ? null : <Divider />}
      <Pressable
        onPress={() => onPress(meeting)}
        accessibilityRole="button"
        accessibilityLabel={`${meeting.title}, ${formatDate(meeting.startTime, 'long')}, ${statusLabel}`}
        android_ripple={{ color: `${color.primary}1F` }}
        className="min-h-[72px] flex-row items-center px-4 py-3"
        testID={`meeting-row-${meeting.id}`}
      >
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1} className={meeting.status === 'CANCELLED' ? 'opacity-60' : undefined}>
            {meeting.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${formatDate(meeting.startTime, 'long')} · ${formatDate(meeting.startTime, 'time')}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {where ? `${MEETING_TYPE_LABELS[meeting.meetingType]} · ${where}` : MEETING_TYPE_LABELS[meeting.meetingType]}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <StatusChip status={meetingStatusKey(meeting.status)} label={statusLabel} />
          {meeting._count.attendances > 0 ? (
            <Text variant="caption" tone="secondary">
              {`${meeting._count.attendances} on the list`}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={20} color={color.textTertiary} strokeWidth={1.75} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

export const MeetingRow = memo(MeetingRowBase);
