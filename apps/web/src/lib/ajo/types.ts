/** What the Ajo API sends. Money is kobo as a string; days are ISO strings. */

export type AjoAccess = 'FULL' | 'READ_ONLY';

export type AjoStatusDTO = {
  module: string;
  access: AjoAccess | 'DISABLED';
  readOnly: boolean;
  /** THRIFT_GROUP for a standalone thrift group (an account that is only Ajo). */
  tenantKind: 'ASSOCIATION' | 'THRIFT_GROUP';
  contributors: { limit: number | null; count: number; remaining: number | null };
};

export type GroupModel = 'COLLECTOR_THRIFT' | 'ROTATING_POT';
export type GroupFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type GroupStatus = 'DRAFT' | 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';

export type GroupDTO = {
  id: number;
  name: string;
  model: GroupModel;
  frequency: GroupFrequency;
  status: GroupStatus;
  contributionKobo: string;
  startDate: string;
  endsOn: string | null;
  cycleLength: number | null;
  rounds: number | null;
  maxParticipants: number;
  bankAccount: { bankName: string | null; accountName: string | null; masked: string } | null;
};

export type MyMembershipDTO = {
  membershipId: number;
  status: MembershipStatus;
  shares: number;
  group: GroupDTO;
  waitingFor: Array<{ requirement: string; text: string }>;
  overdueKobo: string;
  totalOwedKobo: string;
  nextDue: { dueDate: string; remainingKobo: string } | null;
  payoutPositions: number[];
  rounds: number | null;
};

export type InstallmentStatus = 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

export type InstallmentDTO = { id: number; dueDate: string; amountKobo: string; paidKobo: string; status: InstallmentStatus };

export type ScheduleDTO = {
  membershipId: number;
  shares: number;
  totals: { expectedKobo: string; paidKobo: string; remainingKobo: string };
  installments: InstallmentDTO[];
};

export type ContributionStatus = 'REPORTED' | 'CASH_RECEIVED' | 'CONFIRMED' | 'REVERSED' | 'REJECTED';

export type ContributionDTO = {
  id: number;
  reference: string | null;
  method: 'CASH' | 'TRANSFER';
  status: ContributionStatus;
  amountKobo: string;
  amount: string;
  receivedAt: string;
  confirmedAt: string | null;
  reversed: boolean;
  reversalReason: string | null;
  reason: string | null;
  counts: boolean;
  awaitingConfirmation: boolean;
  installmentsCovered: Array<{ installmentId: number; amountKobo: string }>;
  lateFeesCovered: Array<{ lateFeeId: number; amountKobo: string }>;
};

export type RulesToAcceptDTO = { ruleVersionId: number; version: number; effectiveFrom: string; summary: string[] } | null;

export type GroupBankDTO = { bankName: string | null; accountName: string | null; accountNumber: string; masked: string };

export type PayoutAccountDTO = { bankName: string; accountName: string; accountMasked: string; changedAt: string; coolOffUntil: string | null; inCoolOff: boolean } | null;

export type VerificationDTO = { status: 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; rejectionReason: string | null; reviewedAt: string | null };

export type TrustBand = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'AT_RISK' | 'NO_HISTORY';

export type TrustDTO = {
  band: TrustBand;
  onTimeCount: number;
  dueCount: number;
  onTimePercent: number | null;
  excludedDisputed: number;
  excludedWaived: number;
  text: string;
  history: Array<{ band: TrustBand; onTimeCount: number; dueCount: number; computedAt: string }>;
};

export type DisputeDTO = {
  id: number;
  installmentId: number | null;
  claim: string;
  hasEvidence: boolean;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  outcome: 'OPEN' | 'UPHELD' | 'NOT_UPHELD';
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type LateFeeDTO = {
  id: number;
  installmentId: number | null;
  status: 'PENDING' | 'PAYABLE' | 'PAID' | 'WAIVED';
  feeKobo: string;
  paidKobo: string;
  /** What is owed now: nothing while the fee is pending, because a pending fee is shown but not owed. */
  owedKobo: string;
  calculation: { text?: string } | null;
  notifiedAt: string | null;
  waivedReason: string | null;
};
