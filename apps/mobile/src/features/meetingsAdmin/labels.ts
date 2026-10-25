import type { AttendanceStatus, MeetingStatus, MeetingType } from '@/types/api/enums';
import type { AttendanceRowDTO, MarkAttendancePayload } from '@/types/api/meetingsManage';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  REGULAR: 'Regular meeting',
  EMERGENCY: 'Emergency meeting',
  AGM: 'Annual general meeting',
  EGM: 'Extraordinary general meeting',
  COMMITTEE: 'Committee meeting',
  SPECIAL: 'Special meeting',
};

export const MEETING_TYPE_OPTIONS = (Object.keys(MEETING_TYPE_LABELS) as MeetingType[]).map((value) => ({ value, label: MEETING_TYPE_LABELS[value] }));

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  POSTPONED: 'Postponed',
};

/** The `StatusChip` key for a meeting's status. */
export const meetingStatusKey = (status: MeetingStatus): string => (status === 'IN_PROGRESS' ? 'in_progress' : status.toLowerCase());

/** What the API's "apology" means to people taking attendance: the member sent their apologies, so they're excused. */
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PENDING: 'Not marked',
  PRESENT: 'Present',
  ABSENT: 'Absent',
  APOLOGY: 'Excused',
  LATE: 'Late',
};

/** The four choices an officer makes per member, in the order they appear. */
export const MARKABLE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'APOLOGY', 'LATE'];

// ---------------------------------------------------------------- what can be done to a meeting (mirrors the API's rules)

/** A meeting can be cancelled until it is cancelled or held. */
export const canCancelMeeting = (status: MeetingStatus) => status !== 'CANCELLED' && status !== 'COMPLETED';
/** Only a scheduled or in-progress meeting can be closed by hand. */
export const canCompleteMeeting = (status: MeetingStatus) => status === 'SCHEDULED' || status === 'IN_PROGRESS';
/** Attendance can be taken for anything except a cancelled meeting. */
export const canTakeAttendance = (status: MeetingStatus) => status !== 'CANCELLED';
/** Editing the details makes sense until the meeting is cancelled or completed. */
export const canEditMeeting = (status: MeetingStatus) => status !== 'CANCELLED' && status !== 'COMPLETED';

// ---------------------------------------------------------------- live attendance

export type AttendanceCounts = { total: number; present: number; absent: number; excused: number; late: number; pending: number; attended: number };

/** Counts worked out from the rows on screen, so they move the instant an officer taps (the server's own counts catch up after). */
export function countAttendance(rows: Pick<AttendanceRowDTO, 'status'>[]): AttendanceCounts {
  const counts: AttendanceCounts = { total: rows.length, present: 0, absent: 0, excused: 0, late: 0, pending: 0, attended: 0 };
  for (const row of rows) {
    if (row.status === 'PRESENT') counts.present++;
    else if (row.status === 'ABSENT') counts.absent++;
    else if (row.status === 'APOLOGY') counts.excused++;
    else if (row.status === 'LATE') counts.late++;
    else counts.pending++;
  }
  counts.attended = counts.present + counts.late; // late still came
  return counts;
}

/** Quorum is met once enough members have attended (present or late). With no quorum set, it is always met. */
export const quorumMet = (attended: number, required: number | null): boolean => required === null || attended >= required;

/** Members matching what was typed (name or member ID), in the order given. */
export function filterAttendance(rows: AttendanceRowDTO[], search: string): AttendanceRowDTO[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => `${row.member.firstName} ${row.member.lastName} ${row.member.memberId}`.toLowerCase().includes(term));
}

/** "Mark all present": only members not yet marked, so a decision already made (absent, excused) is never overwritten. */
export function markAllPresentPayload(rows: Pick<AttendanceRowDTO, 'memberId' | 'status'>[]): MarkAttendancePayload[] {
  return rows.filter((row) => row.status === 'PENDING').map((row) => ({ memberId: row.memberId, status: 'PRESENT' as const }));
}

export const memberRowName = (row: Pick<AttendanceRowDTO, 'member'>) => `${row.member.firstName} ${row.member.lastName}`.trim();
