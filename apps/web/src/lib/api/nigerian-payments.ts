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

export interface PaymentProof {
  id: string;
  associationId: string;
  memberId?: string;
  transactionId?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
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

  async updateBankAccount(id: string, data: Partial<BankAccount>): Promise<BankAccount> {
    const response = await api.put(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`, data);
    return response.data.data;
  },

  async deleteBankAccount(id: string): Promise<void> {
    await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}`);
  },

  async setDefaultBankAccount(id: string): Promise<BankAccount> {
    const response = await api.patch(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_ACCOUNTS}/${id}/set-default`);
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
    return { data: result.transfers || [], total: result.total, page: result.page, limit: result.limit };
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
    const response = await api.put(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}`, data);
    return response.data.data;
  },

  async deleteBankTransfer(id: string): Promise<void> {
    await api.delete(`${API_ROUTES.NIGERIAN_PAYMENTS.BANK_TRANSFERS}/${id}`);
  },

  async verifyBankTransfer(id: string, data: { verified: boolean; notes?: string }): Promise<BankTransfer> {
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
  }): Promise<{ data: PaymentProof[]; total: number; page: number; limit: number }> {
    const response = await api.get(API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS, { params });
    return response.data;
  },

  async getPaymentProof(id: string): Promise<PaymentProof> {
    const response = await api.get(`${API_ROUTES.NIGERIAN_PAYMENTS.PAYMENT_PROOFS}/${id}`);
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

  async verifyPaymentProof(id: string, data: { verified: boolean; rejectionReason?: string }): Promise<PaymentProof> {
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
