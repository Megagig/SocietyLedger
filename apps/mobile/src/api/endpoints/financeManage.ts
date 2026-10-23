import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  BulkChargePayload,
  ChargeDetailDTO,
  ChargeListDTO,
  ChargeListParams,
  ChargeStatsDTO,
  CreateChargePayload,
  EditChargePayload,
  FinanceCategoryDTO,
  FinanceDashboardDTO,
  RecordPaymentPayload,
  RecordPaymentResultDTO,
  VoidReplacePayload,
} from '@/types/api/financeManage';

/**
 * Finance for officers. Overview needs `ledger.view`; creating charges `ledger.create`; editing and voiding `ledger.edit`; deleting
 * `ledger.reverse`; recording a payment `payments.manual_create`. Voiding also asks for the officer's password (403 `REAUTH_FAILED`
 * when wrong). A charge paid through a cash receipt can't be deleted (409 `CASH_BACKED`).
 */
export const financeManageApi = {
  /** GET /finance/dashboard — this month's billing and collections, what is outstanding, and the latest payments. */
  async getDashboard(): Promise<FinanceDashboardDTO> {
    return unwrap<FinanceDashboardDTO>(client.get('/finance/dashboard'));
  },

  /** GET /finance/transactions/stats — totals by status and by type (voided charges excluded). */
  async getStats(): Promise<ChargeStatsDTO> {
    return unwrap<ChargeStatsDTO>(client.get('/finance/transactions/stats'));
  },

  /** GET /finance/transactions — newest first. */
  async listCharges(params: ChargeListParams): Promise<ChargeListDTO> {
    return unwrap<ChargeListDTO>(client.get('/finance/transactions', { params }));
  },

  async getCharge(id: number): Promise<ChargeDetailDTO> {
    return unwrap<ChargeDetailDTO>(client.get(`/finance/transactions/${id}`));
  },

  /** GET /finance/categories — the active ones, for the pickers. */
  async listCategories(): Promise<FinanceCategoryDTO[]> {
    const data = await unwrap<{ categories: FinanceCategoryDTO[] }>(client.get('/finance/categories', { params: { isActive: 'true', limit: 100 } }));
    return data.categories;
  },

  async createCharge(payload: CreateChargePayload): Promise<{ id: number }> {
    return unwrap<{ id: number }>(client.post('/finance/transactions', payload));
  },

  /** POST /finance/transactions/bulk — one charge per member, all or nothing. */
  async createBulk(payload: BulkChargePayload): Promise<unknown> {
    return unwrap<unknown>(client.post('/finance/transactions/bulk', payload));
  },

  /** PUT /finance/transactions/:id/edit — only while nothing has been paid (400 otherwise: void and replace instead). */
  async editCharge(id: number, payload: EditChargePayload): Promise<unknown> {
    return unwrap<unknown>(client.put(`/finance/transactions/${id}/edit`, payload));
  },

  /** POST /finance/transactions/:id/void-and-replace — voids the charge and creates a corrected one; needs the officer's password. */
  async voidAndReplace(id: number, payload: VoidReplacePayload): Promise<{ newTransaction: { id: number } }> {
    return unwrap<{ newTransaction: { id: number } }>(client.post(`/finance/transactions/${id}/void-and-replace`, payload));
  },

  /** DELETE /finance/transactions/:id — returns the audit log id that Undo uses. */
  async deleteCharge(id: number): Promise<{ auditLogId: number }> {
    return unwrap<{ auditLogId: number }>(client.delete(`/finance/transactions/${id}`));
  },

  /** POST /finance/transactions/undo-delete/:auditLogId — restores the charge (not its payments). */
  async undoDelete(auditLogId: number): Promise<unknown> {
    return unwrap<unknown>(client.post(`/finance/transactions/undo-delete/${auditLogId}`));
  },

  /** POST /finance/payments — records money a member paid against a charge. 400 when it exceeds the balance or the charge was voided. */
  async recordPayment(payload: RecordPaymentPayload): Promise<RecordPaymentResultDTO> {
    return unwrap<RecordPaymentResultDTO>(client.post('/finance/payments', payload));
  },
};
