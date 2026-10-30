/** What the Ajo API sends (member, collector and staff sides). Money is kobo as a string; days are ISO strings. Mirrors apps/web/src/lib/ajo/types.ts and staffTypes.ts. */


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
export type GroupFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';
export type IntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS';
export type GroupStatus = 'DRAFT' | 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LEFT';

export type GroupDTO = {
  id: number;
  name: string;
  model: GroupModel;
  frequency: GroupFrequency;
  /** Only for CUSTOM: every N days, weeks or months. */
  intervalCount: number | null;
  intervalUnit: IntervalUnit | null;
  /** The cadence in plain words from the server, for example "every 2 weeks". */
  cadence: string;
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
  waitingFor: { requirement: string; text: string }[];
  overdueKobo: string;
  totalOwedKobo: string;
  nextDue: { dueDate: string; remainingKobo: string } | null;
  payoutPositions: number[];
  rounds: number | null;
  /** Collector thrift: what this saver pays each time in the running cycle (their own choice) and which cycle that is. Null for a rotating pot. */
  amountKobo: string | null;
  cycleNo: number | null;
};

export type InstallmentStatus = 'DUE' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

export type InstallmentDTO = { id: number; dueDate: string; amountKobo: string; paidKobo: string; status: InstallmentStatus; /** Past its due day on the group's own calendar, decided by the server. */ pastDue: boolean };

export type ScheduleDTO = {
  membershipId: number;
  shares: number;
  /** The cycle these installments belong to (always 1 for a rotating pot). */
  cycleNo?: number;
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
  /** An officer recorded this after seeing it at the bank and confirmed it in the same step. */
  recordedByOfficer?: boolean;
  installmentsCovered: { installmentId: number; amountKobo: string }[];
  lateFeesCovered: { lateFeeId: number; amountKobo: string }[];
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
  history: { band: TrustBand; onTimeCount: number; dueCount: number; computedAt: string }[];
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

export type ReceiptDTO = { id: number; moment: string; state: 'QUEUED' | 'SENT' | 'FAILED' | string; message: string; channels: unknown; sentAt: string | null; queuedForCredits: boolean };
export type PhoneCodeDTO = { sentTo: string; expiresAt: string };


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
  waitingFor: { requirement: string; text: string }[];
  acceptedRuleVersion: number | null;
  acceptedVia: string | null;
  guarantorRecorded: boolean;
};
export type RosterDTO = { people: RosterPersonDTO[]; rules: unknown };

export type PersonSearchDTO = { id: number; memberNumber: string; name: string; phone: string | null; hasLogin: boolean };
export type CollectorCandidateDTO = { userId: number; name: string; email: string };
export type CollectorAssignmentDTO = { assignmentId: number; membershipId: number; collectorUserId: number; dailyTargetKobo: string | null; startsOn: string; endsOn: string | null };

export type OrderSlotDTO = { slotId: number; position: number; shareNo: number; membershipId: number; name: string; paid: boolean; mine: boolean };
export type OrderDTO = { drawn: boolean; seed: string | null; drawnAt: string | null; slots: OrderSlotDTO[]; history: { id: number; type: string; reason: string | null; createdAt: string }[] };
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
export type HandoverDetailDTO = HandoverDTO & { payments: { contributionId: number; reference: string | null; name: string; amountKobo: string; status: string }[] };

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
  arrears: { membershipId: number; name: string; overdueKobo: string; overdue: string }[];
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
  shortfall: { membershipId: number; name: string; shortKobo: string }[];
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
  plans: { id: number; status: 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; schedule: { dueDate: string; amountKobo: string }[]; agreedAt: string | null; agreedVia: string | null; cancelReason: string | null }[];
  events?: { id: number; kind: string; note: string | null; createdAt: string }[];
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
  steps: { id: number; key: string; name: string; description: string }[];
};

export type TeamInviteResult = { email: string; status: 'invited' | 'invited_email_failed' | 'already_member' | 'failed'; message?: string };

/** A person by name only, for the screens a reconciler or an approver uses. */
export type PersonNameDTO = { membershipId: number; name: string; status: MembershipStatus; shares: number };
export type GuarantorLinkDTO = { link: string; expiresAt: string; wording: string };
export type GuarantorPublicDTO = { guarantorName: string; relationship: string; memberName: string; groupName: string; expiresAt: string; wording: string };

/** `POST /ajo/groups/:id/payouts/prepare-all`: who was prepared and who was not ready, with the reason in words. */
export type PrepareAllResultDTO = { prepared: PayoutDTO[]; notReady: { membershipId: number; name: string; code: string; message: string }[] };

/** One person's on-time record in a circle, as the officers see it (`GET /ajo/groups/:id/trust`). */
export type GroupTrustRowDTO = { membershipId: number; name: string } & TrustDTO;

/** `GET /ajo/payments/waiting`: payments across every circle, with the circle and the person named. */
export type WaitingPaymentDTO = QueueContributionDTO & { groupId: number; groupName: string; groupModel: 'ROTATING_POT' | 'COLLECTOR_THRIFT'; memberName: string };
export type WaitingPaymentsDTO = { total: number; items: WaitingPaymentDTO[] };
