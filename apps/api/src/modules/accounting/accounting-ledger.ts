/**
 * The rules of an account ledger: what is counted, in what order, and how the running balance is worked out.
 *
 * Kept free of the database so the one rule that matters — opening + movement = closing, and closing equals the figure on the
 * statement that opened the ledger — can be tested on its own. Amounts are exact decimals, never floating point.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { AccountingRuleError, balanceOf, lagosDayEnd, lagosDayStart } from './accounting-rules';

/** Most accounts one ledger can cover (a statement section is far smaller). */
export const MAX_LEDGER_ACCOUNTS = 100;
/** Most lines one ledger will add up. Beyond this the person is asked for a narrower stretch rather than sent a half answer. */
export const MAX_LEDGER_LINES = 50000;

export type LedgerLineInput = {
  lineId: number;
  entryId: number;
  accountId: number;
  debit: Decimal;
  credit: Decimal;
  normal: 'DEBIT' | 'CREDIT';
};

export type LedgerLineWithBalance = LedgerLineInput & {
  /** What this line adds to the account's balance: positive in the direction the account normally grows. */
  effect: Decimal;
  /** The balance after this line. */
  balance: Decimal;
};

/** Each line with the balance after it, starting from the opening balance. Lines must already be in book order. */
export function withRunningBalance(opening: Decimal.Value, lines: readonly LedgerLineInput[]): LedgerLineWithBalance[] {
  let running = new Decimal(opening);
  return lines.map((line) => {
    const effect = balanceOf(line.normal, line.debit, line.credit);
    running = running.plus(effect);
    return { ...line, effect, balance: running };
  });
}

export type LedgerTotals = { debit: Decimal; credit: Decimal; net: Decimal; closing: Decimal };

/** What the lines add up to, and the closing balance: opening plus the net movement. */
export function ledgerTotals(opening: Decimal.Value, lines: readonly LedgerLineWithBalance[]): LedgerTotals {
  const debit = lines.reduce((sum, l) => sum.plus(l.debit), new Decimal(0));
  const credit = lines.reduce((sum, l) => sum.plus(l.credit), new Decimal(0));
  const net = lines.reduce((sum, l) => sum.plus(l.effect), new Decimal(0));
  return { debit, credit, net, closing: new Decimal(opening).plus(net) };
}

/** The account ids of "1,2,3" or a single id, whole numbers only, no repeats. */
export function parseAccountIds(single: unknown, many: unknown): number[] {
  const texts = [single, many].flatMap((v) => (typeof v === 'string' || typeof v === 'number' ? String(v).split(',') : []));
  const ids = [...new Set(texts.map((t) => t.trim()).filter((t) => t !== '').map(Number))];
  if (ids.length === 0) throw new AccountingRuleError('Choose an account to open.', 400, 'ACCOUNT_REQUIRED');
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new AccountingRuleError('That is not a valid account.', 400, 'INVALID_ACCOUNT');
  if (ids.length > MAX_LEDGER_ACCOUNTS) throw new AccountingRuleError(`A ledger can cover at most ${MAX_LEDGER_ACCOUNTS} accounts.`, 400, 'TOO_MANY_ACCOUNTS');
  return ids;
}

/**
 * A date for the ledger: a full moment (a statement's own period start or end) is used as it is; a plain day is cut in Lagos time —
 * the start of the day for `from`, the end of the day for `to` — like every other accounting date.
 */
export function parseLedgerDate(value: unknown, label: string, endOfDay: boolean): Date | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const text = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? (endOfDay ? lagosDayEnd(text) : lagosDayStart(text)) : new Date(text);
  if (Number.isNaN(date.getTime())) throw new AccountingRuleError(`${label} is not a date.`, 400, 'INVALID_DATE');
  return date;
}
