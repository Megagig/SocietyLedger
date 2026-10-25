import { z } from 'zod';

import type { ChargeDetailDTO, ChargeListItemDTO, CreateChargePayload, ManualPaymentMethod } from '@/types/api/financeManage';

const MONEY = /^\d+(\.\d{1,2})?$/;

/** Naira as typed ("5,000", "5000.50") → a number, or null when it isn't an amount above ₦0 in naira and kobo. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  if (!MONEY.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

const amountField = z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0');

/** A due date typed as an ISO string, or blank for none. */
export const dueDateToIso = (date: string): string | null => (date ? new Date(date).toISOString() : null);

// ---------------------------------------------------------------- a charge (create / edit / void-and-replace)

export type ChargeMode = 'create' | 'edit' | 'void';

/** The reason and password only exist for the modes that ask for them; the rest of the form is shared. */
export function buildChargeFormSchema(mode: ChargeMode) {
  return z.object({
    member: z.object({ id: z.number(), name: z.string() }).nullable().refine((v): boolean => v !== null, 'Choose the member'),
    categoryId: z.string().min(1, 'Choose the category'),
    amount: amountField,
    dueDate: z.string(),
    notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
    reason:
      mode === 'edit'
        ? z.string().trim().min(5, 'Say why you are editing this (at least 5 characters)')
        : mode === 'void'
          ? z.string().trim().min(10, 'Say why you are voiding this (at least 10 characters)')
          : z.string(),
    password: mode === 'void' ? z.string().min(1, 'Enter your password to confirm') : z.string(),
  });
}

export type ChargeFormValues = z.infer<ReturnType<typeof buildChargeFormSchema>>;

export function emptyChargeValues(): ChargeFormValues {
  return { member: null, categoryId: '', amount: '', dueDate: '', notes: '', reason: '', password: '' };
}

export function chargeToFormValues(charge: ChargeDetailDTO | ChargeListItemDTO): ChargeFormValues {
  return {
    member: { id: charge.member.id, name: `${charge.member.firstName} ${charge.member.lastName}`.trim() },
    categoryId: String(charge.categoryId),
    amount: String(Number(charge.amount)),
    dueDate: charge.dueDate ? charge.dueDate.slice(0, 10) : '',
    notes: charge.notes ?? '',
    reason: '',
    password: '',
  };
}

export function toChargePayload(values: ChargeFormValues): CreateChargePayload {
  return {
    memberId: values.member!.id,
    categoryId: Number(values.categoryId),
    amount: parseAmount(values.amount) ?? 0,
    dueDate: dueDateToIso(values.dueDate),
    notes: values.notes.trim() || null,
  };
}

// ---------------------------------------------------------------- bulk create

export type BulkTarget = 'all' | 'chosen';

export const bulkFormSchema = z.object({
  categoryId: z.string().min(1, 'Choose the category'),
  amount: amountField,
  dueDate: z.string(),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
});

export type BulkFormValues = z.infer<typeof bulkFormSchema>;

// ---------------------------------------------------------------- record payment

export const paymentFormSchema = z.object({
  amount: amountField,
  method: z.string().min(1, 'Choose how it was paid'),
  paymentDate: z.string().min(1, 'Choose the date it was paid'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function emptyPaymentValues(balance?: number): PaymentFormValues {
  return { amount: balance && balance > 0 ? String(balance) : '', method: 'cash', paymentDate: new Date().toISOString(), notes: '' };
}

/** The most the officer can record, and what is wrong with the amount typed against it (null when it is fine). */
export function paymentAmountProblem(amountText: string, balance: number): string | null {
  const amount = parseAmount(amountText);
  if (amount === null) return null; // the field's own message covers a blank or malformed amount
  if (amount > balance + 0.001) return `Only ${balance.toLocaleString('en-NG', { maximumFractionDigits: 2 })} naira is left to pay on this charge.`;
  return null;
}

export const isManualMethod = (value: string): value is ManualPaymentMethod => ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other'].includes(value);
