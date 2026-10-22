/** Cooperatives module types — `/api/cooperatives/*` (tenant + `cooperatives` module required). Verified 2026-10-21 against cooperatives.service.ts / cooperatives.types.ts. */
import type { IsoDateString, MoneyValue } from './common';

export type SavingsAccountType = 'REGULAR' | 'THRIFT' | 'TARGET' | 'FIXED_DEPOSIT';
export type SavingsAccountStatus = 'ACTIVE' | 'DORMANT' | 'CLOSED' | 'MATURED';
export type SavingsTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'FEE';
export type SavingsDepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Decimal columns arrive as strings. */
export type SavingsAccountDTO = {
  id: number;
  memberId: number;
  accountNumber: string;
  accountType: SavingsAccountType;
  balance: MoneyValue;
  targetAmount: MoneyValue | null;
  monthlyContribution: MoneyValue | null;
  interestRate: MoneyValue;
  accruedInterest: MoneyValue;
  totalDeposits: MoneyValue;
  totalWithdrawals: MoneyValue;
  status: SavingsAccountStatus;
  maturityDate: IsoDateString | null;
  openedAt: IsoDateString;
  closedAt: IsoDateString | null;
  notes: string | null;
};

/** A guarantee the member accepted, with the loan it backs. Loan fields are null until an officer pays the loan out. */
export type GuaranteedLoanDTO = {
  id: number;
  loanApplicationId: number;
  guaranteeAmount: MoneyValue;
  acceptedAt: IsoDateString | null;
  applicationNumber: string;
  applicantName: string;
  productName: string;
  applicationStatus: string;
  loanNumber: string | null;
  principalAmount: MoneyValue | null;
  outstandingBalance: MoneyValue | null;
  loanStatus: string | null;
};

/** GET /cooperatives/my-profile — the savings and guarantee slices; loans come from /cooperatives/loans. */
export type CooperativeProfileDTO = {
  memberId: number;
  memberName: string;
  savingsAccounts: SavingsAccountDTO[];
  totalSavings: MoneyValue;
  /** Part of totalSavings held against active loans. */
  lockedSavings: MoneyValue;
  /** totalSavings − lockedSavings. */
  availableSavings: MoneyValue;
  /** Loans the member has agreed to guarantee. */
  guaranteedLoans: GuaranteedLoanDTO[];
  /** Total guaranteed on loans that are currently active. */
  guarantorExposure: MoneyValue;
};

export type SavingsTransactionDTO = {
  id: number;
  savingsAccountId: number;
  type: SavingsTransactionType;
  amount: MoneyValue;
  balanceAfter: MoneyValue;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: IsoDateString;
};

export type PaginationDTO = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

export type SavingsTransactionsResponseDTO = { transactions: SavingsTransactionDTO[]; pagination: PaginationDTO };

export type SavingsDepositDTO = {
  id: number;
  savingsAccountId: number;
  accountNumber: string;
  amount: MoneyValue;
  paymentDate: IsoDateString;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: SavingsDepositStatus;
  reviewedAt: IsoDateString | null;
  rejectionReason: string | null;
  createdAt: IsoDateString;
};

export type SavingsDepositsResponseDTO = { deposits: SavingsDepositDTO[]; pagination: PaginationDTO };

export type SubmitSavingsDepositPayload = {
  savingsAccountId: number;
  amount: string;
  /** ISO date (YYYY-MM-DD or full ISO) — the API rejects a date more than a day in the future. */
  paymentDate: string;
  reference?: string;
  memberNote?: string;
  file: { uri: string; name: string; type: string };
};
