import { client } from '../client';
import { unwrap } from '../envelope';
import type { MemberSelfDTO } from '@/types/api/members';
import type {
  ApprovalDecisionResult,
  ApprovalListDTO,
  ApprovalListParams,
  BulkInviteResultDTO,
  InvitableListDTO,
  InviteSendResult,
  MemberAttendanceTotalsDTO,
  MemberCooperativeProfileDTO,
  MemberDetailDTO,
  MemberFinanceSummaryDTO,
  MemberFormPayload,
  MemberListDTO,
  MemberListParams,
  MembersAccessSettingsDTO,
  MemberStatsDTO,
  MemberWelfareProfileDTO,
  PendingInviteDTO,
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

  /** POST /members — verified against members.controller.ts create (2026-10-24; now saves every field it validates). 400 for a duplicate email or, with automatic IDs off, a missing/duplicate member ID. */
  async createMember(payload: MemberFormPayload): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.post('/members', payload));
  },

  /** PATCH /members/:id — the member ID can't be changed. Setting `status` back to active re-enables a disabled member. */
  async updateMember(id: number, payload: Partial<MemberFormPayload>): Promise<MemberSelfDTO> {
    return unwrap<MemberSelfDTO>(client.patch(`/members/${id}`, payload));
  },

  /** DELETE /members/:id — disables the member (status `terminated`, and their login stops working). 400 while they have unpaid or overdue charges. */
  async disableMember(id: number): Promise<void> {
    await client.delete(`/members/${id}`);
  },

  /** GET /settings/members_access — needs settings.view; callers without it should assume automatic member IDs. */
  async getMembersAccessSettings(): Promise<MembersAccessSettingsDTO> {
    return unwrap<MembersAccessSettingsDTO>(client.get('/settings/members_access'));
  },

  /** GET /member-invites/invitable — only members with an email (invites go out by email). */
  async listInvitable(params: { page: number; limit: number; search?: string }): Promise<InvitableListDTO> {
    return unwrap<InvitableListDTO>(client.get('/member-invites/invitable', { params }));
  },

  /** GET /member-invites/pending */
  async listPendingInvites(): Promise<PendingInviteDTO[]> {
    const data = await unwrap<{ invites: PendingInviteDTO[] }>(client.get('/member-invites/pending'));
    return data.invites;
  },

  /** POST /member-invites/bulk-invite — one result per member; a member that failed carries the reason. */
  async bulkInvite(memberIds: number[]): Promise<BulkInviteResultDTO> {
    return unwrap<BulkInviteResultDTO>(client.post('/member-invites/bulk-invite', { memberIds }));
  },

  /** POST /member-invites/:id/resend — issues a fresh link and expiry. */
  async resendInvite(id: number): Promise<InviteSendResult> {
    const { data: body } = await client.post<{ success: boolean; message: string; data?: { emailSent?: boolean } }>(`/member-invites/${id}/resend`);
    return { emailSent: body.data?.emailSent ?? true, message: body.message };
  },

  /** DELETE /member-invites/:id */
  async revokeInvite(id: number): Promise<void> {
    await client.delete(`/member-invites/${id}`);
  },

  /** GET /members/approvals — self-registrations by decision status (needs members.edit_all). */
  async listApprovals(params: ApprovalListParams): Promise<ApprovalListDTO> {
    return unwrap<ApprovalListDTO>(client.get('/members/approvals', { params }));
  },

  /** PATCH /members/approvals/:userId — approving lets them sign in at once; the member is emailed either way. */
  async decideApproval(userId: number, body: { status: 'approved' | 'rejected'; rejectionReason?: string }): Promise<ApprovalDecisionResult> {
    const { data } = await client.patch<{ success: boolean; message: string; emailSent?: boolean }>(`/members/approvals/${userId}`, body);
    return { message: data.message, emailSent: data.emailSent ?? true };
  },
};
