import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CreatePayoutRequestPayload,
  MemberWelfareProfileDTO,
  PayoutRequestDTO,
  WelfareContributionsResponseDTO,
  WelfareFundsResponseDTO,
  WelfarePayoutsResponseDTO,
} from '@/types/api/welfare';

export type ListWelfareContributionsParams = {
  page?: number;
  limit?: number;
  memberId?: number;
  fundId?: number;
  status?: string;
};

export type ListWelfarePayoutsParams = ListWelfareContributionsParams & { payoutType?: string };

/** `/welfare/*` — tenant required (api-contract.md §12). */
export const welfareApi = {
  /** GET /welfare/my-profile — member's welfare summary: contributions, payouts, eligible funds. */
  async getMyProfile(): Promise<MemberWelfareProfileDTO> {
    return unwrap<MemberWelfareProfileDTO>(client.get('/welfare/my-profile'));
  },

  /** GET /welfare/funds?status=ACTIVE — active welfare funds available for requests. */
  async listFunds(status = 'ACTIVE'): Promise<WelfareFundsResponseDTO> {
    return unwrap<WelfareFundsResponseDTO>(client.get('/welfare/funds', { params: { page: 1, limit: 50, status } }));
  },

  /**
   * GET /welfare/contributions — verified 2026-10-21. The server scopes this to the caller's own member record unless
   * they are an officer (members.view_all / payments.approve); `memberId` is only honoured for officers.
   */
  async listContributions(params: ListWelfareContributionsParams = {}): Promise<WelfareContributionsResponseDTO> {
    return unwrap<WelfareContributionsResponseDTO>(client.get('/welfare/contributions', { params: { page: 1, limit: 20, ...params } }));
  },

  /** GET /welfare/payouts — scoped to the caller for non-officers, same as contributions. Response key is `requests`. */
  async listPayoutRequests(params: ListWelfarePayoutsParams = {}): Promise<WelfarePayoutsResponseDTO> {
    return unwrap<WelfarePayoutsResponseDTO>(client.get('/welfare/payouts', { params: { page: 1, limit: 20, ...params } }));
  },

  /** POST /welfare/payouts — member payout request (WELFARE_PAYOUT_REQUEST permission). */
  async createPayoutRequest(payload: CreatePayoutRequestPayload): Promise<PayoutRequestDTO> {
    return unwrap<PayoutRequestDTO>(client.post('/welfare/payouts', payload));
  },
};
