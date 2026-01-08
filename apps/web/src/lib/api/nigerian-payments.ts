// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES API CLIENT
// ============================================

import api from '../axios';

// Types
export interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
}

export interface BankTransfer {
  id: number;
  transactionId: number | null;
  bankAccountId: number | null;
  memberId: number | null;
  senderBankName: string;
  senderAccountNumber: string | null;
  senderAccountName: string | null;
  amount: string;
  reference: string;
  transferDate: string;
  narration: string | null;
  status: 'PENDING' | 'VERIFIED' | 'MATCHED' | 'REJECTED';
  verifiedBy: number | null;
  verifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  transaction?: {
    id: number;
    referenceNumber: string;
    amount: string;
    status: string;
  };
  member?: {
    id: number;
    memberId: string;
    firstName: string;
    lastName: string;
  };
  bankAccount?: {
    id: number;
    bankName: string;
    accountNumber: string;
  };
  paymentProofs?: {
    id: number;
    filename: string;
    filepath: string;
    status: string;
    uploadedAt: string;
  }[];
}

export interface StatementImport {
  id: number;
  bankAccountId: number;
  filename: string;
  importDate: string;
  startDate: string | null;
  endDate: string | null;
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  bankAccount?: {
    bankName: string;
    accountNumber: string;
  };
}

export interface StatementEntry {
  id: number;
  importId: number;
  transactionDate: string;
  valueDate: string | null;
  reference: string | null;
  description: string;
  debitAmount: string | null;
  creditAmount: string | null;
  balance: string | null;
  matchStatus: 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUAL_MATCHED' | 'REJECTED';
  matchedTransactionId: number | null;
  matchConfidence: number | null;
}

export interface Reconciliation {
  id: number;
  transactionId: number;
  statementEntryId: number | null;
  matchType: 'AUTO_REFERENCE' | 'AUTO_AMOUNT' | 'MANUAL';
  matchedAmount: string;
  variance: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED';
  reconciledBy: number | null;
  reconciledAt: string | null;
  notes: string | null;
  transaction?: any;
  bankTransfers?: any[];
}

export interface PaymentProof {
  id: number;
  transactionId: number | null;
  bankTransferId: number | null;
  memberId: number;
  filename: string;
  filepath: string;
  fileSize: number;
  mimeType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string;
  verifiedBy: number | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  transaction?: any;
  bankTransfer?: any;
  member?: any;
}

export interface UnmatchedDashboard {
  totalUnmatched: number;
  totalUnmatchedAmount: string;
  pendingBankTransfers: number;
  pendingStatementEntries: number;
  pendingPaymentProofs: number;
  recentUnmatched: Array<{
    type: 'bank_transfer' | 'statement_entry';
    id: number;
    amount: string;
    reference: string | null;
    date: string;
    description: string;
  }>;
}

export interface AutoMatchResult {
  matched: number;
  unmatched: number;
  matches: Array<{
    transactionId: number;
    bankTransferId?: number;
    statementEntryId?: number;
    confidence: number;
    matchType: string;
  }>;
}

export interface NigerianBank {
  code: string;
  name: string;
}

// API Functions

// Bank Accounts
export const getBankAccounts = async (isActive?: boolean) => {
  const params = isActive !== undefined ? { isActive: String(isActive) } : {};
  const response = await api.get('/payments/nigerian/bank-accounts', { params });
  return response.data;
};

export const getBankAccountById = async (id: number) => {
  const response = await api.get(`/payments/nigerian/bank-accounts/${id}`);
  return response.data;
};

export const createBankAccount = async (data: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  isDefault?: boolean;
  description?: string;
}) => {
  const response = await api.post('/payments/nigerian/bank-accounts', data);
  return response.data;
};

export const updateBankAccount = async (id: number, data: Partial<{
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  isDefault: boolean;
  description: string;
}>) => {
  const response = await api.patch(`/payments/nigerian/bank-accounts/${id}`, data);
  return response.data;
};

export const deleteBankAccount = async (id: number) => {
  const response = await api.delete(`/payments/nigerian/bank-accounts/${id}`);
  return response.data;
};

export const getNigerianBanks = async (): Promise<{ data: { banks: NigerianBank[] } }> => {
  const response = await api.get('/payments/nigerian/banks');
  return response.data;
};

// Bank Transfers
export const getBankTransfers = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  memberId?: number;
  bankAccountId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
}) => {
  const response = await api.get('/payments/nigerian/bank-transfers', { params });
  return response.data;
};

export const getBankTransferById = async (id: number) => {
  const response = await api.get(`/payments/nigerian/bank-transfers/${id}`);
  return response.data;
};

export const createBankTransfer = async (data: {
  transactionId?: number;
  bankAccountId?: number;
  memberId?: number;
  senderBankName: string;
  senderAccountNumber?: string;
  senderAccountName?: string;
  amount: number;
  reference: string;
  transferDate: string;
  narration?: string;
  notes?: string;
}) => {
  const response = await api.post('/payments/nigerian/bank-transfers', data);
  return response.data;
};

export const updateBankTransfer = async (id: number, data: any) => {
  const response = await api.patch(`/payments/nigerian/bank-transfers/${id}`, data);
  return response.data;
};

export const verifyBankTransfer = async (id: number, data: {
  status: 'VERIFIED' | 'REJECTED';
  notes?: string;
}) => {
  const response = await api.post(`/payments/nigerian/bank-transfers/${id}/verify`, data);
  return response.data;
};

// Statement Import
export const importBankStatement = async (data: {
  bankAccountId: number;
  filename: string;
  entries: Array<{
    transactionDate: string;
    valueDate?: string;
    reference?: string;
    description: string;
    debitAmount?: number;
    creditAmount?: number;
    balance?: number;
  }>;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await api.post('/payments/nigerian/import-statement', data);
  return response.data;
};

export const getStatementImports = async (page = 1, limit = 20) => {
  const response = await api.get('/payments/nigerian/statement-imports', {
    params: { page, limit },
  });
  return response.data;
};

export const getStatementEntries = async (params?: {
  page?: number;
  limit?: number;
  importId?: number;
  matchStatus?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const response = await api.get('/payments/nigerian/statement-entries', { params });
  return response.data;
};

// Reconciliation
export const reconcilePayment = async (data: {
  transactionId: number;
  bankTransferId?: number;
  statementEntryId?: number;
  matchType: 'AUTO_REFERENCE' | 'AUTO_AMOUNT' | 'MANUAL';
  matchedAmount: number;
  variance?: number;
  notes?: string;
}) => {
  const response = await api.post('/payments/nigerian/reconcile', data);
  return response.data;
};

export const confirmReconciliation = async (id: number, data: {
  status: 'CONFIRMED' | 'DISPUTED';
  notes?: string;
}) => {
  const response = await api.post(`/payments/nigerian/reconciliations/${id}/confirm`, data);
  return response.data;
};

export const getReconciliations = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  matchType?: string;
}) => {
  const response = await api.get('/payments/nigerian/reconciliations', { params });
  return response.data;
};

// Auto-Matching
export const runAutoMatch = async (): Promise<{ data: AutoMatchResult }> => {
  const response = await api.post('/payments/nigerian/auto-match');
  return response.data;
};

export const applyAutoMatches = async (matches: AutoMatchResult['matches']) => {
  const response = await api.post('/payments/nigerian/auto-match/apply', { matches });
  return response.data;
};

// Payment Proofs
export const uploadPaymentProof = async (formData: FormData) => {
  const response = await api.post('/payments/nigerian/proofs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getPaymentProofs = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  memberId?: number;
  transactionId?: number;
}) => {
  const response = await api.get('/payments/nigerian/proofs', { params });
  return response.data;
};

export const getPaymentProofById = async (id: number) => {
  const response = await api.get(`/payments/nigerian/proofs/${id}`);
  return response.data;
};

export const verifyPaymentProof = async (id: number, data: {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  notes?: string;
}) => {
  const response = await api.post(`/payments/nigerian/proofs/${id}/verify`, data);
  return response.data;
};

// Dashboard
export const getUnmatchedDashboard = async (): Promise<{ data: UnmatchedDashboard }> => {
  const response = await api.get('/payments/nigerian/unmatched-dashboard');
  return response.data;
};
