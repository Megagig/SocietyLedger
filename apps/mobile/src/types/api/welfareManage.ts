import type { IsoDateString, MoneyValue } from './common';
import type { PaginationDTO } from './cooperatives';

/**
 * The officer side of welfare (`/api/welfare`): funds, contributions and payout requests. Amounts arrive as decimal strings. Rule failures
 * answer 400/403/404/409 with a plain-words `message` and a `code` (`OWN_REQUEST`, `OWN_RECORDING`, `ALREADY_DECIDED`,
 * `ALREADY_DISBURSED`, `APPROVAL_TOO_LARGE`, `MAX_PAYOUT_EXCEEDED`, `FUND_INSUFFICIENT`, `MEMBER_NOT_ACTIVE`, `BELOW_MINIMUM`, …).
 */

export type FundKind = 'GENERAL' | 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING';
export type FundStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export type ContributionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type PayoutStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED';
export type PayoutKind = 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING' | 'OTHER';

export type WelfareDashboardDTO = {
  totalFunds: number;
  activeFunds: number;
  totalBalance: MoneyValue;
  totalContributions: MoneyValue;
  totalPayouts: MoneyValue;
  pendingPayoutRequests: number;
  /** Percent of active members who have contributed. */
  memberParticipationRate: number;
};

export type OfficerFundDTO = {
  id: number;
  name: string;
  description: string | null;
  fundType: FundKind;
  targetBalance: MoneyValue | null;
  currentBalance: MoneyValue;
  monthlyContribution: MoneyValue | null;
  isContributionMandatory: boolean;
  minContribution: MoneyValue | null;
  maxPayout: MoneyValue | null;
  waitingPeriodDays: number;
  minContributionMonths: number;
  status: FundStatus;
  createdAt: IsoDateString;
  _count: { contributions: number; payoutRequests: number };
};

export type OfficerFundsDTO = { funds: OfficerFundDTO[]; pagination: PaginationDTO };

export type FundPayload = {
  name: string;
  description?: string | null;
  fundType: FundKind;
  targetBalance?: number | null;
  monthlyContribution?: number | null;
  isContributionMandatory: boolean;
  minContribution?: number | null;
  maxPayout?: number | null;
  waitingPeriodDays: number;
  minContributionMonths: number;
  status?: FundStatus;
};

type MemberRef = { id: number; memberId: string | null; firstName: string; lastName: string };

export type OfficerContributionDTO = {
  id: number;
  fundId: number;
  memberId: number;
  amount: MoneyValue;
  contributionDate: IsoDateString;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: ContributionStatus;
  /** Who recorded it. The same officer can't confirm it. Null on older contributions. */
  recordedBy: number | null;
  confirmedAt: IsoDateString | null;
  fund: { id: number; name: string; fundType: FundKind };
  member: MemberRef;
  confirmer: { id: number; email: string } | null;
};

export type OfficerContributionsDTO = { contributions: OfficerContributionDTO[]; pagination: PaginationDTO };

export type RecordContributionPayload = {
  fundId: number;
  memberId: number;
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

export type BulkContributionPayload = {
  fundId: number;
  memberIds: number[];
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  notes?: string;
};

export type OfficerPayoutDTO = {
  id: number;
  fundId: number;
  memberId: number;
  requestNumber: string;
  payoutType: PayoutKind;
  amount: MoneyValue;
  approvedAmount: MoneyValue | null;
  reason: string;
  supportingDocuments: string | null;
  status: PayoutStatus;
  reviewComments: string | null;
  rejectionReason: string | null;
  disbursementMethod: string | null;
  disbursementReference: string | null;
  requestedAt: IsoDateString;
  reviewedAt: IsoDateString | null;
  approvedAt: IsoDateString | null;
  disbursedAt: IsoDateString | null;
  fund: { id: number; name: string; fundType: FundKind };
  member: MemberRef;
  reviewer: { id: number; email: string } | null;
  approver: { id: number; email: string } | null;
  disburser: { id: number; email: string } | null;
};

export type OfficerPayoutsDTO = { requests: OfficerPayoutDTO[]; pagination: PaginationDTO };

export type ReviewPayoutPayload = { status: 'APPROVED'; approvedAmount?: number; comments?: string } | { status: 'REJECTED'; rejectionReason: string; comments?: string };

export type DisbursePayoutPayload = { disbursementMethod: string; disbursementReference?: string; notes?: string };
