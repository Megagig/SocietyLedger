import type { IsoDateString, MoneyValue } from './common';

/**
 * The books (project-overview.md §6.9 AC1–AC6). Mirrors `apps/api/src/modules/accounting`. Money arrives as strings and is shown
 * through `Money`; amounts are sent as numbers with at most two decimal places.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export type ChartAccountDTO = {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  subType: string | null;
  description: string | null;
  parentId: number | null;
  isActive: boolean;
  isSystemAccount: boolean;
  normalBalance: NormalBalance;
  balance?: MoneyValue;
};

export type AccountPayload = {
  code: string;
  name: string;
  type: AccountType;
  subType?: string;
  description?: string;
  parentId?: number;
  normalBalance?: NormalBalance;
};
export type AccountUpdatePayload = { name?: string; subType?: string; description?: string; parentId?: number | null; isActive?: boolean };

export type JournalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'VOIDED';

export type JournalLineDTO = {
  id: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  debitAmount: MoneyValue;
  creditAmount: MoneyValue;
  description: string | null;
};

export type JournalEntryDTO = {
  id: number;
  entryNumber: string;
  entryDate: IsoDateString;
  description: string;
  reference: string | null;
  /** "manual" for a person's entry, "auto_sync:Payment" (and the like) for one the app made when money moved. */
  sourceType: string | null;
  sourceId: number | null;
  status: JournalStatus;
  totalDebit: MoneyValue;
  totalCredit: MoneyValue;
  createdBy: number;
  createdByEmail: string | null;
  approvedBy: number | null;
  approvedByEmail: string | null;
  approvedAt: IsoDateString | null;
  rejectionReason: string | null;
  rejectedAt: IsoDateString | null;
  postedAt: IsoDateString | null;
  createdAt: IsoDateString;
  lines: JournalLineDTO[];
};

export type Pagination = { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
export type JournalListDTO = { entries: JournalEntryDTO[]; pagination: Pagination };

export type JournalLinePayload = { accountId: number; debitAmount?: number; creditAmount?: number; description?: string };
export type JournalPayload = { entryDate: IsoDateString; description: string; reference?: string; lines: JournalLinePayload[] };

export type AccountBalanceDTO = { accountId: number; accountCode: string; accountName: string; balance: MoneyValue };

export type StatementPeriodDTO = { startDate: IsoDateString; endDate: IsoDateString; label: string };

export type IncomeStatementDTO = {
  period: StatementPeriodDTO;
  revenue: { total: MoneyValue; accounts: AccountBalanceDTO[] };
  expenses: { total: MoneyValue; accounts: AccountBalanceDTO[] };
  netIncome: MoneyValue;
  /** Present when asked for: the same figures for the stretch of the same length just before, and how they changed. */
  comparison?: {
    previousPeriod: { revenue: MoneyValue; expenses: MoneyValue; netIncome: MoneyValue };
    changes: { revenue: ChangeDTO; expenses: ChangeDTO; netIncome: ChangeDTO };
  };
};

export type ChangeDTO = { amount: MoneyValue; percentage: number };

export type BalanceSheetDTO = {
  asOfDate: IsoDateString;
  assets: { current: AccountBalanceDTO[]; fixed: AccountBalanceDTO[]; other: AccountBalanceDTO[]; totalCurrent: MoneyValue; totalFixed: MoneyValue; totalOther: MoneyValue; total: MoneyValue };
  liabilities: { current: AccountBalanceDTO[]; longTerm: AccountBalanceDTO[]; other?: AccountBalanceDTO[]; totalCurrent: MoneyValue; totalLongTerm: MoneyValue; totalOther?: MoneyValue; total: MoneyValue };
  equity: { accounts: AccountBalanceDTO[]; retainedEarnings: MoneyValue; total: MoneyValue };
  totalLiabilitiesAndEquity: MoneyValue;
  isBalanced: boolean;
};

export type CashFlowItemDTO = { description: string; amount: MoneyValue; accountId?: number };
export type CashFlowGroupDTO = { inflows: CashFlowItemDTO[]; outflows: CashFlowItemDTO[]; netCash: MoneyValue };
export type CashFlowDTO = {
  period: StatementPeriodDTO;
  operating: CashFlowGroupDTO;
  investing: CashFlowGroupDTO;
  financing: CashFlowGroupDTO;
  netCashChange: MoneyValue;
  beginningCash: MoneyValue;
  endingCash: MoneyValue;
  reconciles?: boolean;
};

export type StatementParams = { period: string; startDate?: string; endDate?: string; includeComparison?: 'true' };

export type BudgetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'CLOSED';

export type BudgetItemDTO = {
  id: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  monthlyAmount: MoneyValue;
  annualAmount: MoneyValue;
  notes: string | null;
};

export type BudgetDTO = {
  id: number;
  name: string;
  description: string | null;
  fiscalYear: number;
  startDate: IsoDateString;
  endDate: IsoDateString;
  status: BudgetStatus;
  totalBudget: MoneyValue;
  createdBy: number;
  items: BudgetItemDTO[];
};
export type BudgetListDTO = { budgets: BudgetDTO[]; pagination: Pagination };

export type BudgetPayload = {
  name: string;
  description?: string;
  fiscalYear: number;
  startDate: IsoDateString;
  endDate: IsoDateString;
  items: BudgetLinePayload[];
};
export type BudgetLinePayload = { accountId: number; annualAmount: number; notes?: string };
export type BudgetUpdatePayload = { name?: string; description?: string; items?: BudgetLinePayload[] };

export type VarianceStatus = 'under' | 'on_track' | 'over';
export type BudgetVarianceItemDTO = {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  budgetAmount: MoneyValue;
  actualAmount: MoneyValue;
  variance: MoneyValue;
  variancePercentage: number;
  status: VarianceStatus;
};
export type VarianceSummaryDTO = { totalBudget: MoneyValue; totalActual: MoneyValue; totalVariance: MoneyValue; variancePercentage: number };
export type BudgetVarianceDTO = {
  budget: BudgetDTO;
  period: { startDate: IsoDateString; endDate: IsoDateString };
  items: BudgetVarianceItemDTO[];
  summary: VarianceSummaryDTO;
  incomeSummary: VarianceSummaryDTO;
  expenseSummary: VarianceSummaryDTO;
};

export type AccountingDashboardDTO = {
  quickStats: { totalAssets: MoneyValue; totalLiabilities: MoneyValue; totalEquity: MoneyValue; netIncome: MoneyValue; cashBalance: MoneyValue };
  recentEntries: JournalEntryDTO[];
  pendingApprovals: number;
  budgetStatus?: { totalBudget: MoneyValue; totalSpent: MoneyValue; remainingBudget: MoneyValue; percentUsed: number };
  monthlyTrend: { month: string; income: MoneyValue; expenses: MoneyValue }[];
};

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';
export type AccountingPeriodDTO = {
  id: number;
  name: string;
  periodType: 'month' | 'quarter' | 'year';
  startDate: IsoDateString;
  endDate: IsoDateString;
  status: PeriodStatus;
  closedByEmail: string | null;
  closedAt: IsoDateString | null;
};
export type PeriodPayload = { name: string; periodType: 'month' | 'quarter' | 'year'; startDate: IsoDateString; endDate: IsoDateString };

export type SyncCountDTO = { total: number; synced: number; unsynced: number; syncRate: string };
/** How much of each kind of activity has reached the books. */
export type SyncStatusDTO = {
  finance: { transactions: SyncCountDTO; payments: SyncCountDTO };
  welfare: { contributions: SyncCountDTO; payouts: SyncCountDTO };
  cooperatives: { savingsTransactions: SyncCountDTO; loans: SyncCountDTO; loanRepayments: SyncCountDTO };
  overall: SyncCountDTO;
};
export type SyncKind = 'transactions' | 'payments' | 'welfare-contributions' | 'welfare-payouts' | 'savings-transactions' | 'loans' | 'loan-repayments';
export type SyncErrorDTO = { id: number; tableName: string | null; recordId: number | null; message: string; createdAt: IsoDateString };
