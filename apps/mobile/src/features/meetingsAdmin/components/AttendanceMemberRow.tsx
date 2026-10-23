import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Divider } from '@/components/ui/Divider';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { AttendanceStatus } from '@/types/api/enums';
import type { AttendanceRowDTO } from '@/types/api/meetingsManage';
import { ATTENDANCE_LABELS, MARKABLE_STATUSES, memberRowName } from '../labels';

export type AttendanceMemberRowProps = {
  row: AttendanceRowDTO;
  position: 'first' | 'middle' | 'last' | 'only';
  /** False for a cancelled meeting, or when the officer can only look. */
  editable: boolean;
  onMark: (row: AttendanceRowDTO, status: AttendanceStatus) => void;
};

// Selected state per choice, from the status tokens: present is green, absent red, excused neutral-blue, late amber.
const SELECTED: Record<string, string> = {
  PRESENT: 'border-success bg-success-soft',
  ABSENT: 'border-danger bg-danger-soft',
  APOLOGY: 'border-info bg-info-soft',
  LATE: 'border-warning bg-warning-soft',
};

/** One member: their name and four choices — Present, Absent, Excused, Late. The chosen one is filled; tapping again does nothing new. */
function AttendanceMemberRowBase({ row, position, editable, onMark }: AttendanceMemberRowProps) {
  const isFirst = position === 'first' || position === 'only';
  const isLast = position === 'last' || position === 'only';
  const name = memberRowName(row);

  return (
    <View className={cn('overflow-hidden border-x border-border bg-surface px-4 py-3 dark:border-transparent', isFirst && 'rounded-t-md border-t', isLast && 'rounded-b-md border-b')} testID={`attendance-row-${row.memberId}`}>
      {isFirst ? null : (
        <View className="-mx-4 -mt-3 mb-3">
          <Divider />
        </View>
      )}
      <View className="mb-2 flex-row items-baseline justify-between gap-3">
        <Text variant="body-lg" numberOfLines={1} className="flex-1">
          {name}
        </Text>
        <Text variant="caption" tone="secondary">
          {row.member.memberId}
        </Text>
      </View>
      <View className="flex-row gap-2">
        {MARKABLE_STATUSES.map((status) => {
          const on = row.status === status;
          return (
            <Pressable
              key={status}
              disabled={!editable}
              onPress={() => onMark(row, status)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: !editable }}
              accessibilityLabel={`${ATTENDANCE_LABELS[status]} — ${name}`}
              className={cn('h-10 flex-1 items-center justify-center rounded-md border', on ? SELECTED[status] : 'border-border bg-surface-sunken', !editable && 'opacity-60')}
              testID={`attendance-${row.memberId}-${status}`}
            >
              <Text variant="caption" tone={on ? 'default' : 'secondary'} className={on ? 'font-semibold' : undefined}>
                {ATTENDANCE_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {row.status === 'PENDING' ? (
        <Text variant="caption" tone="tertiary" className="mt-1.5">
          Not marked yet
        </Text>
      ) : null}
    </View>
  );
}

export const AttendanceMemberRow = memo(AttendanceMemberRowBase);
