/**
 * The rules of the books: what makes a journal entry valid, which periods are shut, how money is added up.
 *
 * Kept free of the database so each rule can be tested on its own. Amounts are worked out as exact decimals in naira and kobo,
 * never as floating point: a difference of one kobo is a difference, not rounding.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../finance/rule-error';

export class AccountingRuleError extends RuleError {}

/** Largest single entry. Far beyond any association's books, but it keeps a typo like an extra six zeros from being accepted. */
export const MAX_ENTRY_TOTAL = new Decimal('100000000000');

export type RawLine = { accountId: number; debitAmount?: number; creditAmount?: number; description?: string };
export type CleanLine = { accountId: number; debit: Decimal; credit: Decimal; description: string | null };

/** The amount as an exact decimal, or null when it has more than two decimal places or is not a finite number. */
export function toMoney(value: number | string | Decimal | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === '') return new Decimal(0);
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value.toString();
  if (!/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(text)) return null;
  const amount = new Decimal(text);
  return amount.decimalPlaces() > 2 ? null : amount;
}

/**
 * Checks the lines of an entry and returns them as exact amounts.
 *
 * Every line is a debit or a credit (not both, not neither), in whole kobo; there is at least one of each; and the debits add up to
 * exactly the credits. The old check allowed a difference under one kobo and added floating point numbers.
 */
export function cleanEntryLines(lines: readonly RawLine[]): { lines: CleanLine[]; total: Decimal } {
  if (lines.length < 2) throw new AccountingRuleError('An entry needs at least two lines.', 400, 'TOO_FEW_LINES');

  const clean: CleanLine[] = lines.map((line, i) => {
    const debit = toMoney(line.debitAmount);
    const credit = toMoney(line.creditAmount);
    if (!debit || !credit) throw new AccountingRuleError(`Line ${i + 1}: amounts can have at most 2 decimal places.`, 400, 'INVALID_AMOUNT');
    if (debit.isNegative() || credit.isNegative()) throw new AccountingRuleError(`Line ${i + 1}: an amount cannot be negative.`, 400, 'INVALID_AMOUNT');
    if (debit.gt(0) === credit.gt(0)) throw new AccountingRuleError(`Line ${i + 1}: use either a debit or a credit, not both and not neither.`, 400, 'INVALID_LINE');
    return { accountId: line.accountId, debit, credit, description: line.description?.trim() ? line.description.trim() : null };
  });

  const debits = clean.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
  const credits = clean.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));
  if (!clean.some((l) => l.debit.gt(0)) || !clean.some((l) => l.credit.gt(0))) {
    throw new AccountingRuleError('An entry needs at least one debit and one credit.', 400, 'UNBALANCED');
  }
  if (!debits.equals(credits)) {
    throw new AccountingRuleError(`Debits (${debits.toFixed(2)}) must equal credits (${credits.toFixed(2)}). The difference is ${debits.minus(credits).abs().toFixed(2)}.`, 400, 'UNBALANCED');
  }
  if (debits.gt(MAX_ENTRY_TOTAL)) throw new AccountingRuleError('That total is too large for one entry.', 400, 'INVALID_AMOUNT');
  return { lines: clean, total: debits };
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

/** Assets and expenses grow with debits; liabilities, equity and income grow with credits. */
export const defaultNormalBalance = (type: AccountType): 'DEBIT' | 'CREDIT' => (type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT');

/** The balance of an account from its debit and credit totals, positive in the direction the account normally grows. */
export function balanceOf(normal: 'DEBIT' | 'CREDIT', debit: Decimal.Value, credit: Decimal.Value): Decimal {
  return normal === 'DEBIT' ? new Decimal(debit).minus(credit) : new Decimal(credit).minus(debit);
}

// ---------------------------------------------------------------- time

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** The calendar day in Lagos (UTC+1) a moment falls on, as "2026-10-24". */
export const lagosDayKey = (date: Date): string => new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);

/** The first moment of that Lagos day. */
export const lagosDayStart = (key: string): Date => new Date(new Date(`${key}T00:00:00.000Z`).getTime() - LAGOS_OFFSET_MS);

/** The last moment of that Lagos day. */
export const lagosDayEnd = (key: string): Date => new Date(new Date(`${key}T23:59:59.999Z`).getTime() - LAGOS_OFFSET_MS);

/** Whether a period covers a date, judged by the Lagos day on both sides so a period that ends "on the 31st" includes all of the 31st. */
export function periodCovers(period: { startDate: Date; endDate: Date }, date: Date): boolean {
  const day = lagosDayKey(date);
  return lagosDayKey(period.startDate) <= day && day <= lagosDayKey(period.endDate);
}

/** Whether two periods share any day. */
export function periodsOverlap(a: { startDate: Date; endDate: Date }, b: { startDate: Date; endDate: Date }): boolean {
  return lagosDayKey(a.startDate) <= lagosDayKey(b.endDate) && lagosDayKey(b.startDate) <= lagosDayKey(a.endDate);
}

// ---------------------------------------------------------------- cash flow

type CashFlowAccount = { type: string; subType: string | null };
export type CashFlowGroup = 'operating' | 'investing' | 'financing';

/**
 * Which part of the cash flow statement a cash movement belongs to, from the accounts on the other side of the entry.
 * Buying or selling fixed assets is investing; loans and equity are financing; anything else is day-to-day operating.
 */
export function cashFlowGroup(others: readonly CashFlowAccount[]): CashFlowGroup {
  if (others.some((a) => a.type === 'ASSET' && a.subType === 'fixed_asset')) return 'investing';
  if (others.some((a) => (a.type === 'LIABILITY' && a.subType === 'long_term_liability') || a.type === 'EQUITY')) return 'financing';
  return 'operating';
}

// ---------------------------------------------------------------- budgets

export type VarianceStatus = 'under' | 'on_track' | 'over';

/** How far actual is from the budget: "over" is more than 10% above it, "under" more than 10% below it, otherwise on track. */
export function varianceStatus(budget: Decimal.Value, actual: Decimal.Value): VarianceStatus {
  const planned = new Decimal(budget);
  if (planned.isZero()) return new Decimal(actual).isZero() ? 'on_track' : 'over';
  const used = new Decimal(actual).minus(planned).dividedBy(planned).times(100);
  if (used.gt(10)) return 'over';
  if (used.lt(-10)) return 'under';
  return 'on_track';
}

/** The budget share that belongs to a narrower stretch of the budget year, by days. The full year (or longer) is the whole amount. */
export function proratedBudget(annual: Decimal.Value, budgetStart: Date, budgetEnd: Date, from: Date, to: Date): Decimal {
  const day = 24 * 60 * 60 * 1000;
  const budgetDays = Math.max(1, Math.round((lagosDayStart(lagosDayKey(budgetEnd)).getTime() - lagosDayStart(lagosDayKey(budgetStart)).getTime()) / day) + 1);
  const lo = Math.max(lagosDayStart(lagosDayKey(from)).getTime(), lagosDayStart(lagosDayKey(budgetStart)).getTime());
  const hi = Math.min(lagosDayStart(lagosDayKey(to)).getTime(), lagosDayStart(lagosDayKey(budgetEnd)).getTime());
  if (hi < lo) return new Decimal(0);
  const days = Math.min(budgetDays, Math.round((hi - lo) / day) + 1);
  return days >= budgetDays ? new Decimal(annual) : new Decimal(annual).times(days).dividedBy(budgetDays).toDecimalPlaces(2);
}
