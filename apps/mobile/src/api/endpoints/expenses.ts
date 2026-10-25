import { client } from '../client';
import { unwrap } from '../envelope';
import type { BudgetPositionDTO, ExpenseDetailDTO, ExpenseListDTO, ExpenseOptionsDTO, ExpenseParams, ExpensePayload, ReceiptLinkDTO } from '@/types/api/expenses';

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/**
 * Spending recorded after it is paid. Reading needs `ledger.view`; recording, changing and sending `ledger.create`; approving, rejecting
 * and voiding `payments.approve`. The server refuses a voucher with no receipt above the limit (400 `RECEIPT_REQUIRED`), approving your
 * own (403 `OWN_EXPENSE`), a date in a closed period (409 `PERIOD_CLOSED`), and approving or voiding with the wrong password
 * (403 `REAUTH_FAILED`).
 */
export const expensesApi = {
  /** GET /expenses/options — the spending categories, the accounts money can be paid from, and the receipt limit. */
  async getOptions(): Promise<ExpenseOptionsDTO> {
    return unwrap<ExpenseOptionsDTO>(client.get('/expenses/options'));
  },

  /** GET /expenses/budget-check — where the category stands against its budget line if this amount were spent; null when no budget covers it. */
  async checkBudget(params: { categoryAccountId: number; amount: number; date: string }): Promise<BudgetPositionDTO | null> {
    return unwrap<BudgetPositionDTO | null>(client.get('/expenses/budget-check', { params }));
  },

  async list(params: ExpenseParams): Promise<ExpenseListDTO> {
    return unwrap<ExpenseListDTO>(client.get('/expenses', { params }));
  },

  async get(id: number): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.get(`/expenses/${id}`));
  },

  async create(payload: ExpensePayload): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post('/expenses', payload));
  },

  async update(id: number, payload: ExpensePayload): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.put(`/expenses/${id}`, payload));
  },

  async remove(id: number): Promise<{ removed: boolean }> {
    return unwrap<{ removed: boolean }>(client.delete(`/expenses/${id}`));
  },

  /** POST /expenses/:id/receipt (multipart `receipt`; JPEG, PNG, WebP or PDF up to 5MB, checked on the server by its real contents). */
  async uploadReceipt(id: number, file: { uri: string; name: string; type: string }): Promise<ExpenseDetailDTO> {
    const form = new FormData();
    form.append('receipt', { uri: file.uri, name: file.name, type: file.type } as never);
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/receipt`, form, MULTIPART));
  },

  async removeReceipt(id: number): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.delete(`/expenses/${id}/receipt`));
  },

  /** GET /expenses/:id/receipt-url — a signed link, valid for an hour. */
  async receiptLink(id: number): Promise<ReceiptLinkDTO> {
    return unwrap<ReceiptLinkDTO>(client.get(`/expenses/${id}/receipt-url`));
  },

  async submit(id: number): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/submit`));
  },

  /** The officer who sent it takes it back, to change it. */
  async withdraw(id: number): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/withdraw`));
  },

  /** POST /expenses/:id/approve — approving posts it to the books, so the approver's password goes with it. */
  async approve(id: number, password: string): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/approve`, { password }));
  },

  async reject(id: number, reason: string): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/reject`, { reason }));
  },

  /** POST /expenses/:id/void — cancels an approved expense with a reversing entry; needs a reason and the password. */
  async voidVoucher(id: number, payload: { reason: string; password: string }): Promise<ExpenseDetailDTO> {
    return unwrap<ExpenseDetailDTO>(client.post(`/expenses/${id}/void`, payload));
  },
};
