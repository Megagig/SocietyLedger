/**
 * The rules of an expense voucher: who may do what in which state, what a voucher must carry before it is sent, and how its number
 * and receipt are checked.
 *
 * Kept free of the database so each rule can be tested on its own. Amounts are exact decimals in naira and kobo, never floating point.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';
import { RuleError } from '../finance/rule-error';
import { lagosDayKey, lagosDayStart, toMoney } from '../accounting/accounting-rules';

export class ExpenseRuleError extends RuleError {}

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'VOIDED';

/** What counts as an amount that needs its receipt, unless the association sets its own limit. */
export const DEFAULT_RECEIPT_LIMIT = 5000;
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const MAX_EXPENSE_AMOUNT = new Decimal('100000000000');

/** A voucher can be changed, sent and deleted while it is a draft, and after it was rejected (changing it sends it back as a draft). */
export const isEditableStatus = (status: ExpenseStatus): boolean => status === 'DRAFT' || status === 'REJECTED';

/** Money in full for a message: ₦5,000.00. */
export const formatNaira = (value: Decimal.Value): string => `₦${new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/** The amount as exact naira and kobo, or a plain refusal. */
export function parseAmount(value: unknown): Decimal {
  const money = typeof value === 'number' || typeof value === 'string' ? toMoney(value) : null;
  if (!money) throw new ExpenseRuleError('Enter the amount in naira, with at most two decimal places.', 400, 'INVALID_AMOUNT');
  if (!money.gt(0)) throw new ExpenseRuleError('The amount must be more than zero.', 400, 'INVALID_AMOUNT');
  if (money.gt(MAX_EXPENSE_AMOUNT)) throw new ExpenseRuleError('That amount is too large for one voucher.', 400, 'INVALID_AMOUNT');
  return money;
}

/**
 * The day of the spending, kept at midday UTC (early afternoon in Lagos) so it can never slip onto another day. A plain day or a full
 * moment is accepted; it cannot be after today in Lagos.
 */
export function parseExpenseDate(value: unknown, now: Date = new Date()): Date {
  if (typeof value !== 'string' || value.trim() === '') throw new ExpenseRuleError('Choose the date the money was paid.', 400, 'INVALID_DATE');
  const text = value.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00.000Z`) : new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new ExpenseRuleError('That is not a date.', 400, 'INVALID_DATE');
  const day = lagosDayKey(parsed);
  if (day > lagosDayKey(now)) throw new ExpenseRuleError('The date cannot be in the future. Record the spending once it has been paid.', 400, 'FUTURE_DATE');
  return new Date(`${day}T12:00:00.000Z`);
}

const text = (label: string, min: number, max: number) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(min, `${label} needs at least ${min} characters.`)
    .max(max, `${label} can be ${max} characters at most.`);

/** What a person types for a voucher. Amounts and the date are checked by `parseAmount` and `parseExpenseDate` so the words are plain. */
export const voucherInputSchema = z
  .object({
    payee: text('The payee', 2, 100),
    description: text('The description', 2, 300),
    amount: z.union([z.number(), z.string()]),
    expenseDate: z.string(),
    categoryAccountId: z.number().int().positive('Choose a category.'),
    paidFromAccountId: z.number().int().positive('Choose the account it was paid from.'),
    reference: z.string().trim().max(60, 'The reference can be 60 characters at most.').nullable().optional(),
    noReceiptReason: z.string().trim().max(200, 'The reason can be 200 characters at most.').nullable().optional(),
  })
  .strict();
export type VoucherInput = z.infer<typeof voucherInputSchema>;

export const rejectSchema = z.object({ reason: text('The reason', 3, 300) }).strict();
export const voidSchema = z.object({ reason: text('The reason', 3, 300), password: z.string().min(1, 'Enter your password.') }).strict();
export const approveSchema = z.object({ password: z.string().min(1, 'Enter your password.') }).strict();

/** The receipt limit as an exact amount: what the association set, or the default when it never set one. */
export function receiptLimit(setting: unknown): Decimal {
  const n = typeof setting === 'number' ? setting : typeof setting === 'string' ? Number(setting) : NaN;
  return Number.isFinite(n) && n >= 0 ? new Decimal(n) : new Decimal(DEFAULT_RECEIPT_LIMIT);
}

/**
 * Whether a voucher is ready to be sent for approval. Above the limit it needs its receipt; at or below it, either a receipt or a
 * reason there is none ("bus fare, no receipt").
 */
export function assertReadyToSend(voucher: { amount: Decimal.Value; receiptKey: string | null; noReceiptReason: string | null }, limit: Decimal.Value): void {
  if (voucher.receiptKey) return;
  if (new Decimal(voucher.amount).gt(limit)) {
    throw new ExpenseRuleError(`Attach the receipt. A receipt is needed for spending above ${formatNaira(limit)}.`, 400, 'RECEIPT_REQUIRED');
  }
  if (!voucher.noReceiptReason?.trim()) {
    throw new ExpenseRuleError('Attach the receipt, or say why there is none.', 400, 'RECEIPT_OR_REASON');
  }
}

/** "EXP-2026-00007" from the year and the highest number used so far. */
export const voucherNumberFor = (year: string, latestSuffix: number): string => `EXP-${year}-${String(latestSuffix + 1).padStart(5, '0')}`;
export const suffixOf = (voucherNumber: string | undefined): number => (voucherNumber ? parseInt(voucherNumber.split('-')[2] ?? '0', 10) || 0 : 0);

/** What a receipt really is, from its first bytes (a label sent by the phone proves nothing). Null when it is not a picture or a PDF. */
export function sniffReceipt(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: '.png' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}

// ---------------------------------------------------------------- budget

export type BudgetPosition = {
  budgetId: number;
  budgetName: string;
  /** What the budget plans for this category. */
  planned: Decimal;
  /** What has been posted against it, inside the budget's dates, before this voucher. */
  spent: Decimal;
  /** What this voucher adds. */
  thisVoucher: Decimal;
  /** What is left after this voucher (negative when it goes over). */
  left: Decimal;
  /** How far over the plan this voucher takes it, or zero. */
  overBy: Decimal;
};

/** Where a category stands against its budget line once this voucher is counted. Over budget is when it takes the line past its plan. */
export function budgetPosition(budget: { id: number; name: string }, planned: Decimal.Value, spent: Decimal.Value, amount: Decimal.Value): BudgetPosition {
  const p = new Decimal(planned);
  const s = new Decimal(spent);
  const a = new Decimal(amount);
  const left = p.minus(s).minus(a);
  return { budgetId: budget.id, budgetName: budget.name, planned: p, spent: s, thisVoucher: a, left, overBy: left.isNegative() ? left.abs() : new Decimal(0) };
}

/** The first moment of the Lagos day, for dating a voucher inside a budget. */
export const dayStartOf = (date: Date): Date => lagosDayStart(lagosDayKey(date));
