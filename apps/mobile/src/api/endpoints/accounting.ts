import { client } from '../client';
import { unwrap } from '../envelope';
import type { ExportResultDTO } from '@/types/api/reports';
import type {
  AccountPayload,
  AccountUpdatePayload,
  AccountingDashboardDTO,
  AccountingPeriodDTO,
  BalanceSheetDTO,
  BudgetDTO,
  BudgetListDTO,
  BudgetPayload,
  BudgetStatus,
  BudgetUpdatePayload,
  BudgetVarianceDTO,
  CashFlowDTO,
  ChartAccountDTO,
  IncomeStatementDTO,
  JournalEntryDTO,
  JournalListDTO,
  JournalPayload,
  JournalStatus,
  PeriodPayload,
  StatementParams,
  SyncErrorDTO,
  SyncKind,
  SyncStatusDTO,
} from '@/types/api/accounting';

/** The bulk routes that catch the books up with what happened elsewhere in the app. */
const SYNC_ROUTES: SyncKind[] = ['transactions', 'payments', 'welfare-contributions', 'welfare-payouts', 'savings-transactions', 'loans', 'loan-repayments'];

/**
 * The books for officers (the accounting module must be on the plan). Reading needs `ledger.view`; adding and sending entries
 * `ledger.create`; changing `ledger.edit`; approving, posting and the periods `payments.approve`. The server refuses an entry that does not
 * balance to the kobo (400 `UNBALANCED`), a date in a closed period (409 `PERIOD_CLOSED`), approving your own entry (403 `OWN_ENTRY`),
 * and posting without the right password (403 `REAUTH_FAILED`).
 */
export const accountingApi = {
  // ---- dashboard and sync
  /** GET /accounting/dashboard — figures so far this year, the last six months, the latest entries and what waits for approval. */
  async getDashboard(): Promise<AccountingDashboardDTO> {
    return unwrap<AccountingDashboardDTO>(client.get('/accounting/dashboard'));
  },

  async getSyncStatus(): Promise<SyncStatusDTO> {
    return unwrap<SyncStatusDTO>(client.get('/accounting/sync/status'));
  },

  /** GET /accounting/sync/errors — the latest things that could not be entered in the books, with a plain reason each. */
  async getSyncErrors(): Promise<SyncErrorDTO[]> {
    return unwrap<SyncErrorDTO[]>(client.get('/accounting/sync/errors'));
  },

  /** POST /accounting/sync/<kind>/bulk — enters what is missing, 100 at a time. With a kind it catches up that kind only, otherwise every kind. Returns how many were entered and how many failed. */
  async runSync(kind?: SyncKind): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    for (const route of kind ? [kind] : SYNC_ROUTES) {
      const result = await unwrap<{ synced?: number; failed?: number }>(client.post(`/accounting/sync/${route}/bulk`));
      synced += result.synced ?? 0;
      failed += result.failed ?? 0;
    }
    return { synced, failed };
  },

  // ---- chart of accounts
  async listAccounts(params: { includeBalances?: boolean; type?: string } = {}): Promise<ChartAccountDTO[]> {
    return unwrap<ChartAccountDTO[]>(client.get('/accounting/chart-of-accounts', { params: { includeBalances: params.includeBalances ? 'true' : undefined, type: params.type } }));
  },

  /** POST /accounting/chart-of-accounts/initialize — 409 ALREADY_INITIALIZED when there are accounts already. */
  async initializeChart(): Promise<ChartAccountDTO[]> {
    return unwrap<ChartAccountDTO[]>(client.post('/accounting/chart-of-accounts/initialize'));
  },

  async createAccount(payload: AccountPayload): Promise<ChartAccountDTO> {
    return unwrap<ChartAccountDTO>(client.post('/accounting/chart-of-accounts', payload));
  },

  async updateAccount(id: number, payload: AccountUpdatePayload): Promise<ChartAccountDTO> {
    return unwrap<ChartAccountDTO>(client.put(`/accounting/chart-of-accounts/${id}`, payload));
  },

  /** DELETE /accounting/chart-of-accounts/:id — an account that was used is switched off instead; one with sub-accounts or a budget line stays (409). */
  async deleteAccount(id: number): Promise<unknown> {
    return unwrap<unknown>(client.delete(`/accounting/chart-of-accounts/${id}`));
  },

  // ---- journal entries
  async listEntries(params: { page: number; limit: number; status?: JournalStatus; search?: string }): Promise<JournalListDTO> {
    return unwrap<JournalListDTO>(client.get('/accounting/journal-entries', { params }));
  },

  async getEntry(id: number): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.get(`/accounting/journal-entries/${id}`));
  },

  async createEntry(payload: JournalPayload): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.post('/accounting/journal-entries', payload));
  },

  /** PUT — a draft, or a rejected entry (which becomes a draft again). */
  async updateEntry(id: number, payload: Partial<JournalPayload>): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.put(`/accounting/journal-entries/${id}`, payload));
  },

  async submitEntry(id: number): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.post(`/accounting/journal-entries/${id}/submit`));
  },

  /** POST …/approval — rejecting needs a reason; nobody decides their own entry (403 OWN_ENTRY). */
  async decideEntry(id: number, payload: { action: 'approve' | 'reject'; reason?: string }): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.post(`/accounting/journal-entries/${id}/approval`, payload));
  },

  /** POST …/post — asks for the officer's password. 403 REAUTH_FAILED when it is wrong. */
  async postEntry(id: number, password: string): Promise<JournalEntryDTO> {
    return unwrap<JournalEntryDTO>(client.post(`/accounting/journal-entries/${id}/post`, { password }));
  },

  // ---- statements
  async getIncomeStatement(params: StatementParams): Promise<IncomeStatementDTO> {
    return unwrap<IncomeStatementDTO>(client.get('/accounting/income-statement', { params }));
  },

  /** GET /accounting/balance-sheet — everything posted up to the moment given. */
  async getBalanceSheet(asOfDate: string): Promise<BalanceSheetDTO> {
    return unwrap<BalanceSheetDTO>(client.get('/accounting/balance-sheet', { params: { asOfDate } }));
  },

  async getCashFlow(params: StatementParams): Promise<CashFlowDTO> {
    return unwrap<CashFlowDTO>(client.get('/accounting/cash-flow', { params }));
  },

  /** POST /exports/accounting-statement — the statement as a PDF (needs exports.financial and ledger.view). Download it with `reportsApi.downloadExport`. */
  async exportStatement(payload: { statement: 'income' | 'balance' | 'cash'; period?: string; startDate?: string; endDate?: string; asOfDate?: string }): Promise<ExportResultDTO> {
    return unwrap<ExportResultDTO>(client.post('/exports/accounting-statement', payload));
  },

  // ---- budgets
  async listBudgets(params: { page: number; limit: number; status?: BudgetStatus; fiscalYear?: number }): Promise<BudgetListDTO> {
    return unwrap<BudgetListDTO>(client.get('/accounting/budgets', { params }));
  },

  async getBudget(id: number): Promise<BudgetDTO> {
    return unwrap<BudgetDTO>(client.get(`/accounting/budgets/${id}`));
  },

  async createBudget(payload: BudgetPayload): Promise<BudgetDTO> {
    return unwrap<BudgetDTO>(client.post('/accounting/budgets', payload));
  },

  async updateBudget(id: number, payload: BudgetUpdatePayload): Promise<BudgetDTO> {
    return unwrap<BudgetDTO>(client.put(`/accounting/budgets/${id}`, payload));
  },

  /** POST …/approve — nobody approves their own budget (403 OWN_BUDGET). */
  async approveBudget(id: number): Promise<BudgetDTO> {
    return unwrap<BudgetDTO>(client.post(`/accounting/budgets/${id}/approve`));
  },

  async activateBudget(id: number): Promise<BudgetDTO> {
    return unwrap<BudgetDTO>(client.post(`/accounting/budgets/${id}/activate`));
  },

  async getVariance(id: number): Promise<BudgetVarianceDTO> {
    return unwrap<BudgetVarianceDTO>(client.get(`/accounting/budgets/${id}/variance`));
  },

  // ---- periods
  async listPeriods(): Promise<AccountingPeriodDTO[]> {
    return unwrap<AccountingPeriodDTO[]>(client.get('/accounting/periods'));
  },

  async createPeriod(payload: PeriodPayload): Promise<AccountingPeriodDTO> {
    return unwrap<AccountingPeriodDTO>(client.post('/accounting/periods', payload));
  },

  /** POST …/close — 409 ENTRIES_WAITING while entries in it are waiting to be approved or posted. */
  async closePeriod(id: number): Promise<AccountingPeriodDTO> {
    return unwrap<AccountingPeriodDTO>(client.post(`/accounting/periods/${id}/close`));
  },

  async reopenPeriod(id: number): Promise<AccountingPeriodDTO> {
    return unwrap<AccountingPeriodDTO>(client.post(`/accounting/periods/${id}/reopen`));
  },

  /** POST …/lock — for good: a locked period can never be reopened. */
  async lockPeriod(id: number): Promise<AccountingPeriodDTO> {
    return unwrap<AccountingPeriodDTO>(client.post(`/accounting/periods/${id}/lock`));
  },
};
