import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

// Types
export interface UnmatchedDashboard {
  totalUnmatched: number;
  totalUnmatchedAmount: number;
  pendingProofs: number;
  recentUnmatched: BankStatementEntry[];
}
export interface BankAccount {
  id: string;
  associationId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransfer {
  id: string;
  associationId: string;
  senderBankName: string;
  senderAccountNumber: string;
  senderAccountName?: string;
  amount: number;
  reference: string;
  transferDate: string;
  narration?: string;
  notes?: string;
  memberId?: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    memberId: string;
  };
  receivingBankAccountId: string;
  receivingBankAccount?: BankAccount;
  status: 'PENDING' | 'VERIFIED' | 'MATCHED' | 'REJECTED';
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reconciliation {
  id: string;
  associationId: string;
  bankStatementEntryId?: string;
  bankTransferId?: string;
  transactionId?: string;
  variance: number;
  confidenceScore?: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  reconciledAt?: string;
  reconciledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankStatementImport {
  id: string;
  associationId: string;
  fileName: string;
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  importedAt: string;
  createdAt: string;
}

export interface BankStatementEntry {
  id: string;
  importId: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  balance?: number;
  matchStatus: 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUALLY_MATCHED';
  reconciliationId?: string;
  createdAt: string;
}

// Reconciled against the real backend shape (R7.2/G17) — ids are numbers, status is
// PENDING/APPROVED/REJECTED (not VERIFIED), file fields are nullable (a Cash/Card/POS
// declaration has no file, only declarationNote), and transactionIds (plural) covers
// a member declaring one payment against several outstanding items at once.
export interface PaymentProof {
  id: number;
  associationId: number;
  memberId: number;
  transactionId: number | null;
  transactionIds: number[];
  bankTransferId: number | null;
  paymentMethod: string | null;
  filename: string | null;
  /** Never sent any more — the storage key stays on the server. Use `hasFile` and `getPaymentProofFileUrl`. */
  filepath?: string | null;
  /** Whether a receipt file is attached (lists and the detail endpoint). */
  hasFile?: boolean;
  fileSize: number | null;
  mimeType: string | null;
  declarationNote: string | null;
  uploadedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedAt?: string | null;
  verifiedBy?: number | null;
  rejectionReason?: string | null;
  notes?: string | null;
  member?: { id: number; memberId: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; userId?: number | null };
  transaction?: { id: number; referenceNumber: string; amount: number; status: string } | null;
  /** Detail endpoint only: the charges this proof asks to settle, each at the balance approving would record. */
  declaredItems?: PaymentProofDeclaredItem[];
  /** Detail endpoint only: what approving records in total. */
  declaredBalance?: string | number;
}

export interface PaymentProofDeclaredItem {
  id: number;
  referenceNumber: string | null;
  category: { id: number; name: string; type: string };
  dueDate: string | null;
  status: string;
  isVoided: boolean;
  amount: string | number;
  paid: string | number;
  balance: string | number;
}

export interface PaymentProofFileLink {
  url: string;
  filename: string | null;
  mimeType: string | null;
  expiresInSeconds: number;
}

export interface NigerianBank {
  code: string;
  name: string;
  slug: string;
  longcode: string;
  gateway?: string;
  pay_with_bank_transfer: boolean;
  active: boolean;
  is_deleted: boolean;
  country: string;
  currency: string;
  type: string;
  iso31662: string;
}

export interface UnmatchedDashboard {
  totalUnmatched: number;
  totalUnmatchedAmount: number;
  pendingProofs: number;
  recentUnmatched: BankStatementEntry[];
}

// API Client
export const nigerianPaymentsApi = {
  // Bank Accounts
  async getBankAccounts(): Promise<BankAccount[]> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS);
    return response.data.data?.bankAccounts || [];
  },

  async createBankAccount(data: Partial<BankAccount>): Promise<BankAccount> {
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS, data);
    return response.data.data;
  },

  /** PATCH /bank-accounts/:id. `newDefaultId` is set when retiring the default made another account the default. */
  async updateBankAccount(id: string | number, data: Partial<BankAccount>): Promise<BankAccount & { newDefaultId?: number | null }> {
    const response = await api.patch(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`, data);
    return response.data.data;
  },

  /** DELETE /bank-accounts/:id — deletes an unused account, deactivates one with transfers or statements. Refused for the last active account. */
  async deleteBankAccount(id: string | number): Promise<{ message: string; outcome: 'deleted' | 'deactivated'; newDefaultId: number | null }> {
    const response = await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`);
    return { message: response.data.message, ...response.data.data };
  },

  /** Making an account the default moves the default (there is no separate set-default route). */
  async setDefaultBankAccount(id: string | number): Promise<BankAccount> {
    const response = await api.patch(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`, { isDefault: true });
    return response.data.data;
  },

  async reactivateBankAccount(id: string | number): Promise<BankAccount> {
    const response = await api.patch(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`, { isActive: true });
    return response.data.data;
  },

  // Bank Transfers
  async getBankTransfers(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    memberId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BankTransfer[]; total: number; page: number; limit: number }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS, { params });
    const result = response.data.data;
    // The API nests the paging under `pagination` (totalCount, not total) — reading the top level left every list without a count.
    return {
      data: result.transfers || [],
      total: result.pagination?.totalCount ?? 0,
      page: result.pagination?.page ?? 1,
      limit: result.pagination?.limit ?? params?.limit ?? 20,
    };
  },

  async getBankTransfer(id: string): Promise<BankTransfer> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}`);
    return response.data.data;
  },

  async createBankTransfer(data: Partial<BankTransfer>): Promise<BankTransfer> {
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS, data);
    return response.data.data;
  },

  async updateBankTransfer(id: string, data: Partial<BankTransfer>): Promise<BankTransfer> {
    // PATCH, as the API defines it — and only a transfer that is still waiting can be edited; the status can't be set here.
    const response = await api.patch(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}`, data);
    return response.data.data;
  },

  async deleteBankTransfer(id: string): Promise<void> {
    await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}`);
  },

  /**
   * Verify or reject a waiting transfer, once. Verifying confirms the money reached the account; it records no payment.
   * The API expects `status`, not a boolean — a rejection should carry the reason in `notes`.
   */
  async verifyBankTransfer(id: string | number, data: { status: 'VERIFIED' | 'REJECTED'; notes?: string }): Promise<BankTransfer> {
    const response = await api.post(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}/verify`, data);
    return response.data.data;
  },

  // Reconciliation
  async getReconciliations(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Reconciliation[]; total: number; page: number; limit: number }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.RECONCILIATIONS, { params });
    return response.data;
  },

  async getReconciliation(id: string): Promise<Reconciliation> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.RECONCILIATIONS}/${id}`);
    return response.data.data;
  },

  async createReconciliation(data: {
    bankStatementEntryId?: string;
    bankTransferId?: string;
    transactionId?: string;
  }): Promise<Reconciliation> {
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.RECONCILIATIONS, data);
    return response.data.data;
  },

  async confirmReconciliation(id: string): Promise<Reconciliation> {
    const response = await api.post(`${API_ROUTES.NIGERIAN_PAYMENTS.RECONCILIATIONS}/${id}/confirm`);
    return response.data.data;
  },

  async deleteReconciliation(id: string): Promise<void> {
    await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.RECONCILIATIONS}/${id}`);
  },

  async runAutoMatch(): Promise<{ matches: Reconciliation[]; total: number }> {
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.AUTO_MATCH);
    return response.data;
  },

  async applyAutoMatches(matches: Array<{ bankStatementEntryId: string; bankTransferId?: string; transactionId?: string }>): Promise<Reconciliation[]> {
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.AUTO_MATCH_APPLY, { matches });
    return response.data.data;
  },

  async getUnmatchedDashboard(): Promise<UnmatchedDashboard> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.UNMATCHED_DASHBOARD);
    return response.data.data;
  },

  // Bank Statements
  async getStatementImports(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BankStatementImport[]; total: number; page: number; limit: number }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.STATEMENT_IMPORTS, { params });
    return response.data;
  },

  async getStatementImport(id: string): Promise<BankStatementImport> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.STATEMENT_IMPORTS}/${id}`);
    return response.data.data;
  },

  async importStatement(file: File): Promise<BankStatementImport> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.IMPORT_STATEMENT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async getStatementEntries(params?: {
    importId?: string;
    matchStatus?: string;
    startDate?: string;
    endDate?: string;
    amountMin?: number;
    amountMax?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BankStatementEntry[]; total: number; page: number; limit: number }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.STATEMENT_ENTRIES, { params });
    return response.data;
  },

  // Payment Proofs
  async getPaymentProofs(params?: {
    status?: string;
    memberId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ proofs: PaymentProof[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean } }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS, { params });
    return response.data.data;
  },

  async getPaymentProof(id: string): Promise<PaymentProof> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS}/${id}`);
    return response.data.data;
  },

  /** A signed link to the receipt, valid for an hour. A bare `/download` link can't carry the auth token, so open this URL instead. */
  async getPaymentProofFileUrl(id: string | number): Promise<PaymentProofFileLink> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS}/${id}/file-url`);
    return response.data.data;
  },

  async uploadPaymentProof(file: File, memberId?: string, transactionId?: string): Promise<PaymentProof> {
    const formData = new FormData();
    formData.append('file', file);
    if (memberId) formData.append('memberId', memberId);
    if (transactionId) formData.append('transactionId', transactionId);
    const response = await api.post(API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async verifyPaymentProof(id: number, data: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string; notes?: string }): Promise<PaymentProof> {
    const response = await api.post(`${API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS}/${id}/verify`, data);
    return response.data.data;
  },

  async deletePaymentProof(id: string): Promise<void> {
    await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS}/${id}`);
  },

  // Nigerian Banks
  async getNigerianBanks(): Promise<NigerianBank[]> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.BANKS);
    return response.data.data?.banks || [];
  },
};

export default nigerianPaymentsApi;
