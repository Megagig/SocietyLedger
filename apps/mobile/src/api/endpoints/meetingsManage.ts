import { client } from '../client';
import { unwrap } from '../envelope';
import type { MeetingDetailDTO, MemberAttendanceHistoryDTO } from '@/types/api/meetings';
import type {
  AgendaItemPayload,
  MarkAttendancePayload,
  MeetingAttendanceDTO,
  MeetingFormPayload,
  MeetingListDTO,
  MeetingListParams,
  MeetingStatsDTO,
  MinutesDTO,
  MinutesPayload,
} from '@/types/api/meetingsManage';

/**
 * Meetings for officers. Seeing them needs `members.view_own` (everyone), creating `members.create`, editing and the agenda
 * `members.edit`, cancelling and deleting `members.disable`, attendance `meetings.manage_attendance`, minutes
 * `meetings.manage_minutes` — the API's rules. A meeting that is over becomes Completed by itself.
 */
export const meetingsManageApi = {
  async getStats(): Promise<MeetingStatsDTO> {
    return unwrap<MeetingStatsDTO>(client.get('/meetings/stats'));
  },

  /** GET /meetings — newest first, one status at a time when given. */
  async list(params: MeetingListParams): Promise<MeetingListDTO> {
    return unwrap<MeetingListDTO>(client.get('/meetings', { params }));
  },

  async get(id: number): Promise<MeetingDetailDTO> {
    return unwrap<MeetingDetailDTO>(client.get(`/meetings/${id}`));
  },

  async create(payload: MeetingFormPayload): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.post('/meetings', payload));
  },

  async update(id: number, payload: Partial<MeetingFormPayload>): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.patch(`/meetings/${id}`, payload));
  },

  /** POST /meetings/:id/cancel — a reason is required and members are told. 409 for a meeting already cancelled or held. */
  async cancel(id: number, reason: string): Promise<void> {
    await unwrap<unknown>(client.post(`/meetings/${id}/cancel`, { reason }));
  },

  /** POST /meetings/:id/complete — closes a scheduled or in-progress meeting by hand. */
  async complete(id: number): Promise<void> {
    await unwrap<unknown>(client.post(`/meetings/${id}/complete`));
  },

  /** DELETE /meetings/:id — 409 when cash was collected at it (cancel it instead). */
  async remove(id: number): Promise<void> {
    await unwrap<unknown>(client.delete(`/meetings/${id}`));
  },

  async addAgendaItem(id: number, payload: AgendaItemPayload): Promise<unknown> {
    return unwrap<unknown>(client.post(`/meetings/${id}/agenda`, payload));
  },

  async updateAgendaItem(id: number, agendaId: number, payload: Partial<AgendaItemPayload>): Promise<unknown> {
    return unwrap<unknown>(client.patch(`/meetings/${id}/agenda/${agendaId}`, payload));
  },

  async removeAgendaItem(id: number, agendaId: number): Promise<void> {
    await unwrap<unknown>(client.delete(`/meetings/${id}/agenda/${agendaId}`));
  },

  /** PUT /meetings/:id/agenda/reorder — the whole new order in one call. */
  async reorderAgenda(id: number, items: { id: number; orderNumber: number }[]): Promise<void> {
    await unwrap<unknown>(client.put(`/meetings/${id}/agenda/reorder`, { items }));
  },

  /** POST /meetings/:id/attendance/initialize — adds every active member as Pending (nobody already marked is changed). */
  async initializeAttendance(id: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`/meetings/${id}/attendance/initialize`));
  },

  async getAttendance(id: number): Promise<MeetingAttendanceDTO> {
    return unwrap<MeetingAttendanceDTO>(client.get(`/meetings/${id}/attendance`));
  },

  /** POST /meetings/:id/attendance — one member. 409 for a cancelled meeting. */
  async markAttendance(id: number, payload: MarkAttendancePayload): Promise<unknown> {
    return unwrap<unknown>(client.post(`/meetings/${id}/attendance`, payload));
  },

  /** POST /meetings/:id/attendance/bulk — many members at once, all or nothing on the membership check. */
  async markAttendanceBulk(id: number, attendances: MarkAttendancePayload[]): Promise<unknown> {
    return unwrap<unknown>(client.post(`/meetings/${id}/attendance/bulk`, { attendances }));
  },

  /** GET /meetings/:id/minutes — null when none were written yet. */
  async getMinutes(id: number): Promise<MinutesDTO | null> {
    try {
      return await unwrap<MinutesDTO | null>(client.get(`/meetings/${id}/minutes`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },

  async createMinutes(id: number, payload: MinutesPayload): Promise<MinutesDTO> {
    return unwrap<MinutesDTO>(client.post(`/meetings/${id}/minutes`, payload));
  },

  /** PATCH /meetings/:id/minutes — 409 once approved. */
  async updateMinutes(id: number, payload: Partial<MinutesPayload>): Promise<MinutesDTO> {
    return unwrap<MinutesDTO>(client.patch(`/meetings/${id}/minutes`, payload));
  },

  /** POST /meetings/:id/minutes/approve — by an officer other than the author, once (403 / 409 otherwise). */
  async approveMinutes(id: number): Promise<MinutesDTO> {
    return unwrap<MinutesDTO>(client.post(`/meetings/${id}/minutes/approve`));
  },

  /** GET /meetings/attendance-history — attendance totals and rates for every member. */
  async getAttendanceHistory(): Promise<MemberAttendanceHistoryDTO[]> {
    return unwrap<MemberAttendanceHistoryDTO[]>(client.get('/meetings/attendance-history'));
  },
};
