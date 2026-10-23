import type { CashItemKind, CashPayables, CashReceiptItemPayload } from '@/lib/api/cash';

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Naira typed by an officer ("5,000", "5000.50") → a number, or null when it isn't an amount above ₦0 in naira and kobo. */
export function parseNaira(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  if (!MONEY.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

/** One thing a member could pay, flattened so the modal can list it and read the typed amount back by key. */
export interface PayableRow {
  key: string;
  kind: CashItemKind;
  targetId: number;
  label: string;
  hint: string;
  /** The most that can be accepted, when the rules have one (a charge's balance, a loan's outstanding). */
  max: number | null;
  suggested: number | null;
  group: 'charges' | 'loans' | 'savings' | 'welfare';
}

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
export const payableKey = (kind: CashItemKind, targetId: number) => `${kind}:${targetId}`;

export const GROUP_TITLES: Record<PayableRow['group'], string> = {
  charges: 'What they owe',
  loans: 'Loan repayment',
  savings: 'Cooperative savings',
  welfare: 'Welfare',
};

/** Everything a member could pay, in the order shown: what they owe first, then what they could put aside. */
export function payableRows(p: CashPayables): PayableRow[] {
  return [
    ...p.charges.map<PayableRow>((c) => ({ key: payableKey(c.kind, c.targetId), kind: c.kind, targetId: c.targetId, label: c.label, hint: `Owes ${naira(c.balance)}`, max: c.balance, suggested: c.balance, group: 'charges' })),
    ...p.loans.map<PayableRow>((l) => ({ key: payableKey(l.kind, l.targetId), kind: l.kind, targetId: l.targetId, label: l.label, hint: `Outstanding ${naira(l.outstanding)}`, max: l.outstanding, suggested: l.suggested, group: 'loans' })),
    ...p.savings.map<PayableRow>((s) => ({ key: payableKey(s.kind, s.targetId), kind: s.kind, targetId: s.targetId, label: s.label, hint: `Balance ${naira(s.balance)}`, max: null, suggested: s.suggested, group: 'savings' })),
    ...p.welfare.map<PayableRow>((w) => ({ key: payableKey(w.kind, w.targetId), kind: w.kind, targetId: w.targetId, label: w.label, hint: w.minimum ? `Minimum ${naira(w.minimum)}` : 'Contribution', max: null, suggested: w.suggested ?? w.minimum, group: 'welfare' })),
  ];
}

export interface DonationEntry {
  categoryId: number;
  allocationId: number | null;
  amount: string;
}

export interface ReceiptDraft {
  items: CashReceiptItemPayload[];
  total: number;
  /** Problems keyed by the row's label (or "Donation"), so each can be shown beside its own box. */
  problems: Record<string, string>;
}

/**
 * Turns what the officer typed into the receipt's items, and says what is wrong with it. Only rows with an amount are included;
 * an amount above what is owed, or one that isn't naira and kobo, is reported rather than sent.
 */
export function buildReceiptDraft(rows: PayableRow[], amounts: Record<string, string>, donation: DonationEntry | null): ReceiptDraft {
  const items: CashReceiptItemPayload[] = [];
  const problems: Record<string, string> = {};

  for (const row of rows) {
    const text = amounts[row.key];
    if (!text || !text.trim()) continue;
    const amount = parseNaira(text);
    if (amount === null) problems[row.label] = 'Enter an amount in naira and kobo.';
    else if (row.max !== null && amount > row.max) problems[row.label] = `Only ${naira(row.max)} is owed.`;
    else items.push({ kind: row.kind, targetId: row.targetId, amount });
  }

  if (donation && donation.amount.trim()) {
    const amount = parseNaira(donation.amount);
    if (amount === null) problems.Donation = 'Enter an amount in naira and kobo.';
    else items.push({ kind: 'DONATION', targetId: donation.categoryId, amount, ...(donation.allocationId ? { allocationId: donation.allocationId } : {}) });
  }

  const total = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  return { items, total, problems };
}

/** A key that stays the same for one receipt however many times it is retried, and differs between receipts. */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}

export const ITEM_KIND_LABELS: Record<CashItemKind, string> = {
  DUES: 'Dues',
  LEVY: 'Levy',
  SAVINGS: 'Savings',
  WELFARE: 'Welfare',
  DONATION: 'Donation',
  LOAN_REPAYMENT: 'Loan repayment',
};
