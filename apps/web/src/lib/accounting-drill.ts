import type { EntrySource } from '@/lib/api/accounting';

/**
 * Opening a figure in Accounting: the ledger of an account (or of a whole section) for the dates the figure was drawn for, the journal
 * entry a line belongs to, and the record behind an automatic entry. The same routes as on the phone, so an address means the same
 * thing on both.
 */

export type LedgerTarget = {
  accountId?: number;
  accountIds?: number[];
  /** "cash", or an account type: a whole section at once */
  scope?: string;
  title: string;
  from?: string;
  to?: string;
  /** Words for the dates the page opens with ("This month"). Without them the dates are shown as they are. */
  datesLabel?: string;
};

const BASE = '/dashboard/accounting';

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
  return `${BASE}/ledger?${query.join('&')}`;
}

/** The journal entries page opens the entry with this number on show. */
export const entryHref = (entryId: number): string => `${BASE}/journal-entries?entry=${entryId}`;

/** The calendar day in Lagos (UTC+1) of a moment, as "2026-10-24". */
export const lagosDay = (date: Date): string => new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

export const LEDGER_DATE_OPTIONS = [
  { value: 'opened', label: 'As opened' },
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
] as const;
export type LedgerDates = (typeof LEDGER_DATE_OPTIONS)[number]['value'];

/** The `from` and `to` of a ledger choice. "As opened" keeps what the page was opened with; plain days are cut in Lagos time by the server. */
export function ledgerRange(choice: LedgerDates, opened: { from?: string; to?: string }, now: Date = new Date()): { from?: string; to?: string } {
  const today = lagosDay(now);
  if (choice === 'opened') return { from: opened.from, to: opened.to };
  if (choice === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (choice === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return {};
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The whole of a month named like "Oct 2026", first moment to last in Lagos time, for opening a statement on it. */
export function monthRange(label: string): { startDate: string; endDate: string } | null {
  const [name, year] = label.trim().split(/\s+/);
  const month = MONTHS.indexOf((name ?? '').slice(0, 3).toLowerCase());
  const y = Number(year);
  if (month < 0 || !Number.isInteger(y)) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
  return { startDate: `${y}-${pad(month + 1)}-01T00:00:00.000+01:00`, endDate: `${y}-${pad(month + 1)}-${pad(lastDay)}T23:59:59.999+01:00` };
}

/** Where the page for a source record lives, or the nearest page that exists for it. Null when there is none to open. */
export function sourceHref(source: EntrySource): string | null {
  if (source.missing) return null;
  const ids = source.ids;
  switch (source.kind) {
    case 'charge':
      return `/dashboard/finance/transactions/${source.id}`;
    case 'payment':
      return `/dashboard/finance/payments/${source.id}`;
    case 'welfare_contribution':
      return ids.memberId ? `/dashboard/finance/member-ledger/${ids.memberId}` : null;
    case 'welfare_payout':
      return `/dashboard/welfare/requests/${source.id}`;
    case 'savings_transaction':
      return ids.savingsAccountId ? `/dashboard/cooperatives/savings/${ids.savingsAccountId}` : null;
    case 'loan':
      return `/dashboard/cooperatives/loans/${source.id}`;
    case 'loan_repayment':
      return ids.loanId ? `/dashboard/cooperatives/loans/${ids.loanId}` : null;
    case 'cash_lodgment':
      return `/dashboard/cash/lodgments/${source.id}`;
    case 'expense':
      return `${BASE}/expenses?expense=${source.id}`;
    case 'reversal':
      return ids.entryId ? entryHref(ids.entryId) : null;
    default:
      return null;
  }
}

export const SOURCE_OPEN_LABELS: Record<EntrySource['kind'], string> = {
  charge: 'Open the charge',
  payment: 'Open the payment',
  welfare_contribution: 'Open the member’s ledger',
  welfare_payout: 'Open the payout',
  savings_transaction: 'Open the savings account',
  loan: 'Open the loan',
  loan_repayment: 'Open the loan',
  cash_lodgment: 'Open the lodgment',
  expense: 'Open the expense and its receipt',
  reversal: 'Open the entry it reversed',
};

/** Money in full, two decimals: ₦10,000.00. Accepts the strings the server sends. */
export function formatNaira(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
}
