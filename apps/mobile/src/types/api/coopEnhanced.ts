/**
 * The cooperative enhancements' API shapes: officer-defined account types and loan categories, the member's dashboard / transactions /
 * cashbook / pending payments, payment requests (one transfer, one proof, one or more lines) and two-stage withdrawals.
 * Verified against apps/api/src/modules/cooperatives/cooperative-*.service.ts (2026-11-02). Money arrives as a string ("5000.00").
 */

export type CoopAccountClass = 'CONTRIBUTION' | 'SHARES' | 'SPECIAL';
export type CoopRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WithdrawalStatus = 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ContributionCellStatus = 'PAID' | 'PARTIAL' | 'DEFAULTED' | 'DUE' | 'NONE';

export type CoopAccountTypeDTO = {
  id: number;
  name: string;
  description: string | null;
  accountClass: CoopAccountClass;
  defaultMonthlyAmount: string | null;
  isWithdrawable: boolean;
  monthlyWithdrawalLimit: string | null;
  sortOrder: number;
  isActive: boolean;
  accountCount?: number;
};

export type CoopLoanCategoryDTO = {
  id: number;
  name: string;
  description: string | null;
  isGoods: boolean;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
};

export type CoopAccountTypePayload = {
  name: string;
  description?: string | null;
  accountClass?: CoopAccountClass;
  defaultMonthlyAmount?: number | null;
  monthlyWithdrawalLimit?: number | null;
  isActive?: boolean;
};

export type CoopLoanCategoryPayload = {
  name: string;
  description?: string | null;
  isGoods?: boolean;
  isActive?: boolean;
};

export type CoopLastEntryDTO = { amount: string; type: string; date: string };

export type CoopSavingsTileDTO = {
  accountTypeId: number;
  name: string;
  description: string | null;
  accountClass: CoopAccountClass;
  balance: string;
  lastEntry: CoopLastEntryDTO | null;
};

export type CoopLoanTileDTO = {
  loanCategoryId: number;
  name: string;
  description: string | null;
  isGoods: boolean;
  outstanding: string;
  totalCollected: string;
  activeLoans: number;
  lastEntry: CoopLastEntryDTO | null;
};

export type ContributionMonthDTO = { month: number; paid: string; status: ContributionCellStatus };

export type ContributionRowDTO = {
  accountTypeId: number;
  name: string;
  accountClass: CoopAccountClass;
  expected: string | null;
  months: ContributionMonthDTO[];
};

export type CoopDashboardDTO = {
  year: number;
  memberName: string;
  monthlyContribution: string;
  savingsTiles: CoopSavingsTileDTO[];
  loanTiles: CoopLoanTileDTO[];
  outstandingLoans: string;
  contributionTable: { year: number; rows: ContributionRowDTO[]; total: ContributionMonthDTO[] };
  charts: {
    savingsByMonth: Record<CoopAccountClass, string[]>;
    loansByMonth: { disbursed: string[]; repaid: string[] };
  };
};

export type CoopTransactionRowDTO = {
  id: number;
  date: string;
  typeName: string;
  accountClass: CoopAccountClass;
  memberName: string;
  amount: string;
};

export type CoopTransactionsDTO = {
  overview: { contributions: string; shares: string; loansDisbursed: string; outstandingLoans: string; loanRepayments: string };
  loans: {
    totalLoans: string;
    totalRepaid: string;
    outstandingBalance: string;
    rows: { id: number; date: string; category: string; title: string; amount: string; repaid: string; balance: string }[];
  };
  contributions: { total: string; rows: CoopTransactionRowDTO[] };
  shares: { total: string; rows: CoopTransactionRowDTO[] };
  period: { from: string | null; to: string | null };
};

export type CashbookSideDTO = { desc: string; dr: string | null; cr: string | null; balance: string };

export type CashbookRowDTO = {
  date: string;
  narration: string;
  shares: string | null;
  savings: CashbookSideDTO | null;
  loans: CashbookSideDTO | null;
  interest: { dr: string | null; cr: string | null; balance: string } | null;
};

export type CashbookDTO = {
  member: { name: string; memberNumber: string } | null;
  period: { from: string | null; to: string | null };
  tiles: { totalShares: string; totalSavings: string; totalLoans: string; totalLoanInterest: string };
  rows: CashbookRowDTO[];
  totals: { shares: string; savingsDr: string; savingsCr: string; loansDr: string; loansCr: string; interestDr: string; interestCr: string };
};

export type PendingPaymentItemDTO = {
  kind: 'SAVINGS' | 'LOAN_REPAYMENT';
  id: number;
  date: string;
  paymentType: string;
  detail: string;
  amount: string;
  reference: string | null;
  status: CoopRequestStatus;
  rejectionReason: string | null;
  hasReceipt: boolean;
};

export type PendingPaymentsDTO = { items: PendingPaymentItemDTO[]; count: number; pendingCount: number };

export type CoopBankAccountDTO = {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  description: string | null;
  isDefault: boolean;
};

export type PaymentLineDTO = {
  id: number;
  accountTypeId: number;
  accountTypeName: string;
  accountClass: CoopAccountClass;
  savingsAccountId: number | null;
  accountNumber: string | null;
  amount: string;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
};

export type PaymentRequestDTO = {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  totalAmount: string;
  paymentDate: string;
  bankAccountId: number | null;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: CoopRequestStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  lines: PaymentLineDTO[];
};

export type CoopPagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };

export type PaymentRequestsDTO = { requests: PaymentRequestDTO[]; pagination: CoopPagination };

export type SubmitPaymentLine = { accountTypeId: number; amount: number; periodMonth: number; periodYear: number };

export type SubmitPaymentPayload = {
  lines: SubmitPaymentLine[];
  paymentDate: string;
  bankAccountId?: number;
  reference?: string;
  memberNote?: string;
  file: { uri: string; name: string; type: string };
};

export type WithdrawalAccountDTO = {
  savingsAccountId: number;
  accountNumber: string;
  accountTypeName: string;
  balance: string;
  monthlyLimit: string | null;
  remainingThisMonth: string | null;
  hasPending: boolean;
};

export type WithdrawalSummaryDTO = {
  accounts: WithdrawalAccountDTO[];
  totalBalance: string;
  totalWithdrawals: string;
  monthlyLimit: string | null;
  lastWithdrawal: { amount: string; at: string | null } | null;
};

export type WithdrawalDTO = {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  savingsAccountId: number;
  accountNumber: string;
  accountTypeName: string;
  amount: string;
  reason: string | null;
  status: WithdrawalStatus;
  twoStage: boolean;
  reviewedBy: number | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  approvedBy: number | null;
  approvedAt: string | null;
  approvalComment: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  payoutMethod: string | null;
  payoutReference: string | null;
  createdAt: string;
};

export type WithdrawalsDTO = { requests: WithdrawalDTO[]; pagination: CoopPagination };

export type WithdrawalReviewPayload = { decision: 'FORWARD'; comment?: string } | { decision: 'REJECT'; reason: string };

export type WithdrawalApprovePayload = { payoutMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'OTHER'; payoutReference?: string; comment?: string };

export type CoopSettingsDTO = { requireTwoStageWithdrawal: boolean };
