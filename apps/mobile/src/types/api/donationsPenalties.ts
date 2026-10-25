import type { MoneyValue } from './common';

/**
 * Donations and penalties for officers (`/api/finance/advanced`). A donation is money received (instant) or promised (a pledge); a
 * penalty is a charge, and a waiver forgives some or all of it. Rule failures answer 400/404/409 with a plain-words `message` and a
 * `code`.
 */

type Pagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

// ---------------------------------------------------------------- donations

export type AllocationKind = 'general' | 'project' | 'emergency' | 'other';
export type DonationType = 'instant' | 'pledge';

export type DonationStatsDTO = {
  totalDonations: number;
  /** Received plus pledged. */
  totalAmount: number;
  /** Money actually paid in. */
  totalReceived: number;
  /** Promised and not yet paid. */
  totalPledged: number;
  byAllocation: { name: string; amount: number; count: number }[];
};

export type AllocationDTO = {
  id: number;
  name: string;
  description: string | null;
  type: AllocationKind;
  targetAmount: MoneyValue | null;
  isActive: boolean;
  stats: { totalDonated: number; donationCount: number; progressPercentage: number | null; remaining: number | null };
};

export type AllocationListDTO = { allocations: AllocationDTO[]; pagination: Pagination };
export type AllocationPayload = { name: string; description?: string; type: AllocationKind; targetAmount?: number; isActive?: boolean };

export type DonationListItemDTO = {
  id: number;
  receiptNumber: string;
  amount: number;
  paidAmount: number;
  status: string;
  isVoided: boolean;
  dueDate: string | null;
  /** Promised and nothing paid yet. */
  isPledge: boolean;
  donor: { id?: number; memberId?: string | null; name: string };
  category: string;
  allocation: { id: number; name: string; type: string } | null;
  donorMessage: string | null;
  createdAt: string;
};

export type DonationListDTO = { donations: DonationListItemDTO[]; pagination: Pagination };

export type DonationReceiptDTO = {
  receiptNumber: string;
  donationDate: string;
  amount: number;
  donor: { id?: number; memberId?: string | null; name: string; email?: string | null; phone?: string | null };
  category: string;
  allocation: { id: number; name: string; type: string } | null;
  donorMessage: string | null;
  association: { id: number; name: string };
  paymentMethod: string;
};

export type RecordDonationPayload = {
  memberId: number;
  categoryId: number;
  amount: number;
  allocationId?: number;
  donorMessage?: string;
  isAnonymous?: boolean;
  paymentMethod?: string;
  notes?: string;
  donationType: DonationType;
  pledgeDate?: string;
};

// ---------------------------------------------------------------- penalties

export type PenaltyFeeType = 'fixed' | 'percentage';

export type PenaltyRuleDTO = {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  category: { id: number; name: string; type: string } | null;
  triggerType: string;
  gracePeriodDays: number;
  feeType: PenaltyFeeType;
  feeAmount: MoneyValue;
  maxFeeAmount: MoneyValue | null;
  isCompounding: boolean;
  compoundingDays: number | null;
  isActive: boolean;
  _count?: { appliedPenalties: number };
};

export type PenaltyRuleListDTO = { rules: PenaltyRuleDTO[]; pagination: Pagination };

export type PenaltyRulePayload = {
  name: string;
  description?: string;
  categoryId?: number;
  triggerType: 'late_payment';
  gracePeriodDays: number;
  feeType: PenaltyFeeType;
  feeAmount: number;
  maxFeeAmount?: number;
  isCompounding?: boolean;
  compoundingDays?: number;
  isActive?: boolean;
};

export type PenaltyStatsDTO = {
  rules: { total: number; active: number };
  penalties: { totalApplied: number; totalAmount: number; totalCollected: number; totalOutstanding: number };
  waivers: { count: number; totalWaived: number };
};

export type WaiverDTO = {
  id: number;
  transactionId: number;
  waivedAmount: MoneyValue;
  reason: string;
  waivedAt: string;
  transaction: {
    member: { id: number; memberId: string | null; firstName: string; lastName: string };
    category: { id: number; name: string };
  };
};

export type WaiverListDTO = { waivers: WaiverDTO[]; pagination: Pagination };
export type WaivePayload = { waivedAmount: number; reason: string };
export type WaiveResultDTO = { id: number; newAmount: number; fullyWaived: boolean };

export type LateFeePreviewDTO = {
  count: number;
  memberCount: number;
  totalAmount: number;
  items: { transactionId: number; memberId: number; memberName: string; chargeName: string; daysOverdue: number; ruleName: string; penaltyAmount: number }[];
  truncated: boolean;
};

export type LateFeeApplyResultDTO = { applied: number; totalAmount: number };
