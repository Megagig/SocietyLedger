/** Welfare module types — `/api/welfare/*` (tenant required) — api-contract.md §12. Verified 2026-10-21. */
import type { IsoDateString } from './common';

export type WelfarePayoutType = 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION' | 'EMERGENCY' | 'MATERNITY' | 'WEDDING' | 'OTHER';

/** GET /welfare/my-profile — member welfare profile. Amounts come back as Decimal-serialized strings. */
export type MemberWelfareProfileDTO = {
  memberId: number;
  memberName: string;
  totalContributions: string | number;
  contributionCount: number;
  lastContributionDate: IsoDateString | null | undefined;
  totalPayoutsReceived: string | number;
  payoutCount: number;
  eligibleFunds: number[];
  pendingRequests: number;
};

export type WelfareFundDTO = {
  id: number;
  associationId: number;
  name: string;
  description: string | null;
  fundType: string;
  status: string;
  balance: string | number;
  minimumContributionMonths: number | null;
  createdAt: IsoDateString;
  _count: { contributions: number; payoutRequests: number };
};

export type WelfareFundsResponseDTO = {
  funds: WelfareFundDTO[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
};

export type CreatePayoutRequestPayload = {
  fundId: number;
  payoutType: WelfarePayoutType;
  amount: number;
  reason: string;
  supportingDocuments?: string | null;
};

export type WelfareContributionStatusValue = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type WelfarePayoutStatusValue = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED';

export type WelfareFundRefDTO = { id: number; name: string; fundType: string };

/** POST /welfare/payouts response — the raw WelfarePayoutRequest row (the amount column is `amount`, not `requestedAmount`). */
export type PayoutRequestDTO = {
  id: number;
  fundId: number;
  memberId: number;
  requestNumber: string;
  payoutType: WelfarePayoutType;
  amount: number | string;
  approvedAmount: number | string | null;
  reason: string;
  status: WelfarePayoutStatusValue;
  requestedAt: IsoDateString;
  createdAt: IsoDateString;
};

/** GET /welfare/contributions — verified against welfare.service.ts listContributions (2026-10-21). */
export type WelfareContributionDTO = {
  id: number;
  fundId: number;
  memberId: number;
  amount: number | string;
  contributionDate: IsoDateString;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: WelfareContributionStatusValue;
  fund: WelfareFundRefDTO;
};

/** GET /welfare/payouts — verified against welfare.service.ts listPayoutRequests (2026-10-21). */
export type WelfarePayoutListItemDTO = PayoutRequestDTO & {
  rejectionReason: string | null;
  reviewComments: string | null;
  fund: WelfareFundRefDTO;
};

export type WelfarePagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

export type WelfareContributionsResponseDTO = { contributions: WelfareContributionDTO[]; pagination: WelfarePagination };
export type WelfarePayoutsResponseDTO = { requests: WelfarePayoutListItemDTO[]; pagination: WelfarePagination };
