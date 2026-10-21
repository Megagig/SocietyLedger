/** Meetings (member-visible) — `/api/meetings/*` (tenant required) — api-contract.md §8. */
import type { MeetingType, MeetingStatus, AttendanceStatus } from './enums';
import type { IsoDateString } from './common';

export type MeetingUserRefDTO = { id: number; email: string };
export type MeetingMemberRefDTO = { id: number; firstName: string; lastName: string; memberId: string };

export type MeetingAgendaItemDTO = {
  id: number;
  meetingId: number;
  orderNumber: number;
  title: string;
  description: string | null;
  duration: number | null;
  presenter: string | null;
};

export type MeetingAttendanceDTO = {
  id: number;
  meetingId: number;
  memberId: number;
  status: AttendanceStatus;
  checkInTime: IsoDateString | null;
  checkOutTime: IsoDateString | null;
  apologyReason: string | null;
  markedBy: number | null;
  markedAt: IsoDateString | null;
  notes: string | null;
  member: MeetingMemberRefDTO;
  marker: MeetingUserRefDTO | null;
};

export type MeetingMinutesDTO = {
  id: number;
  meetingId: number;
  content: string;
  decisions: string | null;
  actionItems: string | null;
  nextMeetingDate: IsoDateString | null;
  recordedBy: number;
  approvedBy: number | null;
  approvedAt: IsoDateString | null;
  recorder: MeetingUserRefDTO;
  approver: MeetingUserRefDTO | null;
};

/** Base `Meeting` row shared by every endpoint below. */
export type MeetingBaseDTO = {
  id: number;
  associationId: number;
  title: string;
  description: string | null;
  meetingType: MeetingType;
  location: string | null;
  virtualLink: string | null;
  startTime: IsoDateString;
  endTime: IsoDateString | null;
  status: MeetingStatus;
  quorumRequired: number | null;
  createdBy: number;
  cancelledBy: number | null;
  cancelledAt: IsoDateString | null;
  cancellationReason: string | null;
  reminderSent: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

/** GET /meetings/upcoming?limit (default 5) — verified 2026-10-19. Bare array, no wrapper/pagination. `status: 'SCHEDULED'`, future `startTime`. */
export type UpcomingMeetingDTO = MeetingBaseDTO & {
  creator: MeetingUserRefDTO;
  _count: { agendaItems: number };
};

/** GET /meetings/recent?limit — verified 2026-10-19. Bare array, `status: 'COMPLETED'`. */
export type RecentMeetingDTO = MeetingBaseDTO & {
  creator: MeetingUserRefDTO;
  _count: { attendances: number };
};

export type AttendanceStatsDTO = {
  totalMembers: number;
  present: number;
  absent: number;
  apology: number;
  late: number;
  pending: number;
  quorumMet: boolean;
};

/**
 * GET /meetings/:id — verified 2026-10-19. `attendanceStats` is merged FLAT into the meeting
 * object (`{ ...meeting, attendanceStats }`), not nested under a `meeting` key.
 * Gap: a non-existent meeting id 404s correctly on this endpoint (unlike voting's :id — see voting.ts).
 */
export type MeetingDetailDTO = MeetingBaseDTO & {
  creator: MeetingUserRefDTO;
  canceller: MeetingUserRefDTO | null;
  agendaItems: MeetingAgendaItemDTO[];
  attendances: MeetingAttendanceDTO[];
  minutes: MeetingMinutesDTO | null;
  attendanceStats: AttendanceStatsDTO;
};
