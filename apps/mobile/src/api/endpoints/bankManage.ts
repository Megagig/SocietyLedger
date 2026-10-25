import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  BankAccountChange,
  BankAccountDTO,
  BankAccountPayload,
  BankAccountRemoval,
  BankTransferDetailDTO,
  BankTransferListDTO,
  BankTransferListParams,
  BankTransferListItemDTO,
  NigerianBankDTO,
  RecordTransferPayload,
  UpdateBankAccountPayload,
  UpdateTransferPayload,
} from '@/types/api/bankManage';

/**
 * Officer side of bank transfers and the association's bank accounts. Transfers: list/open need `payments.view`, record/edit need
 * `payments.manual_create`, verify/reject need `payments.approve`. Accounts: list needs `settings.view`, add/edit/remove `settings.edit`.
 * Rule failures come back as 400/404/409 with a plain-words `message` (ApiError.message) — show it as is.
 */
export const bankManageApi = {
  /** GET /payments/nigerian/bank-transfers — newest transfer first. */
  async listTransfers(params: BankTransferListParams): Promise<BankTransferListDTO> {
    return unwrap<BankTransferListDTO>(client.get('/payments/nigerian/bank-transfers', { params }));
  },

  /** GET /payments/nigerian/bank-transfers/:id */
  async getTransfer(id: number): Promise<BankTransferDetailDTO> {
    return unwrap<BankTransferDetailDTO>(client.get(`/payments/nigerian/bank-transfers/${id}`));
  },

  /** POST /payments/nigerian/bank-transfers — saved as PENDING. 400 for a repeated reference (ignoring case and spaces) or a link from another association. */
  async recordTransfer(payload: RecordTransferPayload): Promise<BankTransferListItemDTO> {
    return unwrap<BankTransferListItemDTO>(client.post('/payments/nigerian/bank-transfers', payload));
  },

  /** PATCH /payments/nigerian/bank-transfers/:id — only while PENDING; the status can't be changed here. */
  async updateTransfer(id: number, payload: UpdateTransferPayload): Promise<BankTransferListItemDTO> {
    return unwrap<BankTransferListItemDTO>(client.patch(`/payments/nigerian/bank-transfers/${id}`, payload));
  },

  /** POST /payments/nigerian/bank-transfers/:id/verify — once. Confirms (or rejects) the money; it records no payment. 409 when already decided. */
  async decideTransfer(id: number, payload: { status: 'VERIFIED' | 'REJECTED'; notes?: string }): Promise<BankTransferListItemDTO> {
    return unwrap<BankTransferListItemDTO>(client.post(`/payments/nigerian/bank-transfers/${id}/verify`, payload));
  },

  /** GET /payments/nigerian/bank-accounts — default first; pass `isActive: false` for retired ones. */
  async listAccounts(isActive?: boolean): Promise<BankAccountDTO[]> {
    const data = await unwrap<{ bankAccounts: BankAccountDTO[] }>(client.get('/payments/nigerian/bank-accounts', { params: { isActive } }));
    return data.bankAccounts;
  },

  /** GET /payments/nigerian/bank-accounts/:id — 404 for an account of another association. */
  async getAccount(id: number): Promise<BankAccountDTO> {
    return unwrap<BankAccountDTO>(client.get(`/payments/nigerian/bank-accounts/${id}`));
  },

  /** POST /payments/nigerian/bank-accounts — the first active account becomes the default automatically. */
  async createAccount(payload: BankAccountPayload): Promise<BankAccountDTO> {
    return unwrap<BankAccountDTO>(client.post('/payments/nigerian/bank-accounts', payload));
  },

  /** PATCH /payments/nigerian/bank-accounts/:id — the last active account can't be retired; making another account the default moves the default. */
  async updateAccount(id: number, payload: UpdateBankAccountPayload): Promise<BankAccountDTO & BankAccountChange> {
    return unwrap<BankAccountDTO & BankAccountChange>(client.patch(`/payments/nigerian/bank-accounts/${id}`, payload));
  },

  /** DELETE /payments/nigerian/bank-accounts/:id — deletes an unused account, deactivates one with transfers or statements; 409 for the last active one. */
  async removeAccount(id: number): Promise<BankAccountRemoval> {
    return unwrap<BankAccountRemoval>(client.delete(`/payments/nigerian/bank-accounts/${id}`));
  },

  /** GET /payments/nigerian/banks */
  async listBanks(): Promise<NigerianBankDTO[]> {
    const data = await unwrap<{ banks: NigerianBankDTO[] }>(client.get('/payments/nigerian/banks'));
    return data.banks;
  },
};
