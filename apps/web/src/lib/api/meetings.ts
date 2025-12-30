import { apiGet, apiPost, apiPatch, apiDelete } from '@/utils/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// MEETINGS API CLIENT
// Phase 12.5: Meetings & Attendance Management
// ============================================

// Types
export interface Meeting {
  id: number;
  associationId: number;
  title: string;
  description?: string;
  meetingType: MeetingType;
  location?: string;
  virtualLink?: string;
  startTime: string;
  endTime?: string;
  status: MeetingStatus;
  quorumRequired?: number;
  reminderSent: boolean;
  createdBy: number;
  cancelledBy?: number;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  creator?: { id: number; email: string };
  canceller?: { id: number; email: string };
  agendaItems?: AgendaItem[];
  attendances?: Attendance[];
  minutes?: MeetingMinutes;
  _count?: { attendances: number; agendaItems: number };
  attendanceStats?: AttendanceStats;
}

export interface AgendaItem {
  id: number;
  meetingId: number;
  orderNumber: number;
  title: string;
  description?: string;
  duration?: number;
  presenter?: string;
}

export interface Attendance {
  id: number;
  meetingId: number;
  memberId: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  apologyReason?: string;
  notes?: string;
  markedBy?: number;
  markedAt?: string;
  member?: {
    id: number;
    firstName: string;
    lastName: string;
    memberId: string;
    email?: string;
  };
  marker?: { id: number; email: string };
}

export interface MeetingMinutes {
  id: number;
  meetingId: number;
  content: string;
  decisions?: string;
  actionItems?: string;
  nextMeetingDate?: string;
  recordedBy: number;
  approvedBy?: number;
  approvedAt?: string;
  recorder?: { id: number; email: string };
  approver?: { id: number; email: string };
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

export interface MeetingStats {
  totalMeetings: number;
  scheduledMeetings: number;
  completedMeetings: number;
  cancelledMeetings: number;
  meetingsThisMonth: number;
  meetingsThisYear: number;
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

export type MeetingType = 'REGULAR' | 'EMERGENCY' | 'AGM' | 'EGM' | 'COMMITTEE' | 'SPECIAL';
export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT' | 'APOLOGY' | 'LATE';

// ==================== DASHBOARD & STATS ====================

export async function getMeetingStats() {
  const response = await apiGet(`${API_URL}/api/meetings/stats`);
  if (!response.ok) throw new Error('Failed to fetch meeting statistics');
  return response.json();
}

export async function getUpcomingMeetings(limit = 5) {
  const response = await apiGet(`${API_URL}/api/meetings/upcoming?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch upcoming meetings');
  return response.json();
}

export async function getRecentMeetings(limit = 5) {
  const response = await apiGet(`${API_URL}/api/meetings/recent?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch recent meetings');
  return response.json();
}

export async function getAttendanceHistory(memberId?: number) {
  const params = memberId ? `?memberId=${memberId}` : '';
  const response = await apiGet(`${API_URL}/api/meetings/attendance-history${params}`);
  if (!response.ok) throw new Error('Failed to fetch attendance history');
  return response.json();
}

// ==================== MEETING CRUD ====================

export async function getMeetings(params?: {
  page?: number;
  limit?: number;
  status?: MeetingStatus;
  meetingType?: MeetingType;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'startTime' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);
  if (params?.meetingType) searchParams.set('meetingType', params.meetingType);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const response = await apiGet(`${API_URL}/api/meetings?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch meetings');
  return response.json();
}

export async function getMeeting(id: number) {
  const response = await apiGet(`${API_URL}/api/meetings/${id}`);
  if (!response.ok) throw new Error('Failed to fetch meeting');
  return response.json();
}

export async function createMeeting(data: {
  title: string;
  description?: string;
  meetingType?: MeetingType;
  location?: string;
  virtualLink?: string;
  startTime: string;
  endTime?: string;
  quorumRequired?: number;
  agendaItems?: {
    orderNumber: number;
    title: string;
    description?: string;
    duration?: number;
    presenter?: string;
  }[];
}) {
  const response = await apiPost(`${API_URL}/api/meetings`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create meeting');
  }
  return response.json();
}

export async function updateMeeting(id: number, data: {
  title?: string;
  description?: string;
  meetingType?: MeetingType;
  location?: string;
  virtualLink?: string;
  startTime?: string;
  endTime?: string;
  status?: MeetingStatus;
  quorumRequired?: number;
}) {
  const response = await apiPatch(`${API_URL}/api/meetings/${id}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update meeting');
  }
  return response.json();
}

export async function cancelMeeting(id: number, reason: string) {
  const response = await apiPost(`${API_URL}/api/meetings/${id}/cancel`, { reason });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel meeting');
  }
  return response.json();
}

export async function deleteMeeting(id: number) {
  const response = await apiDelete(`${API_URL}/api/meetings/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete meeting');
  }
  return response.json();
}


// ==================== AGENDA ITEMS ====================

export async function addAgendaItem(meetingId: number, data: {
  orderNumber: number;
  title: string;
  description?: string;
  duration?: number;
  presenter?: string;
}) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/agenda`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add agenda item');
  }
  return response.json();
}

export async function updateAgendaItem(meetingId: number, agendaId: number, data: {
  orderNumber?: number;
  title?: string;
  description?: string;
  duration?: number;
  presenter?: string;
}) {
  const response = await apiPatch(`${API_URL}/api/meetings/${meetingId}/agenda/${agendaId}`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update agenda item');
  }
  return response.json();
}

export async function deleteAgendaItem(meetingId: number, agendaId: number) {
  const response = await apiDelete(`${API_URL}/api/meetings/${meetingId}/agenda/${agendaId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete agenda item');
  }
  return response.json();
}

// ==================== ATTENDANCE ====================

export async function getAttendance(meetingId: number) {
  const response = await apiGet(`${API_URL}/api/meetings/${meetingId}/attendance`);
  if (!response.ok) throw new Error('Failed to fetch attendance');
  return response.json();
}

export async function initializeAttendance(meetingId: number) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/attendance/initialize`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to initialize attendance');
  }
  return response.json();
}

export async function markAttendance(meetingId: number, data: {
  memberId: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  apologyReason?: string;
  notes?: string;
}) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/attendance`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark attendance');
  }
  return response.json();
}

export async function bulkMarkAttendance(meetingId: number, attendances: {
  memberId: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  apologyReason?: string;
  notes?: string;
}[]) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/attendance/bulk`, { attendances });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark attendance');
  }
  return response.json();
}

// ==================== MINUTES ====================

export async function getMinutes(meetingId: number) {
  const response = await apiGet(`${API_URL}/api/meetings/${meetingId}/minutes`);
  if (!response.ok) throw new Error('Failed to fetch minutes');
  return response.json();
}

export async function createMinutes(meetingId: number, data: {
  content: string;
  decisions?: string;
  actionItems?: string;
  nextMeetingDate?: string;
}) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/minutes`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create minutes');
  }
  return response.json();
}

export async function updateMinutes(meetingId: number, data: {
  content?: string;
  decisions?: string;
  actionItems?: string;
  nextMeetingDate?: string;
}) {
  const response = await apiPatch(`${API_URL}/api/meetings/${meetingId}/minutes`, data);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update minutes');
  }
  return response.json();
}

export async function approveMinutes(meetingId: number) {
  const response = await apiPost(`${API_URL}/api/meetings/${meetingId}/minutes/approve`, {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to approve minutes');
  }
  return response.json();
}
