/**
 * The staff side of the Ajo API as functions (T7.1 to T7.4). The server decides who may do what; these only make the calls.
 * Money goes out as kobo strings, never as floats.
 */
import api from '@/lib/axios';
import type {
  AssignedContributorDTO,
  BulkResultDTO,
  OnboardingStatusDTO,
  TeamInviteResult,
  CaseDTO,
  CollectorAssignmentDTO,
  CollectorCandidateDTO,
  CollectorDayDTO,
  GroupDetailDTO,
  GroupListItemDTO,
  GuarantorLinkDTO,
  PersonNameDTO,
  HandoverDTO,
  HandoverDetailDTO,
  OrderDTO,
  PayoutDTO,
  PayoutPreviewDTO,
  PersonSearchDTO,
  QueueDTO,
  RosterDTO,
  RuleVersionDTO,
  StaffDisputeDTO,
  StaffLateFeeDTO,
  SwapDTO,
} from './staffTypes';

type Envelope<T> = { success: boolean; message?: string; data: T };
const unwrap = async <T>(request: Promise<{ data: Envelope<T> }>): Promise<T> => (await request).data.data;
const post = <T>(url: string, body: unknown = {}, headers?: Record<string, string>) => unwrap<T>(api.post(url, body, headers ? { headers } : undefined));

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
};
export type BankInput = { bankName: string; accountNumber: string; accountName: string };

/** How many rows a list asks for at a time. */
export const QUEUE_PAGE = 50;

export const ajoStaffApi = {
  // groups (T7.1)
  groups: () => unwrap<GroupListItemDTO[]>(api.get('/ajo/groups')),
  groupDetail: (id: number) => unwrap<GroupDetailDTO>(api.get(`/ajo/groups/${id}`)),
  createGroup: (body: GroupFieldsInput & { bank?: BankInput; rules?: RulesInput }) => post<GroupDetailDTO>('/ajo/groups', body),
  updateGroup: (id: number, body: GroupFieldsInput & { bank?: BankInput }) => unwrap<GroupDetailDTO>(api.patch(`/ajo/groups/${id}`, body)),
  openGroup: (id: number) => post<unknown>(`/ajo/groups/${id}/open`),
  startGroup: (id: number, confirmSmallerGroup?: boolean) => post<unknown>(`/ajo/groups/${id}/start`, { confirmSmallerGroup }),
  cancelGroup: (id: number, reason: string) => post<unknown>(`/ajo/groups/${id}/cancel`, { reason }),
  ruleVersions: (id: number) => unwrap<RuleVersionDTO[]>(api.get(`/ajo/groups/${id}/rules`)),
  publishRules: (id: number, rules: RulesInput) => post<RuleVersionDTO>(`/ajo/groups/${id}/rules`, rules),

  // thrift onboarding
  onboardingStatus: () => unwrap<OnboardingStatusDTO>(api.get('/onboarding/status')),
  completeOnboardingStep: (step: number, stepName: string, skipped = false) => unwrap<unknown>(api.patch('/onboarding/complete-step', { step, stepName, skipped })),
  skipOnboarding: () => post<unknown>('/onboarding/skip'),
  inviteTeam: (invites: Array<{ firstName: string; lastName: string; email: string; role: string }>) => post<{ results: TeamInviteResult[] }>('/onboarding/team', { invites }),
  inviteToLogin: (memberId: number, email: string) => post<unknown>('/member-invites/invite', { memberId, email }),
  bulkAdd: (groupId: number, body: { items: Array<Record<string, string | number>>; approve: boolean; acceptRulesOnBehalf: boolean }) => post<BulkResultDTO>(`/ajo/groups/${groupId}/members/bulk`, body),
  profile: () => unwrap<{ address?: string | null; phone?: string | null; email?: string | null }>(api.get('/settings/association/profile')),
  saveProfile: (body: { name: string; address: string; phone: string; email: string }) => unwrap<unknown>(api.patch('/settings/association/profile', body)),
  uploadLogo: (file: File) => { const form = new FormData(); form.append('logo', file); return unwrap<unknown>(api.post('/settings/association/logo', form)); },

  // members (T7.2)
  people: (id: number) => unwrap<PersonNameDTO[]>(api.get(`/ajo/groups/${id}/people`)),
  guarantorLink: (membershipId: number, body: { name: string; phone: string; relationship: string }) => post<GuarantorLinkDTO>(`/ajo/memberships/${membershipId}/guarantor-link`, body),
  roster: (id: number) => unwrap<RosterDTO>(api.get(`/ajo/groups/${id}/members`)),
  searchPeople: (search: string) => unwrap<PersonSearchDTO[]>(api.get('/ajo/people', { params: { search } })),
  addMember: (id: number, memberId: number, shares?: number) => post<{ membershipId: number }>(`/ajo/groups/${id}/members`, { memberId, shares }),
  setShares: (membershipId: number, shares: number) => unwrap<unknown>(api.patch(`/ajo/memberships/${membershipId}/shares`, { shares })),
  approveMember: (membershipId: number) => post<unknown>(`/ajo/memberships/${membershipId}/approve`),
  guarantorWording: (membershipId: number, name: string) => unwrap<{ wording: string }>(api.get(`/ajo/memberships/${membershipId}/guarantor-wording`, { params: { name } })),
  recordGuarantor: (membershipId: number, body: { name: string; phone: string; relationship: string; note: string }) => post<unknown>(`/ajo/memberships/${membershipId}/guarantor`, body),
  order: (id: number) => unwrap<OrderDTO>(api.get(`/ajo/groups/${id}/order`)),
  runDraw: (id: number) => post<unknown>(`/ajo/groups/${id}/draw`),
  swaps: (id: number) => unwrap<SwapDTO[]>(api.get(`/ajo/groups/${id}/swaps`)),
  requestSwap: (id: number, body: { slotAId: number; slotBId: number; reason?: string }) => post<unknown>(`/ajo/groups/${id}/swaps`, body),
  decideSwap: (swapId: number, body: { decision: 'APPROVED' | 'REJECTED'; note?: string }) => post<unknown>(`/ajo/swaps/${swapId}/decision`, body),
  exception: (id: number, body: { slotId: number; newPosition: number; reason: string }) => post<unknown>(`/ajo/groups/${id}/exceptions`, body),

  // collections (T7.3)
  queue: (id: number, params: { status?: string; method?: string; take?: number; skip?: number } = {}) => unwrap<QueueDTO>(api.get(`/ajo/groups/${id}/contributions`, { params: { take: QUEUE_PAGE, ...params } })),
  confirm: (contributionId: number, body: { acknowledgeDuplicate?: boolean; note?: string; confirmOwn?: boolean }) => post<unknown>(`/ajo/contributions/${contributionId}/confirm`, body),
  reject: (contributionId: number, reason: string) => post<unknown>(`/ajo/contributions/${contributionId}/reject`, { reason }),
  reverse: (contributionId: number, reason: string) => post<unknown>(`/ajo/contributions/${contributionId}/reverse`, { reason }),
  proofLink: (contributionId: number) => unwrap<{ url: string }>(api.get(`/ajo/contributions/${contributionId}/proof`)),
  handovers: (id: number, reconciled?: boolean, skip = 0) => unwrap<HandoverDTO[]>(api.get(`/ajo/groups/${id}/handovers`, { params: { take: QUEUE_PAGE, ...(skip ? { skip } : {}), ...(reconciled === undefined ? {} : { reconciled }) } })),
  handover: (handoverId: number) => unwrap<HandoverDetailDTO>(api.get(`/ajo/handovers/${handoverId}`)),
  reconcileHandover: (handoverId: number, body: { countedKobo: string; receivedContributionIds?: number[]; note?: string; confirmOwn?: boolean }) => post<unknown>(`/ajo/handovers/${handoverId}/reconcile`, body),
  collectors: (id: number) => unwrap<CollectorAssignmentDTO[]>(api.get(`/ajo/groups/${id}/collectors`)),
  collectorCandidates: () => unwrap<CollectorCandidateDTO[]>(api.get('/ajo/collector-candidates')),
  assignCollector: (membershipId: number, body: { collectorUserId: number; dailyTargetKobo?: string | null }) => post<unknown>(`/ajo/memberships/${membershipId}/collector`, body),
  unassignCollector: (membershipId: number) => unwrap<unknown>(api.delete(`/ajo/memberships/${membershipId}/collector`)),
  myContributors: () => unwrap<AssignedContributorDTO[]>(api.get('/ajo/collector/contributors')),
  collectorDay: (id: number, date?: string) => unwrap<CollectorDayDTO>(api.get(`/ajo/groups/${id}/collector-day`, { params: date ? { date } : {} })),
  recordCash: (id: number, input: { membershipId: number; amountKobo: string; idempotencyKey: string }) =>
    post<unknown>(`/ajo/groups/${id}/contributions/cash`, { membershipId: input.membershipId, amountKobo: input.amountKobo }, { 'Idempotency-Key': input.idempotencyKey }),
  handOver: (id: number, input: { handedOverKobo: string; note?: string; forDate?: string }) => post<unknown>(`/ajo/groups/${id}/handovers`, input),

  // payouts (T7.4)
  payoutPreview: (id: number, params: { round?: number; membershipId?: number }) => unwrap<PayoutPreviewDTO>(api.get(`/ajo/groups/${id}/payouts/preview`, { params })),
  payouts: (id: number, params: { status?: string } = {}) => unwrap<PayoutDTO[]>(api.get(`/ajo/groups/${id}/payouts`, { params })),
  preparePayout: (id: number, body: { round?: number; membershipId?: number }) => post<unknown>(`/ajo/groups/${id}/payouts`, body),
  approvePayout: (payoutId: number, body: { password: string; confirmSelfApproval?: boolean; note?: string }) => post<unknown>(`/ajo/payouts/${payoutId}/approve`, body),
  voidPayout: (payoutId: number, reason: string) => post<unknown>(`/ajo/payouts/${payoutId}/void`, { reason }),
  failPayout: (payoutId: number, reason: string) => post<unknown>(`/ajo/payouts/${payoutId}/fail`, { reason }),
  recordPayoutPaid: (payoutId: number, input: { reference: string; note?: string; confirmOwn?: boolean; proof?: File | null }) => {
    const form = new FormData();
    form.append('reference', input.reference);
    if (input.note) form.append('note', input.note);
    if (input.confirmOwn) form.append('confirmOwn', 'true');
    if (input.proof) form.append('proof', input.proof);
    return unwrap<unknown>(api.post(`/ajo/payouts/${payoutId}/record-paid`, form));
  },
  reversePayout: (payoutId: number, body: { password: string; reason: string }) => post<unknown>(`/ajo/payouts/${payoutId}/reverse`, body),
  completeGroup: (id: number) => post<unknown>(`/ajo/groups/${id}/complete`),

  // late fees, disputes, cases (T7.4)
  groupLateFees: (id: number, status?: string) => unwrap<StaffLateFeeDTO[]>(api.get(`/ajo/groups/${id}/late-fees`, { params: status ? { status } : {} })),
  waiveFee: (feeId: number, reason: string) => post<unknown>(`/ajo/late-fees/${feeId}/waive`, { reason }),
  reverseWaiver: (feeId: number, reason: string) => post<unknown>(`/ajo/late-fees/${feeId}/reverse-waiver`, { reason }),
  feeTold: (feeId: number, note: string) => post<unknown>(`/ajo/late-fees/${feeId}/told`, { note }),
  groupDisputes: (id: number, status?: string) => unwrap<StaffDisputeDTO[]>(api.get(`/ajo/groups/${id}/disputes`, { params: status ? { status } : {} })),
  resolveDispute: (disputeId: number, body: { outcome: 'UPHELD' | 'NOT_UPHELD'; reason: string }) => post<unknown>(`/ajo/disputes/${disputeId}/resolve`, body),
  disputeEvidence: (disputeId: number) => unwrap<{ url: string }>(api.get(`/ajo/disputes/${disputeId}/evidence`)),
  groupCases: (id: number, status?: string) => unwrap<CaseDTO[]>(api.get(`/ajo/groups/${id}/cases`, { params: status ? { status } : {} })),
  getCase: (caseId: number) => unwrap<CaseDTO>(api.get(`/ajo/cases/${caseId}`)),
  openCase: (membershipId: number) => post<unknown>(`/ajo/memberships/${membershipId}/cases`),
  addCaseNote: (caseId: number, note: string) => post<unknown>(`/ajo/cases/${caseId}/notes`, { note }),
  draftPlan: (caseId: number, periods?: number) => post<unknown>(`/ajo/cases/${caseId}/plan`, { periods }),
  agreePlan: (planId: number, note?: string) => post<unknown>(`/ajo/plans/${planId}/agree`, { note }),
  cancelPlan: (planId: number, reason: string) => post<unknown>(`/ajo/plans/${planId}/cancel`, { reason }),
  closeCase: (caseId: number, body: { password: string; outcome: 'RESOLVED' | 'CLOSED_UNRESOLVED'; reason: string }) => post<unknown>(`/ajo/cases/${caseId}/close`, body),
};
