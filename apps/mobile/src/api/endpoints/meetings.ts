import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  MeetingDetailDTO,
  MemberAttendanceHistoryDTO,
  MyAttendanceResponseDTO,
  RecentMeetingDTO,
  UpcomingMeetingDTO,
} from '@/types/api/meetings';

/** `/meetings/*` (tenant required — api-contract.md §8). */
export const meetingsApi = {
  /** GET /meetings/upcoming?limit — verified against meetings.controller.ts getUpcoming
   * (2026-10-20). Bare array, no pagination wrapper; `limit` is genuinely respected here
   * (unlike `/members/me/payments`). */
  async getUpcoming(limit: number): Promise<UpcomingMeetingDTO[]> {
    return unwrap<UpcomingMeetingDTO[]>(client.get('/meetings/upcoming', { params: { limit } }));
  },

  /** GET /meetings/recent?limit — verified 2026-10-19. Bare array, `status: 'COMPLETED'`. */
  async getRecent(limit: number): Promise<RecentMeetingDTO[]> {
    return unwrap<RecentMeetingDTO[]>(client.get('/meetings/recent', { params: { limit } }));
  },

  /** GET /meetings/:id — full meeting row with agendaItems, attendances, minutes (types/api/meetings.ts). */
  async getById(id: number): Promise<MeetingDetailDTO> {
    return unwrap<MeetingDetailDTO>(client.get(`/meetings/${id}`));
  },

  /** GET /meetings/my-attendance — the caller's own per-meeting attendance (server derives the member from the token). */
  async getMyAttendanceRecords(): Promise<MyAttendanceResponseDTO> {
    return unwrap<MyAttendanceResponseDTO>(client.get('/meetings/my-attendance'));
  },

  /** GET /meetings/attendance-history?memberId — the caller's own totals when `memberId` is passed
   * (0 or 1 items; empty = no attendance records yet). Requires MEETING_VIEW. */
  async getAttendanceHistory(memberId: number): Promise<MemberAttendanceHistoryDTO[]> {
    return unwrap<MemberAttendanceHistoryDTO[]>(client.get('/meetings/attendance-history', { params: { memberId } }));
  },
};
