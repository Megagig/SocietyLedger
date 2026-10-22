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
