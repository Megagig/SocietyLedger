import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  BulkContributionPayload,
  ContributionStatus,
  DisbursePayoutPayload,
  FundPayload,
  FundStatus,
  OfficerContributionDTO,
  OfficerContributionsDTO,
  OfficerFundDTO,
  OfficerFundsDTO,
  OfficerPayoutDTO,
  OfficerPayoutsDTO,
  PayoutStatus,
  RecordContributionPayload,
  ReviewPayoutPayload,
  WelfareDashboardDTO,
} from '@/types/api/welfareManage';

const BASE = '/welfare';
type Page = { page?: number; limit?: number };

/**
 * Welfare for officers. Funds need `welfare.manage` (`ledger.create`); recording contributions `welfare.contribution.manage`; confirming
 * them, and reviewing and disbursing payouts, `payments.approve`. An officer can't decide what is their own, and the officer who recorded
 * a contribution can't confirm it.
 */
export const welfareManageApi = {
  async getDashboard(): Promise<WelfareDashboardDTO> {
    return unwrap<WelfareDashboardDTO>(client.get(`${BASE}/dashboard`));
  },

  // ---------------------------------------------------------------- funds
  async listFunds(params: Page & { status?: FundStatus; search?: string }): Promise<OfficerFundsDTO> {
    return unwrap<OfficerFundsDTO>(client.get(`${BASE}/funds`, { params }));
  },

  async createFund(payload: FundPayload): Promise<OfficerFundDTO> {
    return unwrap<OfficerFundDTO>(client.post(`${BASE}/funds`, payload));
  },

  async updateFund(id: number, payload: Partial<FundPayload>): Promise<OfficerFundDTO> {
    return unwrap<OfficerFundDTO>(client.put(`${BASE}/funds/${id}`, payload));
  },

  /** DELETE …/funds/:id — only a fund with no confirmed contributions and no open payouts; close it otherwise. */
  async deleteFund(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/funds/${id}`));
  },

  // ---------------------------------------------------------------- contributions
  async listContributions(params: Page & { status?: ContributionStatus; fundId?: number }): Promise<OfficerContributionsDTO> {
    return unwrap<OfficerContributionsDTO>(client.get(`${BASE}/contributions`, { params }));
  },

  async recordContribution(payload: RecordContributionPayload): Promise<OfficerContributionDTO> {
    return unwrap<OfficerContributionDTO>(client.post(`${BASE}/contributions`, payload));
  },

  async recordBulk(payload: BulkContributionPayload): Promise<{ count: number }> {
    return unwrap<{ count: number }>(client.post(`${BASE}/contributions/bulk`, payload));
  },

  /** POST …/contributions/:id/confirm — 409 `ALREADY_DECIDED`; 403 `OWN_RECORDING` / `OWN_REQUEST`. */
  async confirmContribution(id: number, status: 'CONFIRMED' | 'REJECTED', notes?: string): Promise<OfficerContributionDTO> {
    return unwrap<OfficerContributionDTO>(client.post(`${BASE}/contributions/${id}/confirm`, { status, notes }));
  },

  // ---------------------------------------------------------------- payouts
  async listPayouts(params: Page & { status?: PayoutStatus; fundId?: number }): Promise<OfficerPayoutsDTO> {
    return unwrap<OfficerPayoutsDTO>(client.get(`${BASE}/payouts`, { params }));
  },

  /** POST …/payouts/:id/review — 400 `APPROVAL_TOO_LARGE` / `MAX_PAYOUT_EXCEEDED`, 409 `FUND_INSUFFICIENT` / `ALREADY_DECIDED`, 403 `OWN_REQUEST`. */
  async reviewPayout(id: number, payload: ReviewPayoutPayload): Promise<OfficerPayoutDTO> {
    return unwrap<OfficerPayoutDTO>(client.post(`${BASE}/payouts/${id}/review`, payload));
  },

  /** POST …/payouts/:id/disburse — once; takes the money out of the fund only if it still holds it. */
  async disbursePayout(id: number, payload: DisbursePayoutPayload): Promise<OfficerPayoutDTO> {
    return unwrap<OfficerPayoutDTO>(client.post(`${BASE}/payouts/${id}/disburse`, payload));
  },
};
