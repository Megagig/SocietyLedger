import type { TrustDTO } from './types';
/** What the staff side of the Ajo API sends (T7.1 to T7.4). Money is kobo as a string; days are ISO strings. */
import type { ContributionDTO, DisputeDTO, GroupDTO, LateFeeDTO, MembershipStatus } from './types';

export type CollectorFeeType = 'NONE' | 'FIXED' | 'PERCENT' | 'DAYS';
export type LateFeeType = 'NONE' | 'FIXED' | 'PERCENT';
export type GuarantorPolicy = 'NOT_REQUIRED' | 'OPTIONAL' | 'REQUIRED';
export type DefaultProcedure = 'NOTIFY_ADMIN' | 'REPAYMENT_PLAN' | 'CASE_AND_PLAN';

export type GroupListItemDTO = GroupDTO & { seats: { taken: number; total: number } };
export type GroupDetailDTO = GroupListItemDTO & {
  maxSharesPerMember: number;
  allowLateJoin: boolean;
  collectorFee: { type: CollectorFeeType; value: string };
  timezone: string;
  cutoffTime: string;
  requirePhoneConfirm: boolean;
  cancelReason: string | null;
  activeParticipants: number;
  currentRuleVersion: number | null;
};

export type RuleVersionDTO = {
  id: number;
  version: number;
  effectiveFrom: string;
  createdAt: string;
  rules: {
    lateFeeType: LateFeeType;
    lateFeeValue: string;
    lateFeeCapKobo: string | null;
    graceDays: number;
    guarantorPolicy: GuarantorPolicy;
    defaultProcedure: DefaultProcedure;
    remindersEnabled: boolean;
    blockAtRiskEarly: boolean;
    memberVisibility: 'FULL' | 'OFF';
    nameDisplay: 'FIRST_INITIAL' | 'FULL';
  };
  /** The rules in plain words, written by the server. */
  summary: string[];
};


/** How many of the circle's people have accepted the newest rule version. Sent to officers only. */
export type AcceptanceStatsDTO = { latestVersion: number | null; accepted: number; total: number; pendingMembershipIds: number[] };

/** What `GET /ajo/groups/:id/rules` sends: the versions, and (to officers) how many have accepted the newest. */
export type RuleVersionsReplyDTO = { versions: RuleVersionDTO[]; acceptance?: AcceptanceStatsDTO };

export type RosterPersonDTO = {
  membershipId: number;
  memberId: number;
  name: string;
  phone: string | null;
  hasLogin: boolean;
  status: MembershipStatus;
  /** SocietyLedger's check of this person, from the one roster read. */
  verification: 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  shares: number;
  approvedAt: string | null;
  waitingFor: Array<{ requirement: string; text: string }>;
  acceptedRuleVersion: number | null;
  acceptedVia: string | null;
  guarantorRecorded: boolean;
};
export type RosterDTO = { people: RosterPersonDTO[]; rules: unknown };

export type PersonSearchDTO = { id: number; memberNumber: string; name: string; phone: string | null; hasLogin: boolean };
export type CollectorCandidateDTO = { userId: number; name: string; email: string };
export type CollectorAssignmentDTO = { assignmentId: number; membershipId: number; collectorUserId: number; dailyTargetKobo: string | null; startsOn: string; endsOn: string | null };

export type OrderSlotDTO = { slotId: number; position: number; shareNo: number; membershipId: number; name: string; paid: boolean; mine: boolean };
export type OrderDTO = { drawn: boolean; seed: string | null; drawnAt: string | null; slots: OrderSlotDTO[]; history: Array<{ id: number; type: string; reason: string | null; createdAt: string }> };
export type SwapDTO = { id: number; slotAId: number; slotBId: number; reason: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'; createdAt: string };

export type QueueContributionDTO = ContributionDTO & {
  membershipId: number;
  hasProof?: boolean;
  bankReference?: string | null;
  paidOn?: string | null;
  possibleDuplicateOf?: number | null;
  collectorUserId?: number | null;
  missingFromHandover?: boolean;
};
export type QueueDTO = { total: number; items: QueueContributionDTO[] };

export type HandoverDTO = {
  id: number;
  groupId: number;
  collectorUserId: number;
  forDate: string;
  expectedKobo: string;
  targetKobo: string | null;
  collectedKobo: string;
  handedOverKobo: string;
  differenceKobo: string;
  countedKobo: string | null;
  reconciled: boolean;
  reconciledAt: string | null;
  note: string | null;
  reconcileNote: string | null;
};
export type HandoverDetailDTO = HandoverDTO & { payments: Array<{ contributionId: number; reference: string | null; name: string; amountKobo: string; status: string }> };

export type DayPaymentDTO = { contributionId: number; reference: string | null; name: string; amountKobo: string };
export type CollectorDayDTO = {
  forDate: string;
  groupId: number;
  contributors: number;
  expectedKobo: string;
  targetKobo: string;
  collectedKobo: string;
  carriedOverKobo: string;
  inHandKobo: string;
  handedOverKobo: string;
  differenceKobo: string;
  handover: { id: number; reconciled: boolean; reconciledAt: string | null; note: string | null } | null;
  payments: DayPaymentDTO[];
  carriedOver: DayPaymentDTO[];
  arrears: Array<{ membershipId: number; name: string; overdueKobo: string; overdue: string }>;
};
export type AssignedContributorDTO = { assignmentId: number; membershipId: number; status: string; groupId: number; groupName: string; name: string };

export type PayoutStatus = 'PREPARED' | 'APPROVED' | 'PAID' | 'VOID' | 'REVERSED';
export type PayoutDTO = {
  id: number;
  groupId: number;
  membershipId: number;
  recipient: string;
  round: number | null;
  sequence: number;
  status: PayoutStatus;
  grossKobo: string;
  confirmedKobo: string;
  shortfallKobo: string;
  collectorFeeKobo: string;
  netKobo: string;
  account: { bankName: string | null; accountName: string | null; masked: string };
  preparedBy: number;
  preparedAt: string;
  approvedBy: number | null;
  approvedAt: string | null;
  selfApprovalConfirmed: boolean;
  paidReference: string | null;
  paidAt: string | null;
  hasProof: boolean;
  voidReason: string | null;
  failed: boolean;
  reversedAt: string | null;
  reverseReason: string | null;
};
export type PayoutPreviewDTO = {
  groupId: number;
  round: number | null;
  dueDate: string | null;
  membershipId: number;
  recipient: string;
  grossKobo: string;
  confirmedKobo: string;
  shortfallKobo: string;
  totalFeeKobo: string;
  feeKobo: string;
  netKobo: string;
  alreadyPlannedKobo: string;
  explanation: string[] | string;
  shortfall: Array<{ membershipId: number; name: string; shortKobo: string }>;
  recipientArrearsNote: string | null;
  canPrepare: boolean;
  readiness: { ok: boolean; message?: string };
  eligibility: { ok: boolean; message?: string };
  nothingToPay: boolean;
  openPayoutId: number | null;
};

export type StaffDisputeDTO = DisputeDTO & { membershipId: number; raisedBy: number | null };
export type StaffLateFeeDTO = LateFeeDTO & { membershipId: number };
export type CaseDTO = {
  id: number;
  groupId: number;
  membershipId: number;
  member: string;
  status: 'OPEN' | 'PLAN_AGREED' | 'RESOLVED' | 'CLOSED_UNRESOLVED';
  procedure: string | null;
  openedAt: string;
  closedAt: string | null;
  resolution: string | null;
  memberResponse: string | null;
  outstandingAtOpeningKobo: string;
  outstandingNowKobo: string;
  plans: Array<{ id: number; status: 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; schedule: Array<{ dueDate: string; amountKobo: string }>; agreedAt: string | null; agreedVia: string | null; cancelReason: string | null }>;
  events?: Array<{ id: number; kind: string; note: string | null; createdAt: string }>;
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Thrift onboarding
// ---------------------------------------------------------------------------------------------------------------------------------

export type BulkRowResult = { row: number; name: string; status: 'added' | 'already_in_group' | 'invalid' | 'failed'; membershipId?: number; memberId?: number; approved?: boolean; rulesRecorded?: boolean; active?: boolean; message?: string };
export type BulkResultDTO = { results: BulkRowResult[]; summary: { added: number; alreadyIn: number; approved: number; active: number; problems: number } };

export type OnboardingStatusDTO = {
  onboarding: { currentStep: number; completedSteps: number[]; skippedSteps?: number[]; onboardingComplete: boolean; skippedAt?: string | null; completedAt?: string | null };
  association: { id: number; name: string; logo: string | null } | null;
  flow: 'ASSOCIATION' | 'THRIFT';
  steps: Array<{ id: number; key: string; name: string; description: string }>;
};

export type TeamInviteResult = { email: string; status: 'invited' | 'invited_email_failed' | 'already_member' | 'failed'; message?: string };

/** A person by name only, for the screens a reconciler or an approver uses. */
export type PersonNameDTO = { membershipId: number; name: string; status: MembershipStatus; shares: number };
export type GuarantorLinkDTO = { link: string; expiresAt: string; wording: string };
export type GuarantorPublicDTO = { guarantorName: string; relationship: string; memberName: string; groupName: string; expiresAt: string; wording: string };

/** `POST /ajo/groups/:id/payouts/prepare-all`: who was prepared and who was not ready, with the reason in words. */
export type PrepareAllResult = { prepared: PayoutDTO[]; notReady: Array<{ membershipId: number; name: string; code: string; message: string }> };

/** One person's on-time record in a circle, as the officers see it (`GET /ajo/groups/:id/trust`). */
export type GroupTrustRowDTO = { membershipId: number; name: string } & TrustDTO;

/** `GET /ajo/payments/waiting`: payments across every circle, with the circle and the person named. */
export type WaitingPaymentDTO = QueueContributionDTO & { groupId: number; groupName: string; groupModel: 'ROTATING_POT' | 'COLLECTOR_THRIFT'; memberName: string; recordedByOfficer?: boolean };
export type WaitingPaymentsDTO = { total: number; items: WaitingPaymentDTO[] };
