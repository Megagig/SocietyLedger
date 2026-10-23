import { client } from '../client';
import { unwrap } from '../envelope';
import type { LedgerMemberEntriesDTO, LedgerMembersDTO, LedgerMemberSummaryDTO, LedgerStatementDTO, LedgerSyncResultDTO } from '@/types/api/ledgerManage';

/**
 * Member ledgers for officers. Viewing needs `ledger.view`; resyncing needs `payments.approve` (the API's rule — the plan said
 * `ledger.edit`). The statement comes back as data; the app shares it as text rather than a PDF file.
 */
export const ledgerManageApi = {
  /** GET /member-ledger/ledger/members — every member with their running balance (positive = owes), by last name. */
  async listMembers(params: { page: number; limit: number; search?: string }): Promise<LedgerMembersDTO> {
    return unwrap<LedgerMembersDTO>(client.get('/member-ledger/ledger/members', { params }));
  },

  async getSummary(memberId: number): Promise<LedgerMemberSummaryDTO> {
    return unwrap<LedgerMemberSummaryDTO>(client.get(`/member-ledger/ledger/${memberId}/summary`));
  },

  async getEntries(memberId: number, params: { page: number; limit: number; startDate?: string; endDate?: string }): Promise<LedgerMemberEntriesDTO> {
    return unwrap<LedgerMemberEntriesDTO>(client.get(`/member-ledger/ledger/${memberId}/entries`, { params }));
  },

  async getStatement(memberId: number, startDate: string, endDate: string): Promise<LedgerStatementDTO> {
    return unwrap<LedgerStatementDTO>(client.get(`/member-ledger/ledger/${memberId}/statement`, { params: { startDate, endDate } }));
  },

  /**
   * POST /member-ledger/ledger/:memberId/sync?force=true — rebuilds the ledger from the member's charges and payments. Voided
   * charges add no debit. Without `force` it only works for a member who has no entries yet (400 otherwise).
   */
  async resync(memberId: number, force: boolean): Promise<LedgerSyncResultDTO> {
    return unwrap<LedgerSyncResultDTO>(client.post(`/member-ledger/ledger/${memberId}/sync`, undefined, { params: { force } }));
  },
};
