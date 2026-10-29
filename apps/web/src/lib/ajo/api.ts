/**
 * The Ajo API as functions. Every call goes through the shared axios instance (sign-in, tenant headers). Nothing here caches a bank account
 * number or a proof: those are fetched when a person asks and are not kept in the query cache (see `hooks.ts`).
 */
import api from '@/lib/axios';
import type { OrderDTO } from './staffTypes';
import type {
  AjoStatusDTO,
  ContributionDTO,
  DisputeDTO,
  GroupBankDTO,
  GroupDTO,
  PhoneCodeDTO,
  ReceiptDTO,
  LateFeeDTO,
  MyMembershipDTO,
  PayoutAccountDTO,
  RulesToAcceptDTO,
  ScheduleDTO,
  TrustDTO,
  VerificationDTO,
} from './types';

type Envelope<T> = { success: boolean; message?: string; data: T };

const unwrap = async <T>(request: Promise<{ data: Envelope<T> }>): Promise<T> => (await request).data.data;

/** The plain-words reason for a failed call, or a fallback. The API always writes its messages for the person reading them. */
export function ajoErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const body = (error as { response?: { data?: { message?: string } } })?.response?.data;
  return body?.message || fallback;
}

export function ajoErrorCode(error: unknown): string | undefined {
  const body = (error as { response?: { data?: { code?: string; error?: string } } })?.response?.data;
  return body?.code ?? body?.error;
}

export function ajoErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export type AjoStatusResult =
  | { kind: 'ok'; status: AjoStatusDTO }
  | { kind: 'locked' }
  | { kind: 'forbidden' };

export const ajoApi = {
  /**
   * What this tenant can do with Ajo right now. A locked or forbidden answer is a result, not an error, so the page can draw its own
   * locked state instead of the app-wide upgrade pop-up.
   */
  async status(): Promise<AjoStatusResult> {
    const response = await api.get<Envelope<AjoStatusDTO> & { code?: string }>('/ajo/status', { validateStatus: () => true });
    if (response.status === 200) return { kind: 'ok', status: response.data.data };
    if (response.data?.code === 'MODULE_DISABLED') return { kind: 'locked' };
    if (response.status === 403) return { kind: 'forbidden' };
    throw Object.assign(new Error('Could not load your Ajo status.'), { response });
  },

  mine: () => unwrap<MyMembershipDTO[]>(api.get('/ajo/me')),
  group: (groupId: number) => unwrap<GroupDTO & { seats: { taken: number; total: number }; currentRuleVersion: number | null }>(api.get(`/ajo/groups/${groupId}`)),
  groupBank: (groupId: number) => unwrap<GroupBankDTO>(api.get(`/ajo/groups/${groupId}/bank-account`, { headers: { 'Cache-Control': 'no-store' } })),

  schedule: (membershipId: number) => unwrap<ScheduleDTO>(api.get(`/ajo/memberships/${membershipId}/installments`)),
  contributions: (membershipId: number) => unwrap<ContributionDTO[]>(api.get(`/ajo/memberships/${membershipId}/contributions`)),
  receipts: (contributionId: number) => unwrap<ReceiptDTO[]>(api.get(`/ajo/contributions/${contributionId}/receipts`)),
  sendPhoneCode: (membershipId: number) => unwrap<PhoneCodeDTO>(api.post(`/ajo/memberships/${membershipId}/phone-code`, {})),
  confirmPhoneCode: (membershipId: number, code: string) => unwrap<{ confirmed: boolean; activation: { activated: boolean } }>(api.post(`/ajo/memberships/${membershipId}/phone-code/confirm`, { code })),
  leave: (membershipId: number, reason?: string) => unwrap<{ replayed: boolean }>(api.post(`/ajo/memberships/${membershipId}/leave`, { reason })),
  order: (groupId: number) => unwrap<OrderDTO>(api.get(`/ajo/groups/${groupId}/order`)),
  requestSwap: (groupId: number, body: { slotAId: number; slotBId: number; reason?: string }) => unwrap<unknown>(api.post(`/ajo/groups/${groupId}/swaps`, body)),
  lateFees: (membershipId: number) => unwrap<LateFeeDTO[]>(api.get(`/ajo/memberships/${membershipId}/late-fees`)),
  trust: (membershipId: number) => unwrap<TrustDTO>(api.get(`/ajo/memberships/${membershipId}/trust`)),
  disputes: (membershipId: number) => unwrap<DisputeDTO[]>(api.get(`/ajo/memberships/${membershipId}/disputes`)),

  rulesToAccept: (membershipId: number) => unwrap<RulesToAcceptDTO>(api.get(`/ajo/memberships/${membershipId}/rules-to-accept`)),
  acceptRules: (membershipId: number, body: { ruleVersionId: number; note?: string }) =>
    unwrap<{ activation: { activated: boolean } }>(api.post(`/ajo/memberships/${membershipId}/accept-rules`, body)),

  payoutAccount: () => unwrap<PayoutAccountDTO>(api.get('/ajo/members/me/payout-account')),
  savePayoutAccount: (body: { bankName: string; accountNumber: string; accountName: string }) =>
    unwrap<{ replayed: boolean }>(api.put('/ajo/members/me/payout-account', body)),
  revealPayoutAccount: () => unwrap<{ accountNumber: string }>(api.post('/ajo/members/me/payout-account/reveal', {}, { headers: { 'Cache-Control': 'no-store' } })),
  verification: () => unwrap<VerificationDTO>(api.get('/ajo/members/me/verification')),

  /** A bank transfer the person has made, with the slip. The key makes a double click or a retry report it once. */
  reportTransfer: (
    groupId: number,
    input: { membershipId: number; amountKobo: bigint; bankReference?: string; paidOn?: string; proof?: File | null; idempotencyKey: string },
  ) => {
    const form = new FormData();
    form.append('membershipId', String(input.membershipId));
    form.append('amountKobo', input.amountKobo.toString());
    if (input.bankReference) form.append('bankReference', input.bankReference);
    if (input.paidOn) form.append('paidOn', input.paidOn);
    if (input.proof) form.append('proof', input.proof);
    return unwrap<{ replayed: boolean }>(api.post(`/ajo/groups/${groupId}/contributions/transfer`, form, { headers: { 'Idempotency-Key': input.idempotencyKey } }));
  },

  raiseDispute: (membershipId: number, input: { installmentId: number; claim: string; evidence?: File | null }) => {
    const form = new FormData();
    form.append('installmentId', String(input.installmentId));
    form.append('claim', input.claim);
    if (input.evidence) form.append('proof', input.evidence);
    return unwrap<DisputeDTO>(api.post(`/ajo/memberships/${membershipId}/disputes`, form));
  },
};
