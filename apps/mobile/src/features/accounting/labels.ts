import { Decimal, formatMoney, toDecimal } from '@/lib/money';
import type { PermissionAlias } from '@/lib/permissions';
import type {
  AccountType,
  BalanceSheetDTO,
  ChangeDTO,
  BudgetStatus,
  CashFlowDTO,
  EntrySourceDTO,
  IncomeStatementDTO,
  JournalEntryDTO,
  JournalStatus,
  PeriodStatus,
  SyncKind,
  SyncStatusDTO,
  VarianceStatus,
} from '@/types/api/accounting';

export const ACCOUNTING_MODULE = 'accounting';

/** Reading the books (`ledger.view`). */
export const ACCOUNTING_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
/** Starting an entry, adding an account or a budget, sending an entry for approval (`ledger.create`). */
export const ACCOUNTING_CREATE_ACCESS: PermissionAlias = 'FINANCE_CREATE';
/** Changing an entry, an account or a budget (`ledger.edit`). */
export const ACCOUNTING_EDIT_ACCESS: PermissionAlias = 'FINANCE_EDIT';
/** Deleting an account (`ledger.reverse`). */
export const ACCOUNTING_DELETE_ACCESS: PermissionAlias = 'FINANCE_DELETE';
/** Approving, rejecting and posting entries, approving budgets, closing periods (`payments.approve`). */
export const ACCOUNTING_APPROVE_ACCESS: PermissionAlias = 'FINANCE_APPROVE';

// ---------------------------------------------------------------- accounts

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  EQUITY: 'Equity',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
};

export const ACCOUNT_TYPE_HINTS: Record<AccountType, string> = {
  ASSET: 'What the association owns: bank, cash, money owed to it',
  LIABILITY: 'What it owes: bills, held savings and funds',
  EQUITY: 'What is left for the members after the liabilities',
  INCOME: 'Money earned: dues, levies, donations',
  EXPENSE: 'Money spent: hall hire, printing, bank charges',
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPE_ORDER.map((value) => ({ label: ACCOUNT_TYPE_LABELS[value].replace(/s$/, ''), value }));

/** The groups an account can be put in, so the statements know where to show it (current or fixed assets, and so on). The same as the website. */
export const ACCOUNT_SUBTYPE_OPTIONS: Record<AccountType, { label: string; value: string }[]> = {
  ASSET: [{ label: 'Current asset', value: 'current_asset' }, { label: 'Fixed asset', value: 'fixed_asset' }, { label: 'Other asset', value: 'other_asset' }],
  LIABILITY: [{ label: 'Current liability', value: 'current_liability' }, { label: 'Long-term liability', value: 'long_term_liability' }],
  EQUITY: [{ label: 'Equity', value: 'equity' }],
  INCOME: [{ label: 'Operating income', value: 'operating_income' }, { label: 'Other income', value: 'other_income' }],
  EXPENSE: [{ label: 'Operating expense', value: 'operating_expense' }, { label: 'Program expense', value: 'program_expense' }, { label: 'Other expense', value: 'other_expense' }],
};

/** "" follows the kind of account: debit for assets and expenses, credit for the rest. */
export const NORMAL_BALANCE_OPTIONS = [
  { label: 'Follows the kind of account', value: '' },
  { label: 'Debit', value: 'DEBIT' },
  { label: 'Credit', value: 'CREDIT' },
];

// ---------------------------------------------------------------- journal entries

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  POSTED: 'Posted',
  VOIDED: 'Cancelled',
};

/** The key `StatusChip` knows the colour of. */
export const journalStatusKey = (status: JournalStatus): string => (status === 'VOIDED' ? 'cancelled' : status.toLowerCase());

export const JOURNAL_FILTER_OPTIONS: { label: string; value: JournalStatus | 'ALL' }[] = [
  { label: 'All entries', value: 'ALL' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Waiting for approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved, to post', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Posted', value: 'POSTED' },
];

/** An entry the app made when money moved, rather than one a person wrote. */
export const isAutomatic = (entry: Pick<JournalEntryDTO, 'sourceType'>): boolean => !!entry.sourceType && entry.sourceType !== 'manual';

const SOURCE_NAMES: Record<string, string> = {
  Transaction: 'a charge',
  Payment: 'a payment',
  WelfareContribution: 'a welfare contribution',
  WelfarePayoutRequest: 'a welfare payout',
  SavingsTransaction: 'a savings movement',
  Loan: 'a loan',
  LoanRepayment: 'a loan repayment',
  CashLodgment: 'a cash lodgment',
  CashReversal: 'a cancelled cash receipt',
};

/** "Made by the app for a payment" or "Written by a person". */
export function sourceLabel(entry: Pick<JournalEntryDTO, 'sourceType'>): string {
  if (!isAutomatic(entry)) return 'Written by an officer';
  const table = (entry.sourceType ?? '').replace(/^auto_sync:?/, '');
  return table ? `Made by the app for ${SOURCE_NAMES[table] ?? table}` : 'Made by the app';
}

/** A draft or a rejected entry can be changed. */
export const isEditable = (status: JournalStatus): boolean => status === 'DRAFT' || status === 'REJECTED';

export type LineDraft = { accountId: string; debit: string; credit: string; description: string };
export const emptyLine = (): LineDraft => ({ accountId: '', debit: '', credit: '', description: '' });

const amountOf = (text: string): Decimal => {
  const cleaned = text.replace(/,/g, '').trim();
  return /^\d+(\.\d+)?$/.test(cleaned) ? new Decimal(cleaned) : new Decimal(0);
};

/** What the lines add up to and whether they balance, to the kobo. Shown live while an entry is being written. */
export function totalsOf(lines: Pick<LineDraft, 'debit' | 'credit'>[]): { debit: Decimal; credit: Decimal; difference: Decimal; balanced: boolean } {
  const debit = lines.reduce((sum, l) => sum.plus(amountOf(l.debit)), new Decimal(0));
  const credit = lines.reduce((sum, l) => sum.plus(amountOf(l.credit)), new Decimal(0));
  return { debit, credit, difference: debit.minus(credit).abs(), balanced: debit.gt(0) && debit.equals(credit) };
}

/** The calendar day a date field holds, on the person's own clock ("2026-10-24"). A plain day is returned as it is. */
export function dayOf(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The moment an entry dated this day is saved at: midday UTC, which is early afternoon in Lagos, so it can never slip onto another day. */
export const entryDateIso = (day: string): string => `${day}T12:00:00.000Z`;

/**
 * What to send for an account's parent when it is saved: the new parent, null to take it out from under its current parent, or
 * nothing when it was not under one and still is not.
 */
export function parentChange(chosen: string, current: number | null): number | null | undefined {
  if (chosen) return Number(chosen);
  return current ? null : undefined;
}

// ---------------------------------------------------------------- statements

/** The last moment of a day in Lagos (UTC+1), for "as at" on the balance sheet. */
export function endOfLagosDay(day: string): string {
  return new Date(new Date(`${day}T23:59:59.999Z`).getTime() - 60 * 60 * 1000).toISOString();
}

export const AS_AT_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'Choose a date', value: 'choose' },
  { label: 'End of last month', value: 'last_month' },
  { label: 'End of last quarter', value: 'last_quarter' },
  { label: 'End of last year', value: 'last_year' },
] as const;
export type AsAt = (typeof AS_AT_OPTIONS)[number]['value'];

/** The moment a balance sheet is drawn up to. */
export function asAtMoment(choice: AsAt, now: Date = new Date()): string {
  if (choice === 'today' || choice === 'choose') return now.toISOString();
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const y = lagos.getUTCFullYear();
  const mo = lagos.getUTCMonth();
  const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  if (choice === 'last_month') return endOfLagosDay(lastDay(y, mo - 1));
  if (choice === 'last_quarter') return endOfLagosDay(lastDay(y, Math.floor(mo / 3) * 3 - 1));
  return endOfLagosDay(`${y - 1}-12-31`);
}

export const COMPARE_OPTIONS = [
  { label: 'No comparison', value: 'none' },
  { label: 'The period before', value: 'previous' },
] as const;
export type CompareChoice = (typeof COMPARE_OPTIONS)[number]['value'];

/** "+₦1,000.00 (50.0%)" or "-₦500.00 (10.0%)": how a figure changed since the period before. */
export function changeText(change: ChangeDTO): string {
  const amount = toDecimal(change.amount);
  const sign = amount.isNegative() ? '-' : amount.isZero() ? '' : '+';
  return `${sign}${formatMoney(amount.abs())} (${change.percentage.toFixed(1)}%)`;
}

/** Spending going down, or income going up, is good; the other way is not. */
export function changeTone(change: ChangeDTO, kind: 'good-when-up' | 'good-when-down'): 'success' | 'danger' | 'secondary' {
  const amount = toDecimal(change.amount);
  if (amount.isZero()) return 'secondary';
  return amount.isNegative() === (kind === 'good-when-down') ? 'success' : 'danger';
}

// ---------------------------------------------------------------- sync

/** Each kind of activity that is entered in the books, in the order the website lists them. */
export const SYNC_KINDS: { kind: SyncKind; group: string; label: string; count: (s: SyncStatusDTO) => SyncStatusDTO['overall'] }[] = [
  { kind: 'transactions', group: 'Finance', label: 'Charges', count: (s) => s.finance.transactions },
  { kind: 'payments', group: 'Finance', label: 'Payments', count: (s) => s.finance.payments },
  { kind: 'welfare-contributions', group: 'Welfare', label: 'Contributions', count: (s) => s.welfare.contributions },
  { kind: 'welfare-payouts', group: 'Welfare', label: 'Payouts', count: (s) => s.welfare.payouts },
  { kind: 'savings-transactions', group: 'Cooperatives', label: 'Savings', count: (s) => s.cooperatives.savingsTransactions },
  { kind: 'loans', group: 'Cooperatives', label: 'Loans paid out', count: (s) => s.cooperatives.loans },
  { kind: 'loan-repayments', group: 'Cooperatives', label: 'Loan repayments', count: (s) => s.cooperatives.loanRepayments },
];

const money = (value: Parameters<typeof formatMoney>[0]) => formatMoney(toDecimal(value));
const line = (label: string, value: Parameters<typeof formatMoney>[0]) => `${label}: ${money(value)}`;

/** The income statement as plain text for the share sheet. */
export function incomeStatementText(r: IncomeStatementDTO, association: string): string {
  return [
    `${association}`,
    `Income statement, ${r.period.label}`,
    '',
    'Income',
    ...r.revenue.accounts.map((a) => `  ${a.accountName}: ${money(a.balance)}`),
    line('Total income', r.revenue.total),
    '',
    'Expenses',
    ...r.expenses.accounts.map((a) => `  ${a.accountName}: ${money(a.balance)}`),
    line('Total expenses', r.expenses.total),
    '',
    line(toDecimal(r.netIncome).isNegative() ? 'Net loss' : 'Net surplus', r.netIncome),
  ].join('\n');
}

export function balanceSheetText(r: BalanceSheetDTO, association: string, asAt: string): string {
  const rows = (items: { accountName: string; balance: Parameters<typeof formatMoney>[0] }[]) => items.map((a) => `  ${a.accountName}: ${money(a.balance)}`);
  return [
    `${association}`,
    `Balance sheet as at ${asAt}`,
    '',
    'Assets',
    ...rows([...r.assets.current, ...r.assets.fixed, ...r.assets.other]),
    line('Total assets', r.assets.total),
    '',
    'Liabilities',
    ...rows([...r.liabilities.current, ...r.liabilities.longTerm, ...(r.liabilities.other ?? [])]),
    line('Total liabilities', r.liabilities.total),
    '',
    'Equity',
    ...rows(r.equity.accounts),
    `  Earnings so far: ${money(r.equity.retainedEarnings)}`,
    line('Total equity', r.equity.total),
    '',
    line('Liabilities and equity', r.totalLiabilitiesAndEquity),
  ].join('\n');
}

export function cashFlowText(r: CashFlowDTO, association: string): string {
  return [
    `${association}`,
    `Cash flow, ${r.period.label}`,
    '',
    line('Cash at the start', r.beginningCash),
    line('From running the association', r.operating.netCash),
    line('From buying or selling assets', r.investing.netCash),
    line('From loans and equity', r.financing.netCash),
    line('Change in cash', r.netCashChange),
    line('Cash at the end', r.endingCash),
  ].join('\n');
}

// ---------------------------------------------------------------- budgets

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

export const budgetStatusKey = (status: BudgetStatus): string => status.toLowerCase();

export const VARIANCE_LABELS: Record<VarianceStatus, string> = { under: 'Under budget', on_track: 'On track', over: 'Over budget' };

/** How much of the budget is used, 0 to 100 for the bar (the figure itself can be higher). */
export const usedPercent = (actual: string | number, budget: string | number): number => {
  const planned = toDecimal(budget);
  if (planned.isZero()) return toDecimal(actual).isZero() ? 0 : 100;
  return Math.max(0, Math.min(100, toDecimal(actual).dividedBy(planned).times(100).toNumber()));
};

// ---------------------------------------------------------------- periods

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = { OPEN: 'Open', CLOSED: 'Closed', LOCKED: 'Locked for good' };
export const periodStatusKey = (status: PeriodStatus): string => (status === 'OPEN' ? 'active' : status === 'CLOSED' ? 'closed' : 'archived');

// ---------------------------------------------------------------- opening a figure (the ledger and the source)

const ACCOUNTING_BASE = '/(app)/(tabs)/manage/accounting';

/** What a ledger is opened for: one account, several together, or a whole section, with the dates the figure was drawn for. */
export type LedgerTarget = {
  accountId?: number;
  accountIds?: number[];
  /** "cash", or an account type: a whole section at once */
  scope?: string;
  title: string;
  from?: string;
  to?: string;
  /** Words for the dates the screen opens with ("This month"). Without them the dates are shown as they are. */
  datesLabel?: string;
};

/** The route that opens a ledger. Everything is carried in the address, so going back returns to the same place. */
export function ledgerHref(target: LedgerTarget): string {
  const q: [string, string | undefined][] = [
    ['accountId', target.accountId !== undefined ? String(target.accountId) : undefined],
    ['accountIds', target.accountIds && target.accountIds.length > 0 ? target.accountIds.join(',') : undefined],
    ['scope', target.scope],
    ['title', target.title],
    ['from', target.from],
    ['to', target.to],
    ['datesLabel', target.datesLabel],
  ];
  const query = q.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return `${ACCOUNTING_BASE}/ledger?${query.join('&')}`;
}

export const entryHref = (entryId: number): string => `${ACCOUNTING_BASE}/journal/${entryId}`;

/** The dates a ledger can be narrowed to, besides the ones it was opened with. */
export const LEDGER_DATE_OPTIONS = [
  { label: 'As opened', value: 'opened' },
  { label: 'All time', value: 'all' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
] as const;
export type LedgerDates = (typeof LEDGER_DATE_OPTIONS)[number]['value'];

/** The calendar day in Lagos (UTC+1) of a moment, as "2026-10-24". */
export const lagosDay = (date: Date): string => new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

/** The `from` and `to` of a ledger choice. "As opened" keeps what the screen was opened with; plain days are cut in Lagos time by the server. */
export function ledgerRange(choice: LedgerDates, opened: { from?: string; to?: string }, now: Date = new Date()): { from?: string; to?: string } {
  const today = lagosDay(now);
  if (choice === 'opened') return { from: opened.from, to: opened.to };
  if (choice === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (choice === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return {};
}

/** "Debit" or "Credit" for a ledger line, whichever side it is on. */
export const lineSide = (line: { debit: string | number }): 'Debit' | 'Credit' => (Number(line.debit) > 0 ? 'Debit' : 'Credit');

/** Where the screen for a source record lives on the phone, or the nearest screen that exists for it. Null when there is none to open. */
export function sourceHref(source: EntrySourceDTO): string | null {
  if (source.missing) return null;
  const base = '/(app)/(tabs)/manage';
  const ids = source.ids;
  switch (source.kind) {
    case 'charge':
      return `${base}/finance/transactions/${source.id}`;
    case 'payment':
      return ids.transactionId ? `${base}/finance/transactions/${ids.transactionId}` : null;
    case 'welfare_contribution':
      return ids.memberId ? `${base}/finance/ledgers/${ids.memberId}` : null;
    case 'welfare_payout':
      return `${base}/welfare/payouts/${source.id}`;
    case 'savings_transaction':
      return ids.savingsAccountId ? `${base}/cooperatives/savings/${ids.savingsAccountId}` : null;
    case 'loan':
    case 'loan_repayment':
      return ids.loanId ? `${base}/cooperatives/loans/${ids.loanId}` : null;
    case 'cash_lodgment':
      return `${base}/cash/lodgments/${source.id}`;
    case 'expense':
      return `${base}/accounting/expenses/${source.id}`;
    case 'reversal':
      return ids.entryId ? entryHref(ids.entryId) : null;
    default:
      return null;
  }
}

/** What the Open button says for each source, so the person knows where it goes. */
export const SOURCE_OPEN_LABELS: Record<EntrySourceDTO['kind'], string> = {
  charge: 'Open the charge',
  payment: 'Open the charge it paid',
  welfare_contribution: 'Open the member’s ledger',
  welfare_payout: 'Open the payout',
  savings_transaction: 'Open the savings account',
  loan: 'Open the loan',
  loan_repayment: 'Open the loan',
  cash_lodgment: 'Open the lodgment',
  expense: 'Open the expense and its receipt',
  reversal: 'Open the entry it reversed',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The whole of a month named like "Oct 2026", from its first moment to its last in Lagos time, for opening a statement on it. */
export function monthRange(label: string): { startDate: string; endDate: string } | null {
  const [name, year] = label.trim().split(/\s+/);
  const month = MONTHS.indexOf((name ?? '').slice(0, 3).toLowerCase());
  const y = Number(year);
  if (month < 0 || !Number.isInteger(y)) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
  return { startDate: `${y}-${pad(month + 1)}-01T00:00:00.000+01:00`, endDate: `${y}-${pad(month + 1)}-${pad(lastDay)}T23:59:59.999+01:00` };
}
