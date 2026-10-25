import { z } from 'zod';

import type { CashItemKind, CashPayablesDTO, CashReceiptItemPayload } from '@/types/api/cash';

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Naira typed by an officer ("5,000", "5000.50") → a number, or null when it isn't an amount above ₦0 in naira and kobo. */
export function parseNairaInput(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  if (!MONEY.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

// ---------------------------------------------------------------- collections

export const collectionFormSchema = z.object({
  title: z.string().trim().min(2, 'Give the collection a name, e.g. "October general meeting"').max(120, 'Keep the name under 120 characters'),
  meetingId: z.string(),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
});

export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export function emptyCollectionValues(): CollectionFormValues {
  return { title: '', meetingId: '', notes: '' };
}

// ---------------------------------------------------------------- collect cash

/** One thing a member could pay, flattened so the screen can list it and the amounts can be read back by key. */
export type PayableRow = {
  key: string;
  kind: CashItemKind;
  targetId: number;
  label: string;
  /** A short line under the label, e.g. "Owes ₦5,000" or "Balance ₦20,000". */
  hint: string;
  /** The most that can be accepted, when the rules have one (a charge's balance, a loan's outstanding). */
  max: number | null;
  /** An amount worth offering as a quick fill. */
  suggested: number | null;
  group: 'charges' | 'savings' | 'welfare' | 'loans';
};

export const payableKey = (kind: CashItemKind, targetId: number) => `${kind}:${targetId}`;

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Everything a member could pay, in the order the screen shows it: what they owe first, then what they could put aside. */
export function payableRows(payables: CashPayablesDTO): PayableRow[] {
  return [
    ...payables.charges.map<PayableRow>((c) => ({
      key: payableKey(c.kind, c.targetId),
      kind: c.kind,
      targetId: c.targetId,
      label: c.label,
      hint: `Owes ${naira(c.balance)}`,
      max: c.balance,
      suggested: c.balance,
      group: 'charges',
    })),
    ...payables.loans.map<PayableRow>((l) => ({
      key: payableKey(l.kind, l.targetId),
      kind: l.kind,
      targetId: l.targetId,
      label: l.label,
      hint: `Outstanding ${naira(l.outstanding)}`,
      max: l.outstanding,
      suggested: l.suggested,
      group: 'loans',
    })),
    ...payables.savings.map<PayableRow>((s) => ({
      key: payableKey(s.kind, s.targetId),
      kind: s.kind,
      targetId: s.targetId,
      label: s.label,
      hint: `Balance ${naira(s.balance)}`,
      max: null,
      suggested: s.suggested,
      group: 'savings',
    })),
    ...payables.welfare.map<PayableRow>((w) => ({
      key: payableKey(w.kind, w.targetId),
      kind: w.kind,
      targetId: w.targetId,
      label: w.label,
      hint: w.minimum ? `Minimum ${naira(w.minimum)}` : 'Contribution',
      max: null,
      suggested: w.suggested ?? w.minimum,
      group: 'welfare',
    })),
  ];
}

/** A donation is its own entry because it names a category (and perhaps a project) instead of an existing balance. */
export type DonationEntry = { categoryId: number; allocationId: number | null; amount: string };

export type ReceiptDraft = {
  /** Amount text per payable key, as typed. */
  amounts: Record<string, string>;
  donation: DonationEntry | null;
};

export type ReceiptDraftResult = { items: CashReceiptItemPayload[]; total: number; problems: string[] };

/**
 * Turns what the officer typed into the receipt's items, and says what is wrong with it. Only rows with an amount are included; an
 * amount above what is owed, or one that isn't naira and kobo, is reported rather than sent.
 */
export function buildReceiptDraft(rows: PayableRow[], draft: ReceiptDraft): ReceiptDraftResult {
  const items: CashReceiptItemPayload[] = [];
  const problems: string[] = [];

  for (const row of rows) {
    const text = draft.amounts[row.key];
    if (!text || !text.trim()) continue;
    const amount = parseNairaInput(text);
    if (amount === null) {
      problems.push(`${row.label}: enter an amount in naira and kobo.`);
      continue;
    }
    if (row.max !== null && amount > row.max) {
      problems.push(`${row.label}: only ${naira(row.max)} is owed.`);
      continue;
    }
    items.push({ kind: row.kind, targetId: row.targetId, amount });
  }

  if (draft.donation && draft.donation.amount.trim()) {
    const amount = parseNairaInput(draft.donation.amount);
    if (amount === null) problems.push('Donation: enter an amount in naira and kobo.');
    else
      items.push({
        kind: 'DONATION',
        targetId: draft.donation.categoryId,
        amount,
        ...(draft.donation.allocationId ? { allocationId: draft.donation.allocationId } : {}),
      });
  }

  const total = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  return { items, total, problems };
}

/** A key that stays the same for one receipt however many times it is retried, and differs between receipts. */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}

// ---------------------------------------------------------------- lodgments

export type AttachmentValue = { uri: string; name: string; type: string; size?: number };

export function buildLodgmentFormSchema(expected: number) {
  return z
    .object({
      bankAccountId: z.string().min(1, 'Choose the account you paid into'),
      amount: z
        .string()
        .trim()
        .refine((value) => parseNairaInput(value) !== null, 'Enter the amount you paid in, above ₦0'),
      depositDate: z.string().min(1, 'Choose the date you paid it in'),
      bankReference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
      shortfallReason: z.string().trim().max(500, 'Keep the reason under 500 characters'),
      slip: z.custom<AttachmentValue | null>().refine((value) => value !== null && value !== undefined, 'Attach a photo of the deposit slip'),
    })
    .superRefine((values, ctx) => {
      const amount = parseNairaInput(values.amount);
      if (amount === null) return;
      if (amount > expected + 0.001) {
        ctx.addIssue({ code: 'custom', path: ['amount'], message: `You can lodge at most ${naira(expected)} — that is all the cash you hold.` });
      } else if (amount < expected - 0.001 && !values.shortfallReason.trim()) {
        ctx.addIssue({ code: 'custom', path: ['shortfallReason'], message: 'You are lodging less than you collected. Say why.' });
      }
    });
}

export type LodgmentFormValues = z.infer<ReturnType<typeof buildLodgmentFormSchema>>;

/** How far short of what was collected a lodgment is (0 when it covers everything). */
export function shortfallOf(expected: number, amountText: string): number {
  const amount = parseNairaInput(amountText);
  if (amount === null) return 0;
  return Math.max(0, Math.round((expected - amount) * 100) / 100);
}
