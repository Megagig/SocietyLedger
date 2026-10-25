import type { IsoDateString, MoneyValue } from './common';
import type { PaginationDTO, SavingsAccountDTO, SavingsAccountStatus, SavingsAccountType, SavingsDepositDTO, SavingsTransactionType } from './cooperatives';
import type { InterestType, LoanApplicationDTO, LoanApplicationStatus, LoanDTO, LoanProductDTO, LoanRepaymentRequestDTO, LoanStatus } from './loans';

/**
 * The officer side of the cooperative (`/api/cooperatives`): savings accounts, the deposit and repayment queues, loan products,
 * applications and loans. The member-side shapes in `cooperatives.ts` and `loans.ts` are reused; an officer's list adds who each one
 * belongs to. Rule failures answer 400/403/404/409 with a plain-words `message` and a `code` (`OWN_REQUEST`, `INSUFFICIENT_BALANCE`,
 * `SAVINGS_HELD`, `ALREADY_DECIDED`, `ALREADY_DISBURSED`, `DISBURSE_ACCOUNT_INVALID`, `REPAYMENT_TOO_LARGE`, …).
 */

export type OfficerSavingsAccountDTO = SavingsAccountDTO & {
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
};

export type OfficerSavingsAccountsDTO = { accounts: OfficerSavingsAccountDTO[]; pagination: PaginationDTO };

export type OfficerDepositRequestDTO = SavingsDepositDTO & { memberId: number; memberName: string; memberNumber: string };
export type OfficerDepositRequestsDTO = { deposits: OfficerDepositRequestDTO[]; pagination: PaginationDTO };

export type OfficerRepaymentRequestDTO = LoanRepaymentRequestDTO & { memberId: number; memberName: string; memberNumber: string };
export type OfficerRepaymentRequestsDTO = { repaymentRequests: OfficerRepaymentRequestDTO[]; pagination: PaginationDTO };

export type OfficerLoanProductDTO = LoanProductDTO & { gracePeriodDays: number; lateFeePercent: MoneyValue; lateFeeFixed: MoneyValue };
export type OfficerLoanProductsDTO = { products: OfficerLoanProductDTO[]; pagination: PaginationDTO };

export type OfficerApplicationDTO = LoanApplicationDTO & {
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  collateralDescription: string | null;
  reviewedAt: IsoDateString | null;
  approvedAt: IsoDateString | null;
};
export type OfficerApplicationsDTO = { applications: OfficerApplicationDTO[]; pagination: PaginationDTO };

export type OfficerLoanDTO = LoanDTO & {
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  amountDisbursed: MoneyValue;
  processingFee: MoneyValue;
};
export type OfficerLoansDTO = { loans: OfficerLoanDTO[]; pagination: PaginationDTO };

/** GET /cooperatives/dashboard. */
export type CooperativeDashboardDTO = {
  savingsSummary: { totalAccounts: number; activeAccounts: number; totalBalance: MoneyValue; totalDepositsThisMonth: MoneyValue; totalWithdrawalsThisMonth: MoneyValue; averageBalance: MoneyValue };
  loansSummary: {
    totalActiveLoans: number;
    totalDisbursed: MoneyValue;
    totalOutstanding: MoneyValue;
    totalCollectedThisMonth: MoneyValue;
    overdueLoans: number;
    overdueAmount: MoneyValue;
    defaultRate: number;
  };
  pendingActions: { pendingLoanApplications: number; pendingGuarantorRequests: number; overdueRepayments: number };
};

export type OpenAccountPayload = {
  memberId: number;
  accountType: SavingsAccountType;
  targetAmount?: number;
  monthlyContribution?: number;
  interestRate?: number;
  notes?: string;
};

export type RecordSavingsPayload = {
  savingsAccountId: number;
  type: Extract<SavingsTransactionType, 'DEPOSIT' | 'WITHDRAWAL'>;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
};

export type ReviewApplicationPayload = { action: 'approve' } | { action: 'reject'; rejectionReason: string; comments?: string };
export type ReviewAction = 'approve' | 'reject';

export type DisbursementMethod = 'bank_transfer' | 'cash' | 'cheque' | 'savings_credit';
export type DisbursePayload = { disbursementMethod: DisbursementMethod; savingsAccountId?: number; reference?: string; notes?: string };

export type RecordLoanRepaymentPayload = { loanId: number; amount: number; paymentMethod: string; reference?: string; notes?: string };

export type LoanProductPayload = {
  name: string;
  description?: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  interestType: InterestType;
  minTenureMonths: number;
  maxTenureMonths: number;
  processingFeePercent?: number;
  processingFeeFixed?: number;
  requiresGuarantor: boolean;
  minGuarantors?: number;
  maxLoanToSavingsRatio?: number;
  lockSavings?: boolean;
  gracePeriodDays?: number;
  lateFeePercent?: number;
  lateFeeFixed?: number;
  isActive?: boolean;
};

export type { LoanApplicationStatus, LoanStatus, SavingsAccountStatus };
