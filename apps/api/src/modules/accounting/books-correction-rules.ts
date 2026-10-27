import { BANK_OPERATING_CODE, CASH_IN_HAND_CODE, chargeMapping } from './posting-rules';

/**
 * Working out what the books should hold for one member charge and its payments, and the single entry that fixes the difference.
 *
 *   target = what the posting rules say the books should show for this charge and its payments
 *   actual = what the books already show for them (every posted entry that came from them, including earlier corrections and reversals)
 *   fix    = target - actual, as one balanced journal entry
 *
 * Because the fix is the difference, running it again finds nothing left to fix: it can be run on every start without ever posting twice,
 * whatever mix of the old mistakes (donations posted as bank income plus a dues payment, a third copy from the cash route, a deleted
 * charge left behind) an association's books contain. Pure: no database, so it is tested directly.
 */

/** Net balance by account code: debit positive, credit negative. */
export type NetByAccount = Record<string, number>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function addTo(net: NetByAccount, code: string, amount: number): void {
  net[code] = round2((net[code] ?? 0) + amount);
}

export interface EntryLineLike {
  accountCode: string;
  debit: number;
  credit: number;
}

export function netOf(lines: EntryLineLike[]): NetByAccount {
  const net: NetByAccount = {};
  for (const line of lines) addTo(net, line.accountCode, line.debit - line.credit);
  return net;
}

/** The cash or bank account a payment was taken into: the one its existing entries debited most. A payment never posted goes to the bank. */
export function inflowCodeOf(paymentLines: EntryLineLike[]): string {
  const net = netOf(paymentLines);
  const bank = net[BANK_OPERATING_CODE] ?? 0;
  const cashInHand = net[CASH_IN_HAND_CODE] ?? 0;
  return cashInHand > bank ? CASH_IN_HAND_CODE : BANK_OPERATING_CODE;
}

export interface TargetInput {
  categoryType: string;
  amount: number;
  isVoided: boolean;
  /** Include the charge's own posting (receivable and income). */
  includeCharge: boolean;
  payments: Array<{ amountPaid: number; inflowCode: string; include: boolean }>;
}

/**
 * What the books should show: the charge is a debit to its receivable and a credit to its income; each payment is a debit to the cash or
 * bank account and a credit to the same receivable. A voided charge is no longer owed, but a payment made against it was real money.
 */
export function targetPosting(input: TargetInput): NetByAccount {
  const mapping = chargeMapping(input.categoryType);
  const net: NetByAccount = {};
  if (!mapping) return net;
  if (input.includeCharge && !input.isVoided) {
    addTo(net, mapping.debitCode, input.amount);
    addTo(net, mapping.creditCode, -input.amount);
  }
  for (const payment of input.payments) {
    if (!payment.include) continue;
    addTo(net, payment.inflowCode, payment.amountPaid);
    addTo(net, mapping.debitCode, -payment.amountPaid);
  }
  return net;
}

export interface CorrectionLine {
  accountCode: string;
  debit: number;
  credit: number;
}

/** The entry that turns `actual` into `target`. Empty when they already agree. Always balanced. */
export function correctionLines(target: NetByAccount, actual: NetByAccount): CorrectionLine[] {
  const codes = new Set([...Object.keys(target), ...Object.keys(actual)]);
  const lines: CorrectionLine[] = [];
  for (const accountCode of [...codes].sort()) {
    const diff = round2((target[accountCode] ?? 0) - (actual[accountCode] ?? 0));
    if (Math.abs(diff) < 0.005) continue;
    lines.push(diff > 0 ? { accountCode, debit: diff, credit: 0 } : { accountCode, debit: 0, credit: -diff });
  }
  const debits = round2(lines.reduce((sum, l) => sum + l.debit, 0));
  const credits = round2(lines.reduce((sum, l) => sum + l.credit, 0));
  if (Math.abs(debits - credits) >= 0.005) {
    // Both sides were balanced entries, so this cannot happen; refuse to post something lopsided rather than guess.
    throw new Error(`Correction does not balance (debits ${debits}, credits ${credits})`);
  }
  return lines;
}
