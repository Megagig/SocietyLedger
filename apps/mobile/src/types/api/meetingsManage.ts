import type { AttendanceStatus, MeetingStatus, MeetingType } from './enums';
import type { IsoDateString } from './common';
import type { MeetingAgendaItemDTO, MeetingBaseDTO, MeetingMemberRefDTO, MeetingMinutesDTO, MeetingUserRefDTO } from './meetings';

/** Officer side of meetings (`/api/meetings`). Rule failures come back as 400/403/404/409 with a plain-words `message` and sometimes a `code`. */

export type MeetingStatsDTO = {
  totalMeetings: number;
  scheduledMeetings: number;
  completedMeetings: number;
  cancelledMeetings: number;
  meetingsThisMonth: number;
  meetingsThisYear: number;
};

export type MeetingListItemDTO = MeetingBaseDTO & {
  creator: MeetingUserRefDTO;
  agendaItems: MeetingAgendaItemDTO[];
  _count: { attendances: number };
};

export type MeetingListDTO = {
  meetings: MeetingListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type MeetingListParams = { status?: MeetingStatus; search?: string; page?: number; limit?: number };

export type MeetingFormPayload = {
  title: string;
  description?: string | null;
  meetingType: MeetingType;
  location?: string | null;
  virtualLink?: string | null;
  startTime: IsoDateString;
  endTime?: IsoDateString | null;
  quorumRequired?: number | null;
};

export type AgendaItemPayload = { orderNumber: number; title: string; description?: string | null; duration?: number | null; presenter?: string | null };

/** One member's row in a meeting's attendance list. */
export type AttendanceRowDTO = {
  id: number;
  meetingId: number;
  memberId: number;
  status: AttendanceStatus;
  checkInTime: IsoDateString | null;
  apologyReason: string | null;
  notes: string | null;
  member: MeetingMemberRefDTO;
};

export type AttendanceCountsDTO = { totalMembers: number; present: number; absent: number; apology: number; late: number; pending: number; quorumMet: boolean };

export type MeetingAttendanceDTO = { attendance: AttendanceRowDTO[]; stats: AttendanceCountsDTO };

export type MarkAttendancePayload = { memberId: number; status: AttendanceStatus; apologyReason?: string | null; notes?: string | null };

export type MinutesPayload = { content: string; decisions?: string | null; actionItems?: string | null; nextMeetingDate?: IsoDateString | null };

export type MinutesDTO = MeetingMinutesDTO;
