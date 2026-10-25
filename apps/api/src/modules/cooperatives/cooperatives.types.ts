import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// PHASE 8.5: COOPERATIVES & LOANS TYPES
// Enterprise Feature - Thrift & Savings, Loans, Guarantors
// ============================================

// ==========================================
// SAVINGS ACCOUNT TYPES
// ==========================================

export interface SavingsAccountInput {
  memberId: number;
  accountType: SavingsAccountType;
  targetAmount?: number;
  monthlyContribution?: number;
  interestRate?: number;
  maturityDate?: string;
  notes?: string;
}

export interface SavingsAccountResponse {
  id: number;
  memberId: number;
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  accountNumber: string;
  accountType: SavingsAccountType;
  balance: Decimal;
  targetAmount: Decimal | null;
  monthlyContribution: Decimal | null;
  interestRate: Decimal;
  accruedInterest: Decimal;
  totalDeposits: Decimal;
  totalWithdrawals: Decimal;
  status: SavingsAccountStatus;
  maturityDate: Date | null;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
}

export type SavingsAccountType = 'REGULAR' | 'THRIFT' | 'TARGET' | 'FIXED_DEPOSIT';
export type SavingsAccountStatus = 'ACTIVE' | 'DORMANT' | 'CLOSED' | 'MATURED';

// ==========================================
// SAVINGS TRANSACTION TYPES
// ==========================================

export interface SavingsTransactionInput {
  savingsAccountId: number;
  type: SavingsTransactionType;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

export interface SavingsTransactionResponse {
  id: number;
  savingsAccountId: number;
  type: SavingsTransactionType;
  amount: Decimal;
  balanceAfter: Decimal;
  paymentMethod: string | null;
  reference: string | null;
  processedBy: number;
  processedByName: string;
  notes: string | null;
  createdAt: Date;
}

export type SavingsTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'INTEREST' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'FEE';

// ==========================================
// LOAN PRODUCT TYPES
// ==========================================

export interface LoanProductInput {
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
}

export interface LoanProductResponse {
  id: number;
  name: string;
  description: string | null;
  minAmount: Decimal;
  maxAmount: Decimal;
  interestRate: Decimal;
  interestType: InterestType;
  minTenureMonths: number;
  maxTenureMonths: number;
  processingFeePercent: Decimal;
  processingFeeFixed: Decimal;
  requiresGuarantor: boolean;
  minGuarantors: number;
  maxLoanToSavingsRatio: Decimal | null;
  lockSavings: boolean;
  gracePeriodDays: number;
  lateFeePercent: Decimal;
  lateFeeFixed: Decimal;
  isActive: boolean;
  createdAt: Date;
}

export type InterestType = 'FLAT' | 'REDUCING_BALANCE' | 'COMPOUND';

// ==========================================
// LOAN APPLICATION TYPES
// ==========================================

export interface LoanApplicationInput {
  loanProductId: number;
  amount: number;
  tenureMonths: number;
  purpose: string;
  guarantorIds?: number[];
  collateralDescription?: string;
  collateralValue?: number;
}

export interface LoanApplicationResponse {
  id: number;
  applicationNumber: string;
  memberId: number;
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  loanProductId: number;
  loanProductName: string;
  loanProduct: { id: number; name: string } | null;
  amount: Decimal;
  tenureMonths: number;
  interestRate: Decimal;
  interestType: InterestType;
  monthlyRepayment: Decimal;
  totalRepayment: Decimal;
  totalInterest: Decimal;
  processingFee: Decimal;
  purpose: string;
  status: LoanApplicationStatus;
  collateralDescription: string | null;
  collateralValue: Decimal | null;
  guarantors: LoanGuarantorResponse[];
  appliedAt: Date;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  disbursedAt: Date | null;
}

export type LoanApplicationStatus = 
  | 'DRAFT'
  | 'PENDING_GUARANTORS'
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISBURSED'
  | 'CANCELLED';

// ==========================================
// LOAN GUARANTOR TYPES
// ==========================================

export interface LoanGuarantorInput {
  loanApplicationId: number;
  guarantorMemberId: number;
  guaranteeAmount: number;
}

export interface LoanGuarantorResponse {
  id: number;
  loanApplicationId: number;
  guarantorMemberId: number;
  guarantorName: string;
  guaranteeAmount: Decimal;
  status: GuarantorStatus;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
}

export type GuarantorStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'RELEASED';

/** A guarantee the member accepted, plus the loan it backs. Loan fields are null until the loan is disbursed. */
export interface GuaranteedLoanResponse extends LoanGuarantorResponse {
  applicationNumber: string;
  applicantName: string;
  productName: string;
  applicationStatus: string;
  loanNumber: string | null;
  principalAmount: Decimal | null;
  outstandingBalance: Decimal | null;
  loanStatus: LoanStatus | null;
}

export interface PendingGuarantorRequestResponse {
  id: number;
  status: GuarantorStatus;
  guaranteedAmount: Decimal;
  createdAt: Date;
  loanApplication: {
    id: number;
    amount: Decimal;
    purpose: string;
    member: { firstName: string; lastName: string; membershipId: string };
    loanProduct: { name: string };
  };
}

// ==========================================
// ACTIVE LOAN TYPES
// ==========================================

export interface LoanResponse {
  id: number;
  loanNumber: string;
  applicationId: number;
  memberId: number;
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  loanProductId: number;
  loanProductName: string;
  loanProduct: { id: number; name: string } | null;
  principalAmount: Decimal;
  interestRate: Decimal;
  interestType: InterestType;
  tenureMonths: number;
  monthlyRepayment: Decimal;
  totalRepayment: Decimal;
  totalInterest: Decimal;
  processingFee: Decimal;
  amountDisbursed: Decimal;
  totalPaid: Decimal;
  principalPaid: Decimal;
  interestPaid: Decimal;
  outstandingBalance: Decimal;
  nextPaymentDate: Date | null;
  nextPaymentAmount: Decimal | null;
  status: LoanStatus;
  disbursedAt: Date;
  maturityDate: Date;
  closedAt: Date | null;
  repaymentSchedule: LoanRepaymentScheduleItem[];
}

export type LoanStatus = 'ACTIVE' | 'OVERDUE' | 'DEFAULTED' | 'PAID_OFF' | 'WRITTEN_OFF';

// ==========================================
// LOAN REPAYMENT TYPES
// ==========================================

export interface LoanRepaymentInput {
  loanId: number;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface LoanRepaymentResponse {
  id: number;
  loanId: number;
  scheduleItemId: number | null;
  amount: Decimal;
  principalPortion: Decimal;
  interestPortion: Decimal;
  lateFee: Decimal;
  paymentMethod: string;
  reference: string | null;
  processedBy: number;
  processedByName: string;
  notes: string | null;
  paidAt: Date;
}

export interface LoanRepaymentScheduleItem {
  id: number;
  loanId: number;
  installmentNumber: number;
  dueDate: Date;
  principalDue: Decimal;
  interestDue: Decimal;
  totalDue: Decimal;
  principalPaid: Decimal;
  interestPaid: Decimal;
  totalPaid: Decimal;
  lateFee: Decimal;
  status: RepaymentStatus;
  paidAt: Date | null;
}

export type RepaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

// ==========================================
// DASHBOARD & STATISTICS TYPES
// ==========================================

export interface CooperativeDashboard {
  savingsSummary: {
    totalAccounts: number;
    activeAccounts: number;
    totalBalance: Decimal;
    totalDepositsThisMonth: Decimal;
    totalWithdrawalsThisMonth: Decimal;
    averageBalance: Decimal;
  };
  loansSummary: {
    totalActiveLoans: number;
    totalDisbursed: Decimal;
    totalOutstanding: Decimal;
    totalCollectedThisMonth: Decimal;
    overdueLoans: number;
    overdueAmount: Decimal;
    defaultRate: number;
  };
  pendingActions: {
    pendingLoanApplications: number;
    pendingGuarantorRequests: number;
    overdueRepayments: number;
  };
  recentActivity: {
    recentDeposits: SavingsTransactionResponse[];
    recentRepayments: LoanRepaymentResponse[];
    recentApplications: LoanApplicationResponse[];
  };
}

export interface MemberCooperativeProfile {
  memberId: number;
  memberName: string;
  savingsAccounts: SavingsAccountResponse[];
  totalSavings: Decimal;
  /** Part of totalSavings held against active loans (not withdrawable, not borrowable against). */
  lockedSavings: Decimal;
  /** totalSavings − lockedSavings: what the member can withdraw or borrow against. */
  availableSavings: Decimal;
  activeLoans: LoanResponse[];
  totalOutstandingLoans: Decimal;
  guarantorExposure: Decimal;
  guaranteedLoans: GuaranteedLoanResponse[];
  loanEligibility: {
    maxLoanAmount: Decimal;
    eligibleProducts: LoanProductResponse[];
    reasons: string[];
  };
  creditScore: number;
  memberSince: Date;
}

export type SavingsDepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SavingsDepositInput {
  savingsAccountId: number;
  amount: number;
  paymentDate: Date;
  bankAccountId?: number;
  reference?: string;
  memberNote?: string;
}

export interface SavingsDepositReceipt {
  filename: string;
  filepath: string;
  fileSize?: number;
  mimeType?: string;
}

export interface SavingsDepositResponse {
  id: number;
  savingsAccountId: number;
  accountNumber: string;
  memberId: number;
  memberName: string;
  memberNumber: string;
  amount: any;
  paymentDate: Date;
  bankAccountId: number | null;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: SavingsDepositStatus;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface LoanRepaymentRequestInput {
  loanId: number;
  amount: number;
  paymentDate: Date;
  bankAccountId?: number;
  reference?: string;
  memberNote?: string;
}

export interface LoanRepaymentRequestResponse {
  id: number;
  loanId: number;
  loanNumber: string;
  memberId: number;
  memberName: string;
  memberNumber: string;
  amount: any;
  paymentDate: Date;
  bankAccountId: number | null;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: SavingsDepositStatus;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}
