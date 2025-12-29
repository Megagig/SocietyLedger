// ============================================
// PHASE 5.5: WELFARE & SOCIAL FUNDS TYPES
// ============================================

import { Decimal } from '@prisma/client/runtime/library';

// Welfare Fund Types
export type WelfareFundType = 'EMERGENCY' | 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'GENERAL' | 'OTHER';
export type WelfareFundStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

// Contribution Types
export type ContributionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

// Payout Types
export type PayoutRequestStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED';
export type PayoutType = 'REGULAR' | 'EMERGENCY' | 'BEREAVEMENT';

// Welfare Fund Interface
export interface WelfareFund {
  id: number;
  associationId: number;
  name: string;
  description?: string | null;
  fundType: WelfareFundType;
  targetBalance?: Decimal | null;
  currentBalance: Decimal;
  monthlyContribution?: Decimal | null;
  isContributionMandatory: boolean;
  minContribution?: Decimal | null;
  maxPayout?: Decimal | null;
  waitingPeriodDays: number;
  minContributionMonths: number;
  isActive: boolean;
  status: WelfareFundStatus;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

// Welfare Contribution Interface
export interface WelfareContribution {
  id: number;
  associationId: number;
  fundId: number;
  memberId: number;
  amount: Decimal;
  contributionDate: Date;
  paymentMethod?: string | null;
  reference?: string | null;
  status: ContributionStatus;
  confirmedBy?: number | null;
  confirmedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
}

// Welfare Payout Request Interface
export interface WelfarePayoutRequest {
  id: number;
  associationId: number;
  fundId: number;
  memberId: number;
  requestNumber: string;
  payoutType: PayoutType;
  amount: Decimal;
  reason: string;
  supportingDocuments?: string | null;
  status: PayoutRequestStatus;
  requestedAt: Date;
  reviewedBy?: number | null;
  reviewedAt?: Date | null;
  reviewComments?: string | null;
  approvedBy?: number | null;
  approvedAt?: Date | null;
  approvedAmount?: Decimal | null;
  rejectionReason?: string | null;
  disbursedBy?: number | null;
  disbursedAt?: Date | null;
  disbursementMethod?: string | null;
  disbursementReference?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types
export interface CreateWelfareFundRequest {
  name: string;
  description?: string;
  fundType: WelfareFundType;
  targetBalance?: number;
  monthlyContribution?: number;
  isContributionMandatory?: boolean;
  minContribution?: number;
  maxPayout?: number;
  waitingPeriodDays?: number;
  minContributionMonths?: number;
}

export interface UpdateWelfareFundRequest {
  name?: string;
  description?: string;
  fundType?: WelfareFundType;
  targetBalance?: number;
  monthlyContribution?: number;
  isContributionMandatory?: boolean;
  minContribution?: number;
  maxPayout?: number;
  waitingPeriodDays?: number;
  minContributionMonths?: number;
  status?: WelfareFundStatus;
}

export interface RecordContributionRequest {
  fundId: number;
  memberId: number;
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

export interface BulkContributionRequest {
  fundId: number;
  memberIds: number[];
  amount: number;
  contributionDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CreatePayoutRequestRequest {
  fundId: number;
  payoutType: PayoutType;
  amount: number;
  reason: string;
  supportingDocuments?: string;
}

export interface ReviewPayoutRequest {
  status: 'APPROVED' | 'REJECTED';
  approvedAmount?: number;
  comments?: string;
  rejectionReason?: string;
}

export interface DisbursePayoutRequest {
  disbursementMethod: string;
  disbursementReference?: string;
  notes?: string;
}

// Query Parameters
export interface WelfareFundQueryParams {
  page?: string;
  limit?: string;
  fundType?: WelfareFundType;
  status?: WelfareFundStatus;
  search?: string;
}

export interface ContributionQueryParams {
  page?: string;
  limit?: string;
  fundId?: string;
  memberId?: string;
  status?: ContributionStatus;
  startDate?: string;
  endDate?: string;
}

export interface PayoutQueryParams {
  page?: string;
  limit?: string;
  fundId?: string;
  memberId?: string;
  status?: PayoutRequestStatus;
  payoutType?: PayoutType;
  startDate?: string;
  endDate?: string;
}

// Dashboard/Analytics Types
export interface WelfareDashboardStats {
  totalFunds: number;
  activeFunds: number;
  totalBalance: Decimal;
  totalContributions: Decimal;
  totalPayouts: Decimal;
  pendingPayoutRequests: number;
  memberParticipationRate: number;
}

export interface MemberWelfareProfile {
  memberId: number;
  memberName: string;
  totalContributions: Decimal;
  contributionCount: number;
  lastContributionDate?: Date;
  totalPayoutsReceived: Decimal;
  payoutCount: number;
  eligibleFunds: number[];
  pendingRequests: number;
}

export interface FundSummary {
  fundId: number;
  fundName: string;
  fundType: WelfareFundType;
  currentBalance: Decimal;
  totalContributions: Decimal;
  totalPayouts: Decimal;
  contributorCount: number;
  pendingPayouts: number;
}
