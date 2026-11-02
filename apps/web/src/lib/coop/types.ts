/**
 * The cooperative API's shapes as the web uses them. The server sends money as strings ("5000.00") and dates as ISO strings; they are
 * shown through `formatNairaFull` and never added up here, so no figure is ever a float the screen computed.
 */

export type Money = string;

export type AccountClass = 'CONTRIBUTION' | 'SHARES' | 'SPECIAL';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WithdrawalStatus = 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type CellStatus = 'PAID' | 'PARTIAL' | 'DEFAULTED' | 'DUE' | 'NONE';

export interface AccountType {
  id: number;
  name: string;
  description: string | null;
  accountClass: AccountClass;
  defaultMonthlyAmount: Money | null;
  isWithdrawable: boolean;
  monthlyWithdrawalLimit: Money | null;
  sortOrder: number;
  isActive: boolean;
  accountCount?: number;
}

/** What the API takes when an officer creates or edits an account type (numbers, not the money strings it sends back). */
export interface AccountTypeInput {
  name?: string;
  description?: string | null;
  accountClass?: AccountClass;
  defaultMonthlyAmount?: number | null;
  monthlyWithdrawalLimit?: number | null;
  isActive?: boolean;
}

export interface LoanCategoryInput {
  name?: string;
  description?: string | null;
  isGoods?: boolean;
  isActive?: boolean;
}

export interface LoanCategory {
  id: number;
  name: string;
  description: string | null;
  isGoods: boolean;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}

export interface LastEntry {
  amount: Money;
  type: string;
  date: string;
}

export interface SavingsTile {
  accountTypeId: number;
  name: string;
  description: string | null;
  accountClass: AccountClass;
  balance: Money;
  lastEntry: LastEntry | null;
}

export interface LoanTile {
  loanCategoryId: number;
  name: string;
  description: string | null;
  isGoods: boolean;
  outstanding: Money;
  totalCollected: Money;
  activeLoans: number;
  lastEntry: LastEntry | null;
}

export interface ContributionMonth {
  month: number;
  paid: Money;
  status: CellStatus;
}

export interface ContributionRow {
  accountTypeId: number;
  name: string;
  accountClass: AccountClass;
  expected: Money | null;
  months: ContributionMonth[];
}

export interface CoopDashboard {
  year: number;
  memberName: string;
  monthlyContribution: Money;
  savingsTiles: SavingsTile[];
  loanTiles: LoanTile[];
  outstandingLoans: Money;
  contributionTable: { year: number; rows: ContributionRow[]; total: ContributionMonth[] };
  charts: {
    savingsByMonth: Record<AccountClass, Money[]>;
    loansByMonth: { disbursed: Money[]; repaid: Money[] };
  };
}

export interface TransactionRow {
  id: number;
  date: string;
  typeName: string;
  accountClass: AccountClass;
  memberName: string;
  amount: Money;
}

export interface CoopTransactions {
  overview: { contributions: Money; shares: Money; loansDisbursed: Money; outstandingLoans: Money; loanRepayments: Money };
  loans: {
    totalLoans: Money;
    totalRepaid: Money;
    outstandingBalance: Money;
    rows: Array<{ id: number; date: string; category: string; title: string; amount: Money; repaid: Money; balance: Money }>;
  };
  contributions: { total: Money; rows: TransactionRow[] };
  shares: { total: Money; rows: TransactionRow[] };
  period: { from: string | null; to: string | null };
}

export interface CashbookSide {
  desc: string;
  dr: Money | null;
  cr: Money | null;
  balance: Money;
}

export interface CashbookRow {
  date: string;
  narration: string;
  shares: Money | null;
  savings: CashbookSide | null;
  loans: CashbookSide | null;
  interest: { dr: Money | null; cr: Money | null; balance: Money } | null;
}

export interface Cashbook {
  member: { name: string; memberNumber: string } | null;
  period: { from: string | null; to: string | null };
  tiles: { totalShares: Money; totalSavings: Money; totalLoans: Money; totalLoanInterest: Money };
  rows: CashbookRow[];
  totals: {
    shares: Money;
    savingsDr: Money;
    savingsCr: Money;
    loansDr: Money;
    loansCr: Money;
    interestDr: Money;
    interestCr: Money;
  };
}

export interface PendingPaymentItem {
  kind: 'SAVINGS' | 'LOAN_REPAYMENT';
  id: number;
  date: string;
  paymentType: string;
  detail: string;
  amount: Money;
  reference: string | null;
  status: RequestStatus;
  rejectionReason: string | null;
  hasReceipt: boolean;
}

export interface PendingPayments {
  items: PendingPaymentItem[];
  count: number;
  pendingCount: number;
}

export interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  description: string | null;
  isDefault: boolean;
}

export interface PaymentLine {
  id: number;
  accountTypeId: number;
  accountTypeName: string;
  accountClass: AccountClass;
  savingsAccountId: number | null;
  accountNumber: string | null;
  amount: Money;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
}

export interface PaymentRequest {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  totalAmount: Money;
  paymentDate: string;
  bankAccountId: number | null;
  reference: string | null;
  memberNote: string | null;
  filename: string;
  hasReceipt: boolean;
  status: RequestStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  lines: PaymentLine[];
}

export interface PaymentLineInput {
  accountTypeId: number;
  amount: number;
  periodMonth: number;
  periodYear: number;
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

export interface WithdrawalAccount {
  savingsAccountId: number;
  accountNumber: string;
  accountTypeName: string;
  balance: Money;
  monthlyLimit: Money | null;
  remainingThisMonth: Money | null;
  hasPending: boolean;
}

export interface WithdrawalSummary {
  accounts: WithdrawalAccount[];
  totalBalance: Money;
  totalWithdrawals: Money;
  monthlyLimit: Money | null;
  lastWithdrawal: { amount: Money; at: string | null } | null;
}

export interface Withdrawal {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  savingsAccountId: number;
  accountNumber: string;
  accountTypeName: string;
  amount: Money;
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
}

export interface CoopSettings {
  requireTwoStageWithdrawal: boolean;
}
