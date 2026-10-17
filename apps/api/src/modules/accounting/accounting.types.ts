import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// ACCOUNTING TYPES - Phase 9
// ============================================

// Account Types
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type JournalEntryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'VOIDED';
export type BudgetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'CLOSED';
export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';
export type PeriodType = 'month' | 'quarter' | 'year';

// Accounting Periods
export interface AccountingPeriodInput {
  name: string;
  periodType: PeriodType;
  startDate: Date | string;
  endDate: Date | string;
}

export interface AccountingPeriodResponse {
  id: number;
  name: string;
  periodType: PeriodType;
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
  closedBy: number | null;
  closedByEmail: string | null;
  closedAt: Date | null;
  createdAt: Date;
}

// Chart of Accounts
export interface ChartOfAccountInput {
  code: string;
  name: string;
  type: AccountType;
  subType?: string;
  description?: string;
  parentId?: number;
  normalBalance?: NormalBalance;
}

export interface ChartOfAccountResponse {
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
  balance?: Decimal;
  children?: ChartOfAccountResponse[];
}

// Journal Entry
export interface JournalEntryLineInput {
  accountId: number;
  debitAmount?: number;
  creditAmount?: number;
  description?: string;
}

export interface JournalEntryInput {
  entryDate: Date | string;
  description: string;
  reference?: string;
  lines: JournalEntryLineInput[];
}

export interface JournalEntryResponse {
  id: number;
  entryNumber: string;
  entryDate: Date;
  description: string;
  reference: string | null;
  sourceType: string | null;
  status: JournalEntryStatus;
  totalDebit: Decimal;
  totalCredit: Decimal;
  createdBy: number;
  approvedBy: number | null;
  approvedAt: Date | null;
  createdAt: Date;
  lines: JournalEntryLineResponse[];
}

export interface JournalEntryLineResponse {
  id: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  debitAmount: Decimal;
  creditAmount: Decimal;
  description: string | null;
}

// Financial Statements
export interface IncomeStatementReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  revenue: {
    total: Decimal;
    accounts: AccountBalance[];
  };
  expenses: {
    total: Decimal;
    accounts: AccountBalance[];
  };
  netIncome: Decimal;
  comparison?: {
    previousPeriod: {
      revenue: Decimal;
      expenses: Decimal;
      netIncome: Decimal;
    };
    changes: {
      revenue: { amount: Decimal; percentage: number };
      expenses: { amount: Decimal; percentage: number };
      netIncome: { amount: Decimal; percentage: number };
    };
  };
}

export interface BalanceSheetReport {
  asOfDate: Date;
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    other: AccountBalance[];
    totalCurrent: Decimal;
    totalFixed: Decimal;
    totalOther: Decimal;
    total: Decimal;
  };
  liabilities: {
    current: AccountBalance[];
    longTerm: AccountBalance[];
    totalCurrent: Decimal;
    totalLongTerm: Decimal;
    total: Decimal;
  };
  equity: {
    accounts: AccountBalance[];
    retainedEarnings: Decimal;
    total: Decimal;
  };
  totalLiabilitiesAndEquity: Decimal;
  isBalanced: boolean;
}

export interface CashFlowReport {
  period: {
    startDate: Date;
    endDate: Date;
    label: string;
  };
  operating: {
    inflows: CashFlowItem[];
    outflows: CashFlowItem[];
    netCash: Decimal;
  };
  investing: {
    inflows: CashFlowItem[];
    outflows: CashFlowItem[];
    netCash: Decimal;
  };
  financing: {
    inflows: CashFlowItem[];
    outflows: CashFlowItem[];
    netCash: Decimal;
  };
  netCashChange: Decimal;
  beginningCash: Decimal;
  endingCash: Decimal;
}

export interface AccountBalance {
  accountId: number;
  accountCode: string;
  accountName: string;
  balance: Decimal;
  subAccounts?: AccountBalance[];
}

export interface CashFlowItem {
  description: string;
  amount: Decimal;
  accountId?: number;
}

// Budget
export interface BudgetInput {
  name: string;
  description?: string;
  fiscalYear: number;
  startDate: Date | string;
  endDate: Date | string;
  items: BudgetItemInput[];
}

export interface BudgetItemInput {
  accountId: number;
  monthlyAmount?: number;
  q1Amount?: number;
  q2Amount?: number;
  q3Amount?: number;
  q4Amount?: number;
  annualAmount: number;
  notes?: string;
}

export interface BudgetResponse {
  id: number;
  name: string;
  description: string | null;
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
  status: BudgetStatus;
  totalBudget: Decimal;
  items: BudgetItemResponse[];
}

export interface BudgetItemResponse {
  id: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  monthlyAmount: Decimal;
  q1Amount: Decimal | null;
  q2Amount: Decimal | null;
  q3Amount: Decimal | null;
  q4Amount: Decimal | null;
  annualAmount: Decimal;
  actualAmount?: Decimal;
  variance?: Decimal;
  variancePercentage?: number;
  notes: string | null;
}

export interface BudgetVarianceReport {
  budget: BudgetResponse;
  period: {
    startDate: Date;
    endDate: Date;
  };
  items: BudgetVarianceItem[];
  summary: {
    totalBudget: Decimal;
    totalActual: Decimal;
    totalVariance: Decimal;
    variancePercentage: number;
  };
}

export interface BudgetVarianceItem {
  accountId: number;
  accountCode: string;
  accountName: string;
  budgetAmount: Decimal;
  actualAmount: Decimal;
  variance: Decimal;
  variancePercentage: number;
  status: 'under' | 'on_track' | 'over';
}

// Dashboard
export interface AccountingDashboard {
  quickStats: {
    totalAssets: Decimal;
    totalLiabilities: Decimal;
    totalEquity: Decimal;
    netIncome: Decimal;
    cashBalance: Decimal;
  };
  recentEntries: JournalEntryResponse[];
  pendingApprovals: number;
  budgetStatus?: {
    totalBudget: Decimal;
    totalSpent: Decimal;
    remainingBudget: Decimal;
    percentUsed: number;
  };
  monthlyTrend: {
    month: string;
    income: Decimal;
    expenses: Decimal;
  }[];
}

// Standard Chart of Accounts Template
export const STANDARD_CHART_OF_ACCOUNTS: ChartOfAccountInput[] = [
  // Assets (1000-1999)
  { code: '1000', name: 'Assets', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1100', name: 'Current Assets', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1111', name: 'Petty Cash', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1112', name: 'Bank Account - Operating', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1113', name: 'Bank Account - Savings', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1120', name: 'Accounts Receivable', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1121', name: 'Member Dues Receivable', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1122', name: 'Levy Receivable', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1130', name: 'Prepaid Expenses', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT' },
  { code: '1300', name: 'Loans Receivable', type: 'ASSET', subType: 'current_asset', normalBalance: 'DEBIT', description: 'Cooperative loans given to members' },
  { code: '1200', name: 'Fixed Assets', type: 'ASSET', subType: 'fixed_asset', normalBalance: 'DEBIT' },
  { code: '1210', name: 'Equipment', type: 'ASSET', subType: 'fixed_asset', normalBalance: 'DEBIT' },
  { code: '1220', name: 'Furniture and Fixtures', type: 'ASSET', subType: 'fixed_asset', normalBalance: 'DEBIT' },
  { code: '1230', name: 'Accumulated Depreciation', type: 'ASSET', subType: 'fixed_asset', normalBalance: 'CREDIT' },

  // Liabilities (2000-2999)
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },
  { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },
  { code: '2120', name: 'Accrued Expenses', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },
  { code: '2130', name: 'Deferred Revenue', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT' },
  { code: '2300', name: 'Welfare Fund Liability', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT', description: 'Welfare contributions held for members' },
  { code: '2400', name: 'Member Savings Liability', type: 'LIABILITY', subType: 'current_liability', normalBalance: 'CREDIT', description: 'Cooperative savings deposits from members' },
  { code: '2200', name: 'Long-term Liabilities', type: 'LIABILITY', subType: 'long_term_liability', normalBalance: 'CREDIT' },
  { code: '2210', name: 'Loans Payable', type: 'LIABILITY', subType: 'long_term_liability', normalBalance: 'CREDIT' },

  // Equity (3000-3999)
  { code: '3000', name: 'Equity', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3100', name: 'Opening Balance Equity', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3300', name: 'Current Year Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },

  // Income (4000-4999)
  { code: '4000', name: 'Income', type: 'INCOME', normalBalance: 'CREDIT' },
  { code: '4100', name: 'Membership Income', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT' },
  { code: '4110', name: 'Membership Dues', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT' },
  { code: '4120', name: 'Registration Fees', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT' },
  { code: '4200', name: 'Levy Income', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT' },
  { code: '4300', name: 'Donation Income', type: 'INCOME', subType: 'other_income', normalBalance: 'CREDIT' },
  { code: '4400', name: 'Penalty Income', type: 'INCOME', subType: 'other_income', normalBalance: 'CREDIT' },
  { code: '4500', name: 'Interest Income', type: 'INCOME', subType: 'other_income', normalBalance: 'CREDIT' },
  { code: '4600', name: 'Other Income', type: 'INCOME', subType: 'other_income', normalBalance: 'CREDIT' },
  { code: '4700', name: 'Welfare Interest Income', type: 'INCOME', subType: 'other_income', normalBalance: 'CREDIT', description: 'Interest earned on welfare fund investments' },
  { code: '4800', name: 'Loan Interest Income', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT', description: 'Interest income from cooperative loans' },
  { code: '4900', name: 'Fee Income', type: 'INCOME', subType: 'operating_income', normalBalance: 'CREDIT', description: 'Processing fees, late fees, and other charges' },

  // Expenses (5000-5999)
  { code: '5000', name: 'Expenses', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '5100', name: 'Administrative Expenses', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5110', name: 'Office Supplies', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5120', name: 'Printing and Stationery', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5130', name: 'Communication Expenses', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5200', name: 'Professional Fees', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5210', name: 'Legal Fees', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5220', name: 'Accounting Fees', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT' },
  { code: '5300', name: 'Event Expenses', type: 'EXPENSE', subType: 'program_expense', normalBalance: 'DEBIT' },
  { code: '5310', name: 'Meeting Expenses', type: 'EXPENSE', subType: 'program_expense', normalBalance: 'DEBIT' },
  { code: '5320', name: 'Venue Rental', type: 'EXPENSE', subType: 'program_expense', normalBalance: 'DEBIT' },
  { code: '5330', name: 'Catering', type: 'EXPENSE', subType: 'program_expense', normalBalance: 'DEBIT' },
  { code: '5400', name: 'Welfare Expenses', type: 'EXPENSE', subType: 'program_expense', normalBalance: 'DEBIT' },
  { code: '5500', name: 'Bank Charges', type: 'EXPENSE', subType: 'other_expense', normalBalance: 'DEBIT' },
  { code: '5600', name: 'Depreciation Expense', type: 'EXPENSE', subType: 'other_expense', normalBalance: 'DEBIT' },
  { code: '5700', name: 'Miscellaneous Expenses', type: 'EXPENSE', subType: 'other_expense', normalBalance: 'DEBIT' },
  { code: '5800', name: 'Savings Interest Expense', type: 'EXPENSE', subType: 'operating_expense', normalBalance: 'DEBIT', description: 'Interest paid on member savings deposits' },
];
