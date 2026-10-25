import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  CooperativeProfileDTO,
  SavingsAccountDTO,
  SavingsDepositDTO,
  SavingsDepositsResponseDTO,
  SavingsTransactionsResponseDTO,
  SubmitSavingsDepositPayload,
} from '@/types/api/cooperatives';

/** `/cooperatives/*` — tenant + `cooperatives` module required. Member calls are scoped to the caller's own member server-side. */
export const cooperativesApi = {
  /** GET /cooperatives/my-profile — accounts plus total / held / available savings. 404 for an account with no member profile. */
  async getMyProfile(): Promise<CooperativeProfileDTO> {
    return unwrap<CooperativeProfileDTO>(client.get('/cooperatives/my-profile'));
  },

  /** GET /cooperatives/savings-accounts/:id — 404 for another member's account. */
  async getSavingsAccount(id: number): Promise<SavingsAccountDTO> {
    return unwrap<SavingsAccountDTO>(client.get(`/cooperatives/savings-accounts/${id}`));
  },

  /** GET /cooperatives/savings-transactions — scoped to the caller's own accounts. */
  async listSavingsTransactions(params: { page?: number; limit?: number; savingsAccountId?: number } = {}): Promise<SavingsTransactionsResponseDTO> {
    return unwrap<SavingsTransactionsResponseDTO>(client.get('/cooperatives/savings-transactions', { params: { page: 1, limit: 20, ...params } }));
  },

  /** GET /cooperatives/savings-deposits — the caller's own receipt-backed deposit requests. */
  async listSavingsDeposits(params: { page?: number; limit?: number; savingsAccountId?: number } = {}): Promise<SavingsDepositsResponseDTO> {
    return unwrap<SavingsDepositsResponseDTO>(client.get('/cooperatives/savings-deposits', { params: { page: 1, limit: 20, ...params } }));
  },

  /** POST /cooperatives/savings-deposits (multipart) — creates a PENDING request; the balance only moves once an officer approves. */
  async submitSavingsDeposit(payload: SubmitSavingsDepositPayload): Promise<SavingsDepositDTO> {
    const formData = new FormData();
    formData.append('savingsAccountId', String(payload.savingsAccountId));
    formData.append('amount', payload.amount);
    formData.append('paymentDate', payload.paymentDate);
    if (payload.reference) formData.append('reference', payload.reference);
    if (payload.memberNote) formData.append('memberNote', payload.memberNote);
    formData.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as never);

    return unwrap<SavingsDepositDTO>(
      client.post('/cooperatives/savings-deposits', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  },

  /** GET /cooperatives/savings-deposits/:id/receipt?format=json — short-lived storage URL for the receipt. */
  async getSavingsDepositReceiptUrl(id: number): Promise<{ url: string; filename: string; mimeType: string }> {
    return unwrap(client.get(`/cooperatives/savings-deposits/${id}/receipt`, { params: { format: 'json' } }));
  },
};
