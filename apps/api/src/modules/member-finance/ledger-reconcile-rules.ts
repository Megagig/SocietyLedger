/**
 * What a member's ledger should hold for their charges and payments, and what has to change to get there.
 *
 *   a charge   (dues, levy, penalty, donation or pledge)  ->  one DEBIT   (source "transaction")
 *   a payment  (of any of them)                           ->  one CREDIT  (source "payment")
 *
 * So an instant donation is a debit and a credit of the same amount and nets to nothing, an unpaid pledge shows as owed, and a payment
 * made online lands on the ledger like any other. Only entries that come from charges and payments are touched here: waivers, savings,
 * loans, welfare and manual adjustments are never looked at, and a cash receipt that was voided (its payment row is gone, a "payment_void"
 * entry offsets the credit) is left exactly as it is.
 *
 * Pure: no database, so it is tested directly.
 */

export type LedgerCategoryName = 'DUES' | 'LEVY' | 'PENALTY' | 'DONATION' | 'OTHER';

const CATEGORY_BY_TYPE: Record<string, LedgerCategoryName> = {
  due: 'DUES',
  levy: 'LEVY',
  penalty: 'PENALTY',
  donation: 'DONATION',
};

export function ledgerCategoryFor(categoryType: string | null | undefined): LedgerCategoryName {
  return (categoryType && CATEGORY_BY_TYPE[categoryType]) || 'OTHER';
}

/**
 * The wording on the ledger line. A donation given on the spot reads "Donation: <cause>" and its payment "Donation received: <cause>"
 * (the two cancel out). A pledge, which has a pledge date, reads "Donation pledge: <cause>" and its payments "Pledge payment: <cause>",
 * so an unpaid pledge is plainly a promise and not a donation the member is owed for.
 */
export function chargeDescription(categoryType: string, categoryName: string, notes?: string | null, isPledge = false): string {
  if (categoryType === 'donation') return isPledge ? `Donation pledge: ${categoryName}` : `Donation: ${categoryName}`;
  return `${categoryName}${notes ? ` - ${notes}` : ''}`;
}

export function paymentDescription(categoryType: string, categoryName: string, isPledge = false): string {
  if (categoryType === 'donation') return isPledge ? `Pledge payment: ${categoryName}` : `Donation received: ${categoryName}`;
  return `Payment for ${categoryName}`;
}

type Num = number | string | { toString(): string };

export interface ReconcileTransaction {
  id: number;
  amount: Num;
  isVoided: boolean;
  createdAt: Date;
  /** A donation with a due date is a pledge; one given on the spot has none. */
  dueDate?: Date | null;
  notes?: string | null;
  referenceNumber?: string | null;
  category: { type: string; name: string };
  payments: Array<{ id: number; amountPaid: Num; paymentDate: Date; receiptNumber?: string | null }>;
}

export interface ExistingLedgerEntry {
  id: number;
  sourceTable: string;
  sourceId: number;
  entryType: string;
  amount: Num;
  category?: string;
  description?: string;
}

export interface PlannedEntry {
  entryType: 'DEBIT' | 'CREDIT';
  category: LedgerCategoryName;
  amount: number;
  effectiveDate: Date;
  description: string;
  sourceTable: 'transaction' | 'payment';
  sourceId: number;
  referenceNumber?: string;
}

export interface ReconcilePlan {
  toCreate: PlannedEntry[];
  toRemoveIds: number[];
  /** Entries to correct in place: a changed amount, and (for donations only) the wording. */
  toUpdate: Array<{ id: number; amount?: number; description?: string }>;
}

const sameMoney = (a: Num, b: Num) => Math.abs(Number(a) - Number(b)) < 0.005;
const key = (sourceTable: string, sourceId: number) => `${sourceTable}:${sourceId}`;

export function planLedgerReconciliation(input: {
  transactions: ReconcileTransaction[];
  existing: ExistingLedgerEntry[];
  /** Payments that were deleted with a voided cash receipt and already offset by a "payment_void" entry. */
  neutralisedPaymentIds: Set<number>;
}): ReconcilePlan {
  const expected = new Map<string, PlannedEntry>();

  for (const txn of input.transactions) {
    const category = ledgerCategoryFor(txn.category.type);
    if (!txn.isVoided) {
      expected.set(key('transaction', txn.id), {
        entryType: 'DEBIT',
        category,
        amount: Number(txn.amount),
        effectiveDate: txn.createdAt,
        description: chargeDescription(txn.category.type, txn.category.name, txn.notes, Boolean(txn.dueDate)),
        sourceTable: 'transaction',
        sourceId: txn.id,
        referenceNumber: txn.referenceNumber || undefined,
      });
    }
    // A payment is real money whether or not its charge was later voided, so it always counts.
    for (const payment of txn.payments) {
      expected.set(key('payment', payment.id), {
        entryType: 'CREDIT',
        category,
        amount: Number(payment.amountPaid),
        effectiveDate: payment.paymentDate,
        description: paymentDescription(txn.category.type, txn.category.name, Boolean(txn.dueDate)),
        sourceTable: 'payment',
        sourceId: payment.id,
        referenceNumber: payment.receiptNumber || undefined,
      });
    }
  }

  const toRemoveIds: number[] = [];
  const toUpdate: ReconcilePlan['toUpdate'] = [];
  const seen = new Set<string>();

  // Oldest first, so when an entry was written twice the first one is kept.
  for (const entry of [...input.existing].sort((a, b) => a.id - b.id)) {
    const k = key(entry.sourceTable, entry.sourceId);
    const want = expected.get(k);

    if (!want) {
      // Its charge or payment is gone, voided or belongs to someone else now. A voided cash receipt is already offset: leave it.
      const offsetByVoid = entry.sourceTable === 'payment' && input.neutralisedPaymentIds.has(entry.sourceId);
      if (!offsetByVoid) toRemoveIds.push(entry.id);
      continue;
    }
    if (seen.has(k) || entry.entryType !== want.entryType) {
      toRemoveIds.push(entry.id);
      continue;
    }
    seen.add(k);
    const change: { id: number; amount?: number; description?: string } = { id: entry.id };
    if (!sameMoney(entry.amount, want.amount)) change.amount = want.amount;
    // Only donation lines are re-worded (so pledges read as pledges); every other line keeps the words it was written with.
    if (want.category === 'DONATION' && entry.description !== undefined && entry.description !== want.description) change.description = want.description;
    if (change.amount !== undefined || change.description !== undefined) toUpdate.push(change);
  }

  const toCreate = [...expected.entries()].filter(([k]) => !seen.has(k)).map(([, entry]) => entry);
  return { toCreate, toRemoveIds, toUpdate };
}

/** Running balance down a list already in order. Debits add to what is owed, credits take away. */
export function runningBalances(entries: Array<{ id: number; entryType: string; amount: Num }>): Map<number, number> {
  const result = new Map<number, number>();
  let balance = 0;
  for (const entry of entries) {
    if (entry.entryType === 'DEBIT') balance += Number(entry.amount);
    else if (entry.entryType === 'CREDIT') balance -= Number(entry.amount);
    result.set(entry.id, Math.round(balance * 100) / 100);
  }
  return result;
}
