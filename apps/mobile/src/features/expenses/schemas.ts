import { z } from 'zod';

import { dayOf } from '@/features/accounting/labels';
import type { ExpenseDetailDTO, ExpensePayload } from '@/types/api/expenses';

// These mirror the server's own checks (expense-rules.ts) so a problem shows on the phone in the same words.

const amountText = z
  .string()
  .trim()
  .min(1, 'Enter the amount')
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, '')), 'Use naira and kobo, like 2500 or 2500.50')
  .refine((v) => Number(v.replace(/,/g, '')) > 0, 'The amount must be more than zero');

export const expenseFormSchema = z.object({
  payee: z.string().trim().min(2, 'Enter who was paid').max(100, 'Use 100 characters or fewer'),
  description: z.string().trim().min(2, 'Say what it was for').max(300, 'Use 300 characters or fewer'),
  amount: amountText,
  /** A date field holds an ISO moment (or a plain day); the calendar day is taken from it with `dayOf`. */
  expenseDate: z.string().min(1, 'Choose the date it was paid'),
  categoryAccountId: z.string().min(1, 'Choose a category'),
  paidFromAccountId: z.string().min(1, 'Choose the account it was paid from'),
  reference: z.string().trim().max(60, 'Use 60 characters or fewer'),
  noReceiptReason: z.string().trim().max(200, 'Use 200 characters or fewer'),
  /** A receipt picked now (a file the phone holds); the saved one is shown separately. */
  receipt: z.any().nullable(),
});
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const emptyExpenseValues = (today: string): ExpenseFormValues => ({
  payee: '',
  description: '',
  amount: '',
  expenseDate: today,
  categoryAccountId: '',
  paidFromAccountId: '',
  reference: '',
  noReceiptReason: '',
  receipt: null,
});

export function expenseToFormValues(expense: ExpenseDetailDTO): ExpenseFormValues {
  return {
    payee: expense.payee,
    description: expense.description,
    amount: String(Number(expense.amount)),
    expenseDate: expense.expenseDate,
    categoryAccountId: String(expense.category.id),
    paidFromAccountId: String(expense.paidFrom.id),
    reference: expense.reference ?? '',
    noReceiptReason: expense.noReceiptReason ?? '',
    receipt: null,
  };
}

export function toExpensePayload(values: ExpenseFormValues): ExpensePayload {
  return {
    payee: values.payee.trim(),
    description: values.description.trim(),
    amount: Number(values.amount.replace(/,/g, '')),
    expenseDate: dayOf(values.expenseDate),
    categoryAccountId: Number(values.categoryAccountId),
    paidFromAccountId: Number(values.paidFromAccountId),
    reference: values.reference.trim() || null,
    noReceiptReason: values.noReceiptReason.trim() || null,
  };
}
