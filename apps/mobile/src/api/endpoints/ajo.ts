import { ApiError } from '../errors';
import { client } from '../client';
import { unwrap } from '../envelope';
import type { CycleViewDTO, GroupCycleDTO } from '@/types/api/ajoCycle';
import type { RuleVersionsReplyDTO ,
  AjoStatusDTO,
  AssignedContributorDTO,
  BulkResultDTO,
  CaseDTO,
  OrderCheckDTO,
  WaitingPaymentsDTO,
  GroupTrustRowDTO,
  PrepareAllResultDTO,
  CollectorAssignmentDTO,
  CollectorCandidateDTO,
  CollectorDayDTO,
  ContributionDTO,
  DisputeDTO,
  GroupBankDTO,
  GroupDTO,
  GroupDetailDTO,
  GroupListItemDTO,
  GuarantorLinkDTO,
  HandoverDTO,
  HandoverDetailDTO,
  LateFeeDTO,
  MyMembershipDTO,
  OnboardingStatusDTO,
  OrderDTO,
  PayoutAccountDTO,
  PayoutDTO,
  PayoutPreviewDTO,
  PersonNameDTO,
  PersonSearchDTO,
  PhoneCodeDTO,
  QueueDTO,
  ReceiptDTO,
  RosterDTO,
  RuleVersionDTO,
  RulesToAcceptDTO,
  ScheduleDTO,
  StaffDisputeDTO,
  StaffLateFeeDTO,
  SwapDTO,
  TeamInviteResult,
  TrustDTO,
  VerificationDTO,
} from '@/types/api/ajo';

/**
 * Thrift (Ajo) add-on (`/api/ajo`). Money goes out and comes back as kobo strings, never floats. Rule failures come back as
 * 400/402/403/404/409/429/503 with a plain-words `message` (ApiError.message) — show it as is. Mirrors the web client in
 * apps/web/src/lib/ajo so a screen behaves the same on both.
 */

/** A file picked on the phone, as React Native's multipart form wants it. */
export type AjoUpload = { uri: string; name: string; type: string };

/** How many rows a list asks for at a time. */
export const AJO_QUEUE_PAGE = 50;

export type GroupFieldsInput = {
  name?: string;
  model?: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CUSTOM';
  intervalCount?: number | null;
  intervalUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  contributionKobo?: string;
  startDate?: string;
  cycleLength?: number | null;
  maxParticipants?: number;
  collectorFeeType?: 'NONE' | 'FIXED' | 'PERCENT' | 'DAYS';
  collectorFeeValue?: string;
  timezone?: string;
  cutoffTime?: string;
  requirePhoneConfirm?: boolean;
  maxSharesPerMember?: number;
  allowLateJoin?: boolean;
  orderMethod?: 'RANDOM_DRAW' | 'ADMIN_SET';
};
export type RulesInput = {
  lateFeeType?: 'NONE' | 'FIXED' | 'PERCENT';
  lateFeeValue?: string;
  lateFeeCapKobo?: string | null;
  graceDays?: number;
  guarantorPolicy?: 'NOT_REQUIRED' | 'OPTIONAL' | 'REQUIRED';
  defaultProcedure?: 'NOTIFY_ADMIN' | 'REPAYMENT_PLAN' | 'CASE_AND_PLAN';
  remindersEnabled?: boolean;
  blockAtRiskEarly?: boolean;
  memberVisibility?: 'FULL' | 'OFF';
  nameDisplay?: 'FIRST_INITIAL' | 'FULL';
};
export type BankInput = { bankName: string; accountNumber: string; accountName: string };

export type AjoStatusResult = { kind: 'ok'; status: AjoStatusDTO } | { kind: 'locked' } | { kind: 'forbidden' };

const get = <T>(url: string, params?: Record<string, unknown>, headers?: Record<string, string>) => unwrap<T>(client.get(url, { params, headers }));
const post = <T>(url: string, body: unknown = {}, headers?: Record<string, string>) => unwrap<T>(client.post(url, body, headers ? { headers } : undefined));
const multipart = <T>(url: string, form: FormData, headers: Record<string, string> = {}) =>
  unwrap<T>(client.post(url, form, { headers: { 'Content-Type': 'multipart/form-data', ...headers } }));
const attach = (form: FormData, field: string, file?: AjoUpload | null) => {
  if (file) form.append(field, { uri: file.uri, name: file.name, type: file.type } as never);
};

export const ajoApi = {
  /**
   * What this tenant can do with Ajo right now. A locked or forbidden answer is a result, not an error, so the screen can draw its
   * own locked state instead of a generic failure.
   */
  async status(): Promise<AjoStatusResult> {
    try {
      return { kind: 'ok', status: await get<AjoStatusDTO>('/ajo/status') };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'MODULE_DISABLED' || error.accessKind === 'plan') return { kind: 'locked' };
        if (error.status === 403) return { kind: 'forbidden' };
      }
      throw error;
    }
  },

  // ── contributor ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  mine: () => get<MyMembershipDTO[]>('/ajo/me'),
  group: (groupId: number) => get<GroupDTO & { seats: { taken: number; total: number }; currentRuleVersion: number | null }>(`/ajo/groups/${groupId}`),
  /** The full account number: fetched when asked for and never kept in the query cache. */
  groupBank: (groupId: number) => get<GroupBankDTO>(`/ajo/groups/${groupId}/bank-account`, undefined, { 'Cache-Control': 'no-store' }),
  schedule: (membershipId: number) => get<ScheduleDTO>(`/ajo/memberships/${membershipId}/installments`),
  contributions: (membershipId: number) => get<ContributionDTO[]>(`/ajo/memberships/${membershipId}/contributions`),
  receipts: (contributionId: number) => get<ReceiptDTO[]>(`/ajo/contributions/${contributionId}/receipts`),
  sendPhoneCode: (membershipId: number) => post<PhoneCodeDTO>(`/ajo/memberships/${membershipId}/phone-code`),
  confirmPhoneCode: (membershipId: number, code: string) =>
    post<{ confirmed: boolean; activation: { activated: boolean } }>(`/ajo/memberships/${membershipId}/phone-code/confirm`, { code }),
  leave: (membershipId: number, reason?: string) => post<{ replayed: boolean }>(`/ajo/memberships/${membershipId}/leave`, { reason }),
  lateFees: (membershipId: number) => get<LateFeeDTO[]>(`/ajo/memberships/${membershipId}/late-fees`),
  trust: (membershipId: number) => get<TrustDTO>(`/ajo/memberships/${membershipId}/trust`),
  /** Cases the officers opened about this person's unpaid rounds, and their own side of it. */
  memberCases: (membershipId: number) => get<CaseDTO[]>(`/ajo/memberships/${membershipId}/cases`),
  respondToCase: (caseId: number, note: string) => post<unknown>(`/ajo/cases/${caseId}/member-response`, { note }),
  /** What this person has been, or will be, paid out of any circle. */
  myPayouts: () => get<PayoutDTO[]>('/ajo/payouts/mine'),
  disputes: (membershipId: number) => get<DisputeDTO[]>(`/ajo/memberships/${membershipId}/disputes`),
  rulesToAccept: (membershipId: number) => get<RulesToAcceptDTO>(`/ajo/memberships/${membershipId}/rules-to-accept`),
  acceptRules: (membershipId: number, body: { ruleVersionId: number; note?: string }) =>
    post<{ activation: { activated: boolean } }>(`/ajo/memberships/${membershipId}/accept-rules`, body),
  payoutAccount: () => get<PayoutAccountDTO>('/ajo/members/me/payout-account'),
  savePayoutAccount: (body: BankInput) => unwrap<{ replayed: boolean }>(client.put('/ajo/members/me/payout-account', body)),
  revealPayoutAccount: () => post<{ accountNumber: string }>('/ajo/members/me/payout-account/reveal', {}, { 'Cache-Control': 'no-store' }),
  verification: () => get<VerificationDTO>('/ajo/members/me/verification'),

  /** A bank transfer the person has made, with the slip. The key makes a double tap or a retry report it once. */
  reportTransfer: (groupId: number, input: { membershipId: number; amountKobo: string; bankReference?: string; paidOn?: string; proof?: AjoUpload | null; idempotencyKey: string }) => {
    const form = new FormData();
    form.append('membershipId', String(input.membershipId));
    form.append('amountKobo', input.amountKobo);
    if (input.bankReference) form.append('bankReference', input.bankReference);
    if (input.paidOn) form.append('paidOn', input.paidOn);
    attach(form, 'proof', input.proof);
    return multipart<{ replayed: boolean }>(`/ajo/groups/${groupId}/contributions/transfer`, form, { 'Idempotency-Key': input.idempotencyKey });
  },
  /** Every circle's payments waiting for an officer (transfers to confirm by default), with the circle and person named. */
  waitingPayments: (params: { status?: string; groupId?: number; skip?: number } = {}) => get<WaitingPaymentsDTO>('/ajo/payments/waiting', params),
  waitingCount: () => get<{ transfersToConfirm: number; cashToCount: number }>('/ajo/payments/waiting/count'),
  /** An officer who can confirm records a payment already seen at the bank; it is confirmed in the same step. */
  recordReceived: (groupId: number, input: { membershipId: number; amountKobo: string; bankReference: string; note: string; paidOn?: string; proof?: AjoUpload | null; idempotencyKey: string }) => {
    const form = new FormData();
    form.append('membershipId', String(input.membershipId));
    form.append('amountKobo', input.amountKobo);
    form.append('bankReference', input.bankReference);
    form.append('note', input.note);
    if (input.paidOn) form.append('paidOn', input.paidOn);
    attach(form, 'proof', input.proof);
    return multipart<{ id: number }>(`/ajo/groups/${groupId}/contributions/record-received`, form, { 'Idempotency-Key': input.idempotencyKey });
  },
  raiseDispute: (membershipId: number, input: { installmentId: number; claim: string; evidence?: AjoUpload | null }) => {
    const form = new FormData();
    form.append('installmentId', String(input.installmentId));
    form.append('claim', input.claim);
    attach(form, 'proof', input.evidence);
    return multipart<DisputeDTO>(`/ajo/memberships/${membershipId}/disputes`, form);
  },

  // ── payout order (both sides) ──────────────────────────────────────────────────────────────────────────────────────────────
  order: (groupId: number) => get<OrderDTO>(`/ajo/groups/${groupId}/order`),
  requestSwap: (groupId: number, body: { slotAId: number; slotBId: number; reason?: string }) => post<unknown>(`/ajo/groups/${groupId}/swaps`, body),

  // ── groups ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  groups: () => get<GroupListItemDTO[]>('/ajo/groups'),
  groupDetail: (id: number) => get<GroupDetailDTO>(`/ajo/groups/${id}`),
  createGroup: (body: GroupFieldsInput & { bank?: BankInput; rules?: RulesInput }) => post<GroupDetailDTO>('/ajo/groups', body),
  updateGroup: (id: number, body: GroupFieldsInput & { bank?: BankInput }) => unwrap<GroupDetailDTO>(client.patch(`/ajo/groups/${id}`, body)),
  openGroup: (id: number) => post<unknown>(`/ajo/groups/${id}/open`),
  startGroup: (id: number, confirmSmallerGroup?: boolean) => post<unknown>(`/ajo/groups/${id}/start`, { confirmSmallerGroup }),
  cancelGroup: (id: number, reason: string) => post<unknown>(`/ajo/groups/${id}/cancel`, { reason }),
  completeGroup: (id: number) => post<unknown>(`/ajo/groups/${id}/complete`),
  /** The API sends `{ versions, acceptance? }`, not a bare list. */
  ruleVersions: (id: number) => get<RuleVersionsReplyDTO>(`/ajo/groups/${id}/rules`),
  /** `immediate`: take effect now, with no notice period. Allowed only before the circle starts; a waiting version is brought forward. */
  publishRules: (id: number, rules: RulesInput, options: { immediate?: boolean } = {}) => post<RuleVersionDTO>(`/ajo/groups/${id}/rules`, { rules, ...(options.immediate ? { immediate: true } : {}) }),

  // ── members ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  people: (id: number) => get<PersonNameDTO[]>(`/ajo/groups/${id}/people`),
  roster: (id: number) => get<RosterDTO>(`/ajo/groups/${id}/members`),
  searchPeople: (search: string) => get<PersonSearchDTO[]>('/ajo/people', { search }),
  /** `amountKobo` is for collector thrift: what the saver chose to pay each time (at least the group's smallest). */
  addMember: (id: number, memberId: number, shares?: number, amountKobo?: string) => post<{ membershipId: number }>(`/ajo/groups/${id}/members`, { memberId, shares, amountKobo }),

  // ── collector-thrift cycles (spec §16.5) ────────────────────────────────
  /** GET /ajo/memberships/:id/cycle */
  cycle: (membershipId: number) => get<CycleViewDTO>(`/ajo/memberships/${membershipId}/cycle`),
  /** PUT /ajo/memberships/:id/amount: what the saver pays each time; allowed until the cycle has begun for them. */
  setAmount: (membershipId: number, amountKobo: string) => unwrap<{ amountKobo: string; changed: boolean }>(client.put(`/ajo/memberships/${membershipId}/amount`, { amountKobo })),
  /** POST /ajo/memberships/:id/cycle/decision: withdraw or continue (no answer means withdraw). */
  decideCycle: (membershipId: number, body: { choice: 'WITHDRAW' | 'CONTINUE'; nextAmountKobo?: string }) => post<CycleViewDTO>(`/ajo/memberships/${membershipId}/cycle/decision`, body),
  /** GET /ajo/groups/:id/cycle: officers. */
  groupCycle: (groupId: number) => get<GroupCycleDTO>(`/ajo/groups/${groupId}/cycle`),
  /** POST /ajo/groups/:id/cycles/next: the admin, once the cycle is over and the savers leaving have been paid. */
  startNextCycle: (groupId: number) => post<{ cycleNo: number; startsOn: string; endsOn: string; continuing: number; withdrawn: number }>(`/ajo/groups/${groupId}/cycles/next`),
  setShares: (membershipId: number, shares: number) => unwrap<unknown>(client.patch(`/ajo/memberships/${membershipId}/shares`, { shares })),
  approveMember: (membershipId: number) => post<unknown>(`/ajo/memberships/${membershipId}/approve`),
  guarantorLink: (membershipId: number, body: { name: string; phone: string; relationship: string }) => post<GuarantorLinkDTO>(`/ajo/memberships/${membershipId}/guarantor-link`, body),
  guarantorWording: (membershipId: number, name: string) => get<{ wording: string }>(`/ajo/memberships/${membershipId}/guarantor-wording`, { name }),
  recordGuarantor: (membershipId: number, body: { name: string; phone: string; relationship: string; note: string }) => post<unknown>(`/ajo/memberships/${membershipId}/guarantor`, body),
  bulkAdd: (groupId: number, body: { items: Record<string, string | number>[]; approve: boolean; acceptRulesOnBehalf: boolean }) => post<BulkResultDTO>(`/ajo/groups/${groupId}/members/bulk`, body),
  inviteToLogin: (memberId: number, email: string) => post<unknown>('/member-invites/invite', { memberId, email }),

  // ── payout order ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  runDraw: (id: number) => post<unknown>(`/ajo/groups/${id}/draw`),
  /** The admin places every share, first in the list is paid first, with the reason the group can read. */
  setOrder: (id: number, body: { order: { membershipId: number; shareNo: number }[]; reason: string }) => post<unknown>(`/ajo/groups/${id}/order/set`, body),
  /** Run the newest random draw again from its saved seed and say whether it matches. */
  verifyOrder: (id: number) => get<OrderCheckDTO>(`/ajo/groups/${id}/order/verify`),
  swaps: (id: number) => get<SwapDTO[]>(`/ajo/groups/${id}/swaps`),
  decideSwap: (swapId: number, body: { decision: 'APPROVED' | 'REJECTED'; note?: string }) => post<unknown>(`/ajo/swaps/${swapId}/decision`, body),
  exception: (id: number, body: { slotId: number; newPosition: number; reason: string }) => post<unknown>(`/ajo/groups/${id}/exceptions`, body),

  // ── collections ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  queue: (id: number, params: { status?: string; method?: string; take?: number; skip?: number } = {}) => get<QueueDTO>(`/ajo/groups/${id}/contributions`, { take: AJO_QUEUE_PAGE, ...params }),
  confirm: (contributionId: number, body: { acknowledgeDuplicate?: boolean; note?: string; confirmOwn?: boolean }) => post<unknown>(`/ajo/contributions/${contributionId}/confirm`, body),
  reject: (contributionId: number, reason: string) => post<unknown>(`/ajo/contributions/${contributionId}/reject`, { reason }),
  reverse: (contributionId: number, reason: string) => post<unknown>(`/ajo/contributions/${contributionId}/reverse`, { reason }),
  proofLink: (contributionId: number) => get<{ url: string }>(`/ajo/contributions/${contributionId}/proof`),
  handovers: (id: number, reconciled?: boolean, skip = 0) =>
    get<HandoverDTO[]>(`/ajo/groups/${id}/handovers`, { take: AJO_QUEUE_PAGE, ...(skip ? { skip } : {}), ...(reconciled === undefined ? {} : { reconciled }) }),
  handover: (handoverId: number) => get<HandoverDetailDTO>(`/ajo/handovers/${handoverId}`),
  reconcileHandover: (handoverId: number, body: { countedKobo: string; receivedContributionIds?: number[]; note?: string; confirmOwn?: boolean }) => post<unknown>(`/ajo/handovers/${handoverId}/reconcile`, body),

  // ── collectors ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  collectors: (id: number) => get<CollectorAssignmentDTO[]>(`/ajo/groups/${id}/collectors`),
  collectorCandidates: () => get<CollectorCandidateDTO[]>('/ajo/collector-candidates'),
  assignCollector: (membershipId: number, body: { collectorUserId: number; dailyTargetKobo?: string | null }) => post<unknown>(`/ajo/memberships/${membershipId}/collector`, body),
  unassignCollector: (membershipId: number) => unwrap<unknown>(client.delete(`/ajo/memberships/${membershipId}/collector`)),
  myContributors: () => get<AssignedContributorDTO[]>('/ajo/collector/contributors'),
  collectorDay: (id: number, date?: string) => get<CollectorDayDTO>(`/ajo/groups/${id}/collector-day`, date ? { date } : undefined),
  recordCash: (id: number, input: { membershipId: number; amountKobo: string; idempotencyKey: string }) =>
    post<unknown>(`/ajo/groups/${id}/contributions/cash`, { membershipId: input.membershipId, amountKobo: input.amountKobo }, { 'Idempotency-Key': input.idempotencyKey }),
  handOver: (id: number, input: { handedOverKobo: string; note?: string; forDate?: string }) => post<unknown>(`/ajo/groups/${id}/handovers`, input),

  // ── payouts ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  payoutPreview: (id: number, params: { round?: number; membershipId?: number }) => get<PayoutPreviewDTO>(`/ajo/groups/${id}/payouts/preview`, params),
  /** Collector thrift: prepare a payout for everyone who is ready, and say who is not and why. */
  prepareAllPayouts: (id: number) => post<PrepareAllResultDTO>(`/ajo/groups/${id}/payouts/prepare-all`),
  /** Send a person's payout-account details to SocietyLedger to be checked again. */
  resubmitVerification: (memberId: number) => post<{ status: string }>(`/ajo/members/${memberId}/verification/resubmit`),
  /** Every circle one person is, or was, in (officers). */
  personCircles: (memberId: number) => get<MyMembershipDTO[]>(`/ajo/members/${memberId}/circles`),
  groupTrust: (id: number) => get<GroupTrustRowDTO[]>(`/ajo/groups/${id}/trust`),
  /** Send the receipts that could not be sent when the payment was confirmed (for example no SMS credits then). */
  sendQueuedReceipts: () => post<{ attempted: number; sent: number; stillQueued: number; waiting: number }>('/ajo/receipts/send-queued'),
  payouts: (id: number, params: { status?: string } = {}) => get<PayoutDTO[]>(`/ajo/groups/${id}/payouts`, params),
  preparePayout: (id: number, body: { round?: number; membershipId?: number }) => post<unknown>(`/ajo/groups/${id}/payouts`, body),
  /** Needs the signed-in person's password (the server checks it): approving moves money out of the group's account. */
  approvePayout: (payoutId: number, body: { password: string; confirmSelfApproval?: boolean; note?: string }) => post<unknown>(`/ajo/payouts/${payoutId}/approve`, body),
  voidPayout: (payoutId: number, reason: string) => post<unknown>(`/ajo/payouts/${payoutId}/void`, { reason }),
  failPayout: (payoutId: number, reason: string) => post<unknown>(`/ajo/payouts/${payoutId}/fail`, { reason }),
  recordPayoutPaid: (payoutId: number, input: { reference: string; note?: string; confirmOwn?: boolean; proof?: AjoUpload | null }) => {
    const form = new FormData();
    form.append('reference', input.reference);
    if (input.note) form.append('note', input.note);
    if (input.confirmOwn) form.append('confirmOwn', 'true');
    attach(form, 'proof', input.proof);
    return multipart<unknown>(`/ajo/payouts/${payoutId}/record-paid`, form);
  },
  reversePayout: (payoutId: number, body: { password: string; reason: string }) => post<unknown>(`/ajo/payouts/${payoutId}/reverse`, body),

  // ── late fees, disputes, cases ─────────────────────────────────────────────────────────────────────────────────────────────
  groupLateFees: (id: number, status?: string) => get<StaffLateFeeDTO[]>(`/ajo/groups/${id}/late-fees`, status ? { status } : undefined),
  waiveFee: (feeId: number, reason: string) => post<unknown>(`/ajo/late-fees/${feeId}/waive`, { reason }),
  reverseWaiver: (feeId: number, reason: string) => post<unknown>(`/ajo/late-fees/${feeId}/reverse-waiver`, { reason }),
  feeTold: (feeId: number, note: string) => post<unknown>(`/ajo/late-fees/${feeId}/told`, { note }),
  groupDisputes: (id: number, status?: string) => get<StaffDisputeDTO[]>(`/ajo/groups/${id}/disputes`, status ? { status } : undefined),
  resolveDispute: (disputeId: number, body: { outcome: 'UPHELD' | 'NOT_UPHELD'; reason: string }) => post<unknown>(`/ajo/disputes/${disputeId}/resolve`, body),
  disputeEvidence: (disputeId: number) => get<{ url: string }>(`/ajo/disputes/${disputeId}/evidence`),
  groupCases: (id: number, status?: string) => get<CaseDTO[]>(`/ajo/groups/${id}/cases`, status ? { status } : undefined),
  getCase: (caseId: number) => get<CaseDTO>(`/ajo/cases/${caseId}`),
  openCase: (membershipId: number) => post<unknown>(`/ajo/memberships/${membershipId}/cases`),
  addCaseNote: (caseId: number, note: string) => post<unknown>(`/ajo/cases/${caseId}/notes`, { note }),
  draftPlan: (caseId: number, periods?: number) => post<unknown>(`/ajo/cases/${caseId}/plan`, { periods }),
  agreePlan: (planId: number, note?: string) => post<unknown>(`/ajo/plans/${planId}/agree`, { note }),
  cancelPlan: (planId: number, reason: string) => post<unknown>(`/ajo/plans/${planId}/cancel`, { reason }),
  /** Needs the signed-in person's password. */
  closeCase: (caseId: number, body: { password: string; outcome: 'RESOLVED' | 'CLOSED_UNRESOLVED'; reason: string }) => post<unknown>(`/ajo/cases/${caseId}/close`, body),

  // ── thrift onboarding ──────────────────────────────────────────────────────────────────────────────────────────────────────
  onboardingStatus: () => get<OnboardingStatusDTO>('/onboarding/status'),
  completeOnboardingStep: (step: number, stepName: string, skipped = false) => unwrap<unknown>(client.patch('/onboarding/complete-step', { step, stepName, skipped })),
  skipOnboarding: () => post<unknown>('/onboarding/skip'),
  inviteTeam: (invites: { firstName: string; lastName: string; email: string; role: string }[]) => post<{ results: TeamInviteResult[] }>('/onboarding/team', { invites }),
  profile: () => get<{ address?: string | null; phone?: string | null; email?: string | null }>('/settings/association/profile'),
  saveProfile: (body: { name: string; address: string; phone: string; email: string }) => unwrap<unknown>(client.patch('/settings/association/profile', body)),
  uploadLogo: (file: AjoUpload) => {
    const form = new FormData();
    attach(form, 'logo', file);
    return multipart<unknown>('/settings/association/logo', form);
  },
};
