// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES TYPES
// ============================================

import { Decimal } from '@prisma/client/runtime/library';

// Bank Account Types
export interface BankAccountInput {
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  isDefault?: boolean;
  description?: string;
}

export interface BankAccountResponse {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
}

// Bank Transfer Types
export interface BankTransferInput {
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
}

export interface BankTransferResponse {
  id: number;
  transactionId: number | null;
  bankAccountId: number | null;
  memberId: number | null;
  senderBankName: string;
  senderAccountNumber: string | null;
  senderAccountName: string | null;
  amount: Decimal;
  reference: string;
  transferDate: Date;
  narration: string | null;
  status: string;
  verifiedBy: number | null;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
}

// Bank Statement Import Types
export interface StatementEntry {
  transactionDate: string;
  valueDate?: string;
  reference?: string;
  description: string;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
}

export interface StatementImportInput {
  bankAccountId: number;
  filename: string;
  entries: StatementEntry[];
  startDate?: string;
  endDate?: string;
}

// Reconciliation Types
export interface ReconcileInput {
  transactionId: number;
  bankTransferId?: number;
  statementEntryId?: number;
  matchType: 'AUTO_REFERENCE' | 'AUTO_AMOUNT' | 'MANUAL';
  matchedAmount: number;
  variance?: number;
  notes?: string;
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

// Payment Proof Types
export interface PaymentProofInput {
  transactionId?: number;
  transactionIds?: number[];
  bankTransferId?: number;
  paymentMethod?: string;
  // Exactly one of (filename set) or (declarationNote set) — enforced in the controller.
  filename?: string;
  filepath?: string;
  fileSize?: number;
  mimeType?: string;
  declarationNote?: string;
  notes?: string;
}

export interface PaymentProofVerification {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  notes?: string;
}

// Dashboard Types
export interface UnmatchedPaymentsDashboard {
  totalUnmatched: number;
  totalUnmatchedAmount: Decimal;
  pendingBankTransfers: number;
  pendingStatementEntries: number;
  pendingPaymentProofs: number;
  recentUnmatched: Array<{
    type: 'bank_transfer' | 'statement_entry';
    id: number;
    amount: Decimal;
    reference: string | null;
    date: Date;
    description: string;
  }>;
}

// Nigerian Bank Codes - Comprehensive list including commercial banks, 
// microfinance banks, mobile money operators, and payment service banks
export const NIGERIAN_BANKS = [
  // Commercial Banks
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '302', name: 'TAJBank' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  
  // Microfinance Banks
  { code: '090110', name: 'VFD Microfinance Bank' },
  { code: '090115', name: 'TCF Microfinance Bank' },
  { code: '090134', name: 'Accion Microfinance Bank' },
  { code: '090136', name: 'Baobab Microfinance Bank' },
  { code: '090175', name: 'Rubies Microfinance Bank' },
  { code: '090267', name: 'Kuda Microfinance Bank' },
  { code: '090303', name: 'Sparkle Microfinance Bank' },
  { code: '090325', name: 'Moniepoint Microfinance Bank' },
  { code: '090405', name: 'Renmoney Microfinance Bank' },
  { code: '090551', name: 'Fairmoney Microfinance Bank' },
  { code: '090139', name: 'Visa Microfinance Bank' },
  { code: '090198', name: 'RenMoney Microfinance Bank' },
  { code: '090270', name: 'AB Microfinance Bank' },
  { code: '090328', name: 'Eyowo Microfinance Bank' },
  { code: '090331', name: 'IBILE Microfinance Bank' },
  { code: '090360', name: 'Cashconnect Microfinance Bank' },
  { code: '090362', name: 'Molusi Microfinance Bank' },
  { code: '090364', name: 'Nuture Microfinance Bank' },
  { code: '090365', name: 'Corestep Microfinance Bank' },
  { code: '090366', name: 'Firmus Microfinance Bank' },
  { code: '090369', name: 'Seedvest Microfinance Bank' },
  { code: '090372', name: 'Legend Microfinance Bank' },
  { code: '090373', name: 'Think Finance Microfinance Bank' },
  { code: '090385', name: 'GTI Microfinance Bank' },
  { code: '090386', name: 'Interland Microfinance Bank' },
  { code: '090391', name: 'Davodani Microfinance Bank' },
  { code: '090392', name: 'Mozfin Microfinance Bank' },
  { code: '090393', name: 'Bridgeway Microfinance Bank' },
  { code: '090394', name: 'Amac Microfinance Bank' },
  { code: '090395', name: 'Borgu Microfinance Bank' },
  { code: '090396', name: 'Oscotech Microfinance Bank' },
  { code: '090400', name: 'Finca Microfinance Bank' },
  { code: '090401', name: 'Shepherd Trust Microfinance Bank' },
  { code: '090404', name: 'Olowolagba Microfinance Bank' },
  { code: '090406', name: 'Business Support Microfinance Bank' },
  { code: '090408', name: 'GMB Microfinance Bank' },
  { code: '090409', name: 'Fcmb Microfinance Bank' },
  { code: '090410', name: 'Maritime Microfinance Bank' },
  { code: '090448', name: 'Moyofade Microfinance Bank' },
  { code: '090463', name: 'Rehoboth Microfinance Bank' },
  
  // Payment Service Banks (PSBs)
  { code: '120001', name: '9mobile 9PSB' },
  { code: '120002', name: 'Paga' },
  { code: '120003', name: 'MTN MoMo PSB' },
  { code: '120004', name: 'Airtel Smartcash PSB' },
  { code: '100033', name: 'Palmpay' },
  { code: '100004', name: 'Opay' },
  
  // Mobile Money Operators
  { code: '110001', name: 'Flutterwave' },
  { code: '110002', name: 'Paystack' },
  { code: '110003', name: 'Interswitch' },
  { code: '110004', name: 'Remita' },
  
  // Other/Custom
  { code: 'OTHER', name: 'Other (Enter manually)' },
] as const;
