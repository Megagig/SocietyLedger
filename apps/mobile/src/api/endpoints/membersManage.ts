import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  MemberAttendanceTotalsDTO,
  MemberCooperativeProfileDTO,
  MemberDetailDTO,
  MemberFinanceSummaryDTO,
  MemberListDTO,
  MemberListParams,
  MemberStatsDTO,
  MemberWelfareProfileDTO,
} from '@/types/api/membersManage';

/**
 * Officer-side member endpoints. Everything is scoped to the caller's association server-side; the reads need
 * `members.view` (the per-member tabs need the finance / meetings / cooperatives / welfare keys noted on each call).
 */
export const membersManageApi = {
  /** GET /members — verified against members.controller.ts list + members.query.ts (2026-10-24). Page size is capped at 100. */
  async listMembers(params: MemberListParams): Promise<MemberListDTO> {
    return unwrap<MemberListDTO>(client.get('/members', { params: { ...params, sortBy: 'firstName', sortOrder: 'asc' } }));
  },

  /** GET /members/stats — verified against members.controller.ts getStats (2026-10-24). */
  async getStats(): Promise<MemberStatsDTO> {
    return unwrap<MemberStatsDTO>(client.get('/members/stats'));
  },

  /** GET /members/:id — 404 for a member of another association. */
  async getMember(id: number): Promise<MemberDetailDTO> {
    return unwrap<MemberDetailDTO>(client.get(`/members/${id}`));
  },

  /** GET /finance/members/:memberId/summary — needs ledger.view or members.view. */
  async getFinanceSummary(memberId: number): Promise<MemberFinanceSummaryDTO> {
    return unwrap<MemberFinanceSummaryDTO>(client.get(`/finance/members/${memberId}/summary`));
  },

  /** GET /meetings/attendance-history?memberId= — officers may pass any member; returns the totals row or nothing. */
  async getAttendanceTotals(memberId: number): Promise<MemberAttendanceTotalsDTO | null> {
    const rows = await unwrap<MemberAttendanceTotalsDTO[]>(client.get('/meetings/attendance-history', { params: { memberId } }));
    return rows[0] ?? null;
  },

  /** GET /cooperatives/members/:id/profile — needs ledger.create (cooperative savings management). */
  async getCooperativeProfile(memberId: number): Promise<MemberCooperativeProfileDTO> {
    return unwrap<MemberCooperativeProfileDTO>(client.get(`/cooperatives/members/${memberId}/profile`));
  },

  /** GET /welfare/members/:memberId/profile — needs welfare management (ledger.create). */
  async getWelfareProfile(memberId: number): Promise<MemberWelfareProfileDTO> {
    return unwrap<MemberWelfareProfileDTO>(client.get(`/welfare/members/${memberId}/profile`));
  },
};
