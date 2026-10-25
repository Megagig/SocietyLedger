import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================
// ACCOUNTING API CLIENT - Phase 9
// ============================================

export interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  subType: string | null;
  description: string | null;
  parentId: number | null;
  isActive: boolean;
  isSystemAccount: boolean;
  normalBalance: 'DEBIT' | 'CREDIT';
  balance?: number;
  children?: ChartOfAccount[];
}

export interface JournalEntryLine {
  id?: number;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
}

export interface JournalEntry {
  id: number;
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string | null;
  sourceType: string | null;
  sourceId?: number | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'VOIDED';
  totalDebit: number;
  totalCredit: number;
  createdBy: number;
  approvedBy: number | null;
  approvedAt: string | null;
  createdAt: string;
  lines: JournalEntryLine[];
  /** Only on a single entry: the record that made it, in plain facts (null for an entry a person wrote). */
  source?: EntrySource | null;
}

export type SourceKind =
  | 'charge'
  | 'payment'
  | 'welfare_contribution'
  | 'welfare_payout'
  | 'savings_transaction'
  | 'loan'
  | 'loan_repayment'
  | 'cash_lodgment'
  | 'expense'
  | 'reversal';

/** The record behind an automatic entry. `missing` is true when it can no longer be found. */
export interface EntrySource {
  kind: SourceKind;
  id: number;
  title: string;
  summary: string;
  member: string | null;
  amount: string | number | null;
  date: string | null;
  status: string | null;
  reference: string | null;
  missing: boolean;
  ids: { transactionId?: number; memberId?: number; savingsAccountId?: number; loanId?: number; fundId?: number; entryId?: number; expenseId?: number };
}

/** One posted line of an account's ledger, with the balance after it. */
export interface LedgerLine {
  lineId: number;
  entryId: number;
  entryNumber: string;
  entryDate: string | null;
  entryDescription: string;
  lineDescription: string | null;
  reference: string | null;
  sourceType: string | null;
  accountId: number;
  accountCode: string;
  accountName: string;
  debit: string | number;
  credit: string | number;
  effect: string | number;
  balance: string | number;
}

export interface Ledger {
  accounts: { id: number; code: string; name: string; type: ChartOfAccount['type']; normalBalance: 'DEBIT' | 'CREDIT'; parentId: number | null; isActive: boolean }[];
  range: { from: string | null; to: string | null };
  opening: string | number;
  totalDebit: string | number;
  totalCredit: string | number;
  movement: string | number;
  closing: string | number;
  subAccounts: { id: number; code: string; name: string; balance: string | number }[];
  lines: LedgerLine[];
  pagination: { page: number; limit: number; totalCount: number; totalPages: number; hasMore: boolean };
}

export interface Budget {
  id: number;
  name: string;
  description: string | null;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'CLOSED';
  totalBudget: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  id: number;
  accountId: number;
  accountCode: string;
  accountName: string;
  monthlyAmount: number;
  q1Amount: number | null;
  q2Amount: number | null;
  q3Amount: number | null;
  q4Amount: number | null;
  annualAmount: number;
  actualAmount?: number;
  variance?: number;
  variancePercentage?: number;
  notes: string | null;
}

export interface AccountingPeriod {
  id: number;
  name: string;
  periodType: 'month' | 'quarter' | 'year';
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closedBy: number | null;
  closedByEmail: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface AccountBalance {
  accountId: number;
  accountCode: string;
  accountName: string;
  balance: number;
  subAccounts?: AccountBalance[];
}

export interface IncomeStatement {
  period: { startDate: string; endDate: string; label: string };
  revenue: { total: number; accounts: AccountBalance[] };
  expenses: { total: number; accounts: AccountBalance[] };
  netIncome: number;
  comparison?: {
    previousPeriod: { revenue: number; expenses: number; netIncome: number };
    changes: {
      revenue: { amount: number; percentage: number };
      expenses: { amount: number; percentage: number };
      netIncome: { amount: number; percentage: number };
    };
  };
}

export interface BalanceSheet {
  asOfDate: string;
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    other: AccountBalance[];
    totalCurrent: number;
    totalFixed: number;
    totalOther: number;
    total: number;
  };
  liabilities: {
    current: AccountBalance[];
    longTerm: AccountBalance[];
    totalCurrent: number;
    totalLongTerm: number;
    total: number;
  };
  equity: {
    accounts: AccountBalance[];
    retainedEarnings: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface CashFlowItem {
  description: string;
  amount: number;
  accountId?: number;
  /** The journal entry the movement came from, so it can be opened. */
  entryId?: number;
}

export interface CashFlowStatement {
  period: { startDate: string; endDate: string; label: string };
  operating: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; netCash: number };
  investing: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; netCash: number };
  financing: { inflows: CashFlowItem[]; outflows: CashFlowItem[]; netCash: number };
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
  cashAccountIds?: number[];
}

export interface AccountingDashboard {
  quickStats: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    netIncome: number;
    cashBalance: number;
  };
  recentEntries: JournalEntry[];
  pendingApprovals: number;
  /** Expense vouchers waiting for an approver. */
  pendingExpenses?: number;
  budgetStatus?: {
    budgetId?: number;
    totalBudget: number;
    totalSpent: number;
    remainingBudget: number;
    percentUsed: number;
  };
  monthlyTrend: { month: string; income: number; expenses: number }[];
}

export const accountingApi = {
  // ==========================================
  // Chart of Accounts
  // ==========================================

  async initializeChartOfAccounts() {
    const response = await api.post(`${API_URL}/api/accounting/chart-of-accounts/initialize`);
    return response.data;
  },

  async getChartOfAccounts(params?: {
    type?: string;
    isActive?: boolean;
    includeBalances?: boolean;
    hierarchical?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/chart-of-accounts`, { params });
    return response.data;
  },

  async createAccount(data: {
    code: string;
    name: string;
    type: string;
    subType?: string;
    description?: string;
    parentId?: number;
    normalBalance?: string;
  }) {
    const response = await api.post(`${API_URL}/api/accounting/chart-of-accounts`, data);
    return response.data;
  },

  async updateAccount(id: number, data: {
    name?: string;
    subType?: string | null;
    description?: string | null;
    parentId?: number | null;
    isActive?: boolean;
  }) {
    const response = await api.put(`${API_URL}/api/accounting/chart-of-accounts/${id}`, data);
    return response.data;
  },

  async deleteAccount(id: number) {
    const response = await api.delete(`${API_URL}/api/accounting/chart-of-accounts/${id}`);
    return response.data;
  },

  // ==========================================
  // Journal Entries
  // ==========================================

  async getJournalEntries(params?: {
    page?: number;
    limit?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/journal-entries`, { params });
    return response.data;
  },

  async getJournalEntry(id: number) {
    const response = await api.get(`${API_URL}/api/accounting/journal-entries/${id}`);
    return response.data;
  },

  async createJournalEntry(data: {
    entryDate: string;
    description: string;
    reference?: string;
    lines: { accountId: number; debitAmount?: number; creditAmount?: number; description?: string }[];
  }) {
    const response = await api.post(`${API_URL}/api/accounting/journal-entries`, data);
    return response.data;
  },

  async updateJournalEntry(id: number, data: {
    entryDate?: string;
    description?: string;
    reference?: string | null;
    lines?: { accountId: number; debitAmount?: number; creditAmount?: number; description?: string }[];
  }) {
    const response = await api.put(`${API_URL}/api/accounting/journal-entries/${id}`, data);
    return response.data;
  },

  async submitForApproval(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/journal-entries/${id}/submit`);
    return response.data;
  },

  async processApproval(id: number, action: 'approve' | 'reject', reason?: string) {
    const response = await api.post(`${API_URL}/api/accounting/journal-entries/${id}/approval`, { action, reason });
    return response.data;
  },

  async postJournalEntry(id: number, password: string) {
    const response = await api.post(`${API_URL}/api/accounting/journal-entries/${id}/post`, { password });
    return response.data;
  },

  // ==========================================
  // Ledger: what makes up an account's balance
  // ==========================================

  async getLedger(params: {
    accountId?: number;
    accountIds?: string;
    scope?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/ledger`, { params });
    return response.data;
  },

  // ==========================================
  // Financial Statements
  // ==========================================

  async getIncomeStatement(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
    includeComparison?: boolean;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/income-statement`, { params });
    return response.data;
  },

  async getBalanceSheet(params?: { asOfDate?: string }) {
    const response = await api.get(`${API_URL}/api/accounting/balance-sheet`, { params });
    return response.data;
  },

  async getCashFlowStatement(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/cash-flow`, { params });
    return response.data;
  },

  // ==========================================
  // Budgets
  // ==========================================

  async getBudgets(params?: {
    page?: number;
    limit?: number;
    fiscalYear?: number;
    status?: string;
  }) {
    const response = await api.get(`${API_URL}/api/accounting/budgets`, { params });
    return response.data;
  },

  async getBudget(id: number) {
    const response = await api.get(`${API_URL}/api/accounting/budgets/${id}`);
    return response.data;
  },

  async createBudget(data: {
    name: string;
    description?: string;
    fiscalYear: number;
    startDate: string;
    endDate: string;
    items: { accountId: number; monthlyAmount?: number; annualAmount: number; notes?: string }[];
  }) {
    const response = await api.post(`${API_URL}/api/accounting/budgets`, data);
    return response.data;
  },

  async updateBudget(id: number, data: {
    name?: string;
    description?: string | null;
    items?: { accountId: number; monthlyAmount?: number; annualAmount: number; notes?: string }[];
  }) {
    const response = await api.put(`${API_URL}/api/accounting/budgets/${id}`, data);
    return response.data;
  },

  async approveBudget(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/budgets/${id}/approve`);
    return response.data;
  },

  async activateBudget(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/budgets/${id}/activate`);
    return response.data;
  },

  async getBudgetVariance(id: number, params?: { startDate?: string; endDate?: string }) {
    const response = await api.get(`${API_URL}/api/accounting/budgets/${id}/variance`, { params });
    return response.data;
  },

  // ==========================================
  // Accounting Periods
  // ==========================================

  async getPeriods() {
    const response = await api.get(`${API_URL}/api/accounting/periods`);
    return response.data;
  },

  async createPeriod(data: { name: string; periodType: 'month' | 'quarter' | 'year'; startDate: string; endDate: string }) {
    const response = await api.post(`${API_URL}/api/accounting/periods`, data);
    return response.data;
  },

  async closePeriod(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/periods/${id}/close`);
    return response.data;
  },

  async reopenPeriod(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/periods/${id}/reopen`);
    return response.data;
  },

  async lockPeriod(id: number) {
    const response = await api.post(`${API_URL}/api/accounting/periods/${id}/lock`);
    return response.data;
  },

  // ==========================================
  // Dashboard
  // ==========================================

  async getDashboard() {
    const response = await api.get(`${API_URL}/api/accounting/dashboard`);
    return response.data;
  },
};
