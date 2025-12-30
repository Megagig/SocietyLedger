// Meeting Types for Phase 12.5: Meetings & Attendance Management

export type MeetingType = 'REGULAR' | 'EMERGENCY' | 'AGM' | 'EGM' | 'COMMITTEE' | 'SPECIAL';
export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT' | 'APOLOGY' | 'LATE';

export interface CreateMeetingInput {
  title: string;
  description?: string | null;
  meetingType?: MeetingType;
  location?: string | null;
  virtualLink?: string | null;
  startTime: Date;
  endTime?: Date | null;
  quorumRequired?: number | null;
  agendaItems?: CreateAgendaItemInput[];
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string | null;
  meetingType?: MeetingType;
  location?: string | null;
  virtualLink?: string | null;
  startTime?: Date | string;
  endTime?: Date | string | null;
  status?: MeetingStatus;
  quorumRequired?: number | null;
}

export interface CreateAgendaItemInput {
  orderNumber: number;
  title: string;
  description?: string | null;
  duration?: number | null;
  presenter?: string | null;
}

export interface UpdateAgendaItemInput {
  orderNumber?: number;
  title?: string;
  description?: string | null;
  duration?: number | null;
  presenter?: string | null;
}

export interface MarkAttendanceInput {
  memberId: number;
  status: AttendanceStatus;
  checkInTime?: Date | string | null;
  checkOutTime?: Date | string | null;
  apologyReason?: string | null;
  notes?: string | null;
}

export interface BulkMarkAttendanceInput {
  attendances: MarkAttendanceInput[];
}

export interface CreateMinutesInput {
  content: string;
  decisions?: string | null;
  actionItems?: string | null;
  nextMeetingDate?: Date | string | null;
}

export interface UpdateMinutesInput {
  content?: string;
  decisions?: string | null;
  actionItems?: string | null;
  nextMeetingDate?: Date | string | null;
}

export interface MeetingQueryParams {
  page?: number;
  limit?: number;
  status?: MeetingStatus;
  meetingType?: MeetingType;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: 'startTime' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface AttendanceStats {
  totalMembers: number;
  present: number;
  absent: number;
  apology: number;
  late: number;
  pending: number;
  quorumMet: boolean;
}

export interface MemberAttendanceHistory {
  memberId: number;
  memberName: string;
  totalMeetings: number;
  attended: number;
  absent: number;
  apologies: number;
  late: number;
  attendanceRate: number;
}
