import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  AllocationDTO,
  AllocationListDTO,
  AllocationPayload,
  DonationListDTO,
  DonationReceiptDTO,
  DonationStatsDTO,
  LateFeeApplyResultDTO,
  LateFeePreviewDTO,
  PenaltyRuleDTO,
  PenaltyRuleListDTO,
  PenaltyRulePayload,
  PenaltyStatsDTO,
  RecordDonationPayload,
  WaivePayload,
  WaiveResultDTO,
  WaiverListDTO,
} from '@/types/api/donationsPenalties';

const BASE = '/finance/advanced';

/**
 * Donations: view `ledger.view`, record `ledger.create` (transactions), funds create/edit `ledger.create`/`ledger.edit`. Penalties:
 * rules create/edit/delete `ledger.create`/`ledger.edit`/`ledger.reverse`; applying late fees and waiving need `payments.approve`.
 * Rule failures answer with a `code` (`MEMBER_NOT_ACTIVE`, `PLEDGE_DATE_IN_PAST`, `WAIVER_TOO_LARGE`, `ALREADY_WAIVED`, `CONFLICT`, …).
 */
export const donationsPenaltiesApi = {
  // ---------------------------------------------------------------- donations
  async getDonationStats(): Promise<DonationStatsDTO> {
    return unwrap<DonationStatsDTO>(client.get(`${BASE}/donations/stats`));
  },

  async listDonations(params: { page?: number; limit?: number; allocationId?: number }): Promise<DonationListDTO> {
    return unwrap<DonationListDTO>(client.get(`${BASE}/donations`, { params }));
  },

  async getReceipt(donationId: number): Promise<DonationReceiptDTO> {
    return unwrap<DonationReceiptDTO>(client.get(`${BASE}/donations/${donationId}/receipt`));
  },

  /** POST …/donations/record — an instant donation is paid now; a pledge is owed until paid. */
  async recordDonation(payload: RecordDonationPayload): Promise<{ donationRecord: { id: number; receiptNumber: string } }> {
    return unwrap<{ donationRecord: { id: number; receiptNumber: string } }>(client.post(`${BASE}/donations/record`, payload));
  },

  async listAllocations(params: { page?: number; limit?: number; isActive?: boolean }): Promise<AllocationListDTO> {
    const query = { ...params, isActive: params.isActive === undefined ? undefined : String(params.isActive) };
    return unwrap<AllocationListDTO>(client.get(`${BASE}/donations/allocations`, { params: query }));
  },

  async createAllocation(payload: AllocationPayload): Promise<AllocationDTO> {
    return unwrap<AllocationDTO>(client.post(`${BASE}/donations/allocations`, payload));
  },

  async updateAllocation(id: number, payload: Partial<AllocationPayload>): Promise<AllocationDTO> {
    return unwrap<AllocationDTO>(client.patch(`${BASE}/donations/allocations/${id}`, payload));
  },

  // ---------------------------------------------------------------- penalties
  async getPenaltyStats(): Promise<PenaltyStatsDTO> {
    return unwrap<PenaltyStatsDTO>(client.get(`${BASE}/penalties/stats`));
  },

  async listRules(params: { page?: number; limit?: number }): Promise<PenaltyRuleListDTO> {
    return unwrap<PenaltyRuleListDTO>(client.get(`${BASE}/penalties/rules`, { params }));
  },

  async createRule(payload: PenaltyRulePayload): Promise<PenaltyRuleDTO> {
    return unwrap<PenaltyRuleDTO>(client.post(`${BASE}/penalties/rules`, payload));
  },

  async updateRule(id: number, payload: Partial<PenaltyRulePayload>): Promise<PenaltyRuleDTO> {
    return unwrap<PenaltyRuleDTO>(client.patch(`${BASE}/penalties/rules/${id}`, payload));
  },

  /** DELETE …/rules/:id — a rule that has already charged members is switched off instead of removed, so the history stays. */
  async deleteRule(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`${BASE}/penalties/rules/${id}`));
  },

  /** GET …/penalties/late-fees/preview — who would be charged and how much, without charging anyone. */
  async previewLateFees(): Promise<LateFeePreviewDTO> {
    return unwrap<LateFeePreviewDTO>(client.get(`${BASE}/penalties/late-fees/preview`));
  },

  /** POST …/penalties/apply-late-fees — charges every overdue due and levy that is past its grace period (needs `payments.approve`). */
  async applyLateFees(): Promise<LateFeeApplyResultDTO> {
    return unwrap<LateFeeApplyResultDTO>(client.post(`${BASE}/penalties/apply-late-fees`, {}));
  },

  /** POST …/penalties/:id/waive — forgives some or all of what is still owed on a penalty charge. */
  async waivePenalty(transactionId: number, payload: WaivePayload): Promise<WaiveResultDTO> {
    return unwrap<WaiveResultDTO>(client.post(`${BASE}/penalties/${transactionId}/waive`, payload));
  },

  async listWaivers(params: { page?: number; limit?: number }): Promise<WaiverListDTO> {
    return unwrap<WaiverListDTO>(client.get(`${BASE}/penalties/waivers`, { params }));
  },
};
