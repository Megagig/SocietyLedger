/** `members.routes.ts` officer endpoints (list, stats, detail) and the per-member tabs — verified 2026-10-24. */
import type { IsoDateString, MoneyValue } from './common';
import type { MemberSelfDTO } from './members';

export type MemberLoginStatus = 'no_login' | 'invited' | 'active';
export type MemberStatus = 'active' | 'inactive' | 'suspended' | 'terminated';
export type MemberCategory = 'regular' | 'executive' | 'honorary' | 'student';

/** GET /members — a member row plus the linked login account, if any. `status`/`category` stay `string` (free-form columns). */
export type MemberListItemDTO = MemberSelfDTO & {
  user: { id: number; email: string; role: string; isActive: boolean } | null;
};

export type MemberListDTO = {
  members: MemberListItemDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type MemberListParams = {
  page: number;
  limit: number;
  search?: string;
  status?: MemberStatus;
  category?: MemberCategory;
  loginStatus?: MemberLoginStatus;
};

/** GET /members/stats */
export type MemberStatsDTO = {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  suspendedMembers: number;
  terminatedMembers: number;
  newThisMonth: number;
  withLogin: number;
  byCategory: Record<string, number>;
};

/** GET /members/:id — `financialSummary` sums every charge against every payment (balance is a number, the others Decimal strings). */
export type MemberDetailDTO = MemberListItemDTO & {
  financialSummary: { totalDues: MoneyValue; totalPaid: MoneyValue; balance: MoneyValue };
};

/** GET /finance/members/:memberId/summary */
export type MemberFinanceSummaryDTO = {
  summary: { totalDues: MoneyValue; totalPaid: MoneyValue; balance: MoneyValue; pendingCount: number; overdueCount: number };
  byCategory: Record<string, { total: MoneyValue; paid: MoneyValue; pending: MoneyValue }>;
};

/** GET /meetings/attendance-history?memberId= — an empty list when the member has no meetings on record. */
export type MemberAttendanceTotalsDTO = {
  memberId: number;
  memberName: string;
  totalMeetings: number;
  attended: number;
  absent: number;
  apologies: number;
  late: number;
  attendanceRate: number;
};

/** GET /cooperatives/members/:id/profile (the fields the member screen reads). */
export type MemberCooperativeProfileDTO = {
  memberId: number;
  totalSavings: MoneyValue;
  lockedSavings: MoneyValue;
  availableSavings: MoneyValue;
  totalOutstandingLoans: MoneyValue;
  guarantorExposure: MoneyValue;
  creditScore: number;
  savingsAccounts: unknown[];
  activeLoans: unknown[];
  memberSince: IsoDateString;
};

/** GET /welfare/members/:memberId/profile */
export type MemberWelfareProfileDTO = {
  memberId: number;
  totalContributions: MoneyValue;
  contributionCount: number;
  lastContributionDate: IsoDateString | null;
  totalPayoutsReceived: MoneyValue;
  payoutCount: number;
  pendingRequests: number;
};

/** POST /members, PATCH /members/:id — empty strings are sent as null by the form layer; `memberId` is only read on create when the association turned automatic IDs off. */
export type MemberFormPayload = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: IsoDateString | null;
  gender: 'male' | 'female' | 'other';
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  occupation?: string | null;
  category: MemberCategory;
  status: MemberStatus;
  joinDate: IsoDateString;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  notes?: string | null;
  memberId?: string | null;
};

/** GET /settings/members_access (needs settings.view) — only the field the member form reads. */
export type MembersAccessSettingsDTO = { memberIdAutoGenerate?: boolean };

/** GET /member-invites/invitable — members with an email, no login yet, not terminated. */
export type InvitableMemberDTO = MemberSelfDTO & {
  invites: { id: number; status: string; inviteTokenExpiresAt: IsoDateString; createdAt: IsoDateString }[];
};

export type InvitableListDTO = {
  members: InvitableMemberDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

/** GET /member-invites/pending */
export type PendingInviteDTO = {
  id: number;
  memberId: number;
  email: string | null;
  phone: string | null;
  status: string;
  inviteTokenExpiresAt: IsoDateString;
  createdAt: IsoDateString;
  member: { id: number; firstName: string; lastName: string; email: string | null; memberId: string };
  invitedBy: { id: number; email: string } | null;
};

/** POST /member-invites/bulk-invite → `data` */
export type BulkInviteResultDTO = {
  results: { memberId: number; success: boolean; emailSent?: boolean; message: string }[];
};

/** Result of sending or resending one invite. `emailSent: false` means the invite exists but the email didn't go out. */
export type InviteSendResult = { emailSent: boolean; message: string };

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** GET /members/approvals */
export type ApprovalDTO = {
  id: number;
  userId: number;
  approvalStatus: ApprovalStatus | string;
  createdAt: IsoDateString;
  approvalDate: IsoDateString | null;
  rejectionReason: string | null;
  user: {
    id: number;
    email: string;
    role: string;
    emailVerified: boolean;
    isActive: boolean;
    createdAt: IsoDateString;
    member: { id: number; memberId: string; firstName: string; lastName: string; phone: string | null } | null;
  };
  approvedBy: { id: number; email: string } | null;
};

export type ApprovalListDTO = { approvals: ApprovalDTO[]; total: number; page: number; limit: number; totalPages: number };

export type ApprovalListParams = { status: ApprovalStatus; page: number; limit: number; search?: string };

/** PATCH /members/approvals/:userId — the API answers `emailSent: false` when the decision saved but the member's email didn't go out. */
export type ApprovalDecisionResult = { message: string; emailSent: boolean };
