import { z } from 'zod';

import { Decimal } from '@/lib/money';
import type { AccountPayload, AccountType, BudgetPayload, JournalPayload, PeriodPayload } from '@/types/api/accounting';
import { dayOf, entryDateIso, totalsOf } from './labels';

// These mirror the server's own checks (accounting-rules.ts) so a problem shows on the phone in the same words.

const amountText = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/,/g, '')), 'Use naira and kobo, like 2500 or 2500.50');
const clean = (v: string) => v.replace(/,/g, '').trim();
/** A date field holds an ISO moment (or a plain day); the calendar day is taken from it with `dayOf`. */
const day = z.string().min(1, 'Choose a date');

// ---------------------------------------------------------------- journal entry

export const journalLineSchema = z
  .object({ accountId: z.string().min(1, 'Choose an account'), debit: amountText, credit: amountText, description: z.string().trim().max(200, 'Use 200 characters or fewer') })
  .superRefine((line, ctx) => {
    const debit = clean(line.debit) === '' ? 0 : Number(clean(line.debit));
    const credit = clean(line.credit) === '' ? 0 : Number(clean(line.credit));
    if ((debit > 0) === (credit > 0)) ctx.addIssue({ code: 'custom', path: ['debit'], message: 'Enter a debit or a credit, not both' });
  });

export const journalFormSchema = z
  .object({
    entryDate: day,
    description: z.string().trim().min(1, 'Describe the entry').max(500, 'Use 500 characters or fewer'),
    reference: z.string().trim().max(100, 'Use 100 characters or fewer'),
    lines: z.array(journalLineSchema).min(2, 'An entry needs at least two lines'),
  })
  .superRefine((form, ctx) => {
    const totals = totalsOf(form.lines.map((l) => ({ debit: clean(l.debit), credit: clean(l.credit) })));
    if (!totals.balanced) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: totals.debit.isZero() && totals.credit.isZero() ? 'Add the amounts' : `Debits and credits must match. They differ by ${totals.difference.toFixed(2)}` });
    }
  });
export type JournalFormValues = z.infer<typeof journalFormSchema>;

export const emptyJournalValues = (today: string): JournalFormValues => ({
  entryDate: today,
  description: '',
  reference: '',
  lines: [
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ],
});

export function toJournalPayload(values: JournalFormValues): JournalPayload {
  return {
    entryDate: entryDateIso(dayOf(values.entryDate)),
    description: values.description.trim(),
    ...(values.reference.trim() ? { reference: values.reference.trim() } : {}),
    lines: values.lines.map((l) => {
      const debit = clean(l.debit) === '' ? 0 : Number(clean(l.debit));
      const credit = clean(l.credit) === '' ? 0 : Number(clean(l.credit));
      return { accountId: Number(l.accountId), ...(debit > 0 ? { debitAmount: debit } : { creditAmount: credit }), ...(l.description.trim() ? { description: l.description.trim() } : {}) };
    }),
  };
}

// ---------------------------------------------------------------- account

export const accountFormSchema = z.object({
  code: z.string().trim().min(1, 'Enter a code').max(20, 'Use 20 characters or fewer').regex(/^[A-Za-z0-9.-]+$/, 'Use letters, numbers, dots or dashes'),
  name: z.string().trim().min(1, 'Enter a name').max(100, 'Use 100 characters or fewer'),
  type: z.string().min(1, 'Choose a type'),
  description: z.string().trim().max(500, 'Use 500 characters or fewer'),
  /** The group it shows under on the statements; empty for none. */
  subType: z.string(),
  /** DEBIT or CREDIT when chosen on purpose; empty follows the kind of account. */
  normalBalance: z.string(),
  /** The account this one sits under; empty for none. */
  parentId: z.string(),
  isActive: z.boolean(),
});
export type AccountFormValues = z.infer<typeof accountFormSchema>;

export const toAccountPayload = (v: AccountFormValues): AccountPayload => ({
  code: v.code.trim(),
  name: v.name.trim(),
  type: v.type as AccountType,
  ...(v.subType ? { subType: v.subType } : {}),
  ...(v.normalBalance === 'DEBIT' || v.normalBalance === 'CREDIT' ? { normalBalance: v.normalBalance } : {}),
  ...(v.description.trim() ? { description: v.description.trim() } : {}),
  ...(v.parentId ? { parentId: Number(v.parentId) } : {}),
});

// ---------------------------------------------------------------- budget

export type BudgetLineDraft = { accountId: string; amount: string; notes: string };

export const budgetFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the budget a name').max(100, 'Use 100 characters or fewer'),
    fiscalYear: z.string().regex(/^(20\d{2})$/, 'Enter a year like 2026'),
    startDate: day,
    endDate: day,
    description: z.string().trim().max(500, 'Use 500 characters or fewer'),
    items: z
      .array(z.object({ accountId: z.string().min(1, 'Choose an account'), amount: amountText.refine((v) => v !== '' && Number(clean(v)) > 0, 'Enter a yearly amount'), notes: z.string().trim().max(500, 'Use 500 characters or fewer') }))
      .min(1, 'Add at least one line')
      .refine((items) => new Set(items.map((i) => i.accountId)).size === items.length, 'Each account can be in a budget only once'),
  })
  .superRefine((form, ctx) => {
    if (dayOf(form.endDate) <= dayOf(form.startDate)) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The budget must end after it starts' });
  });
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const budgetTotal = (items: { amount: string }[]): Decimal => items.reduce((sum, i) => sum.plus(/^\d+(\.\d+)?$/.test(clean(i.amount)) ? new Decimal(clean(i.amount)) : 0), new Decimal(0));

export function toBudgetPayload(v: BudgetFormValues): BudgetPayload {
  return {
    name: v.name.trim(),
    ...(v.description.trim() ? { description: v.description.trim() } : {}),
    fiscalYear: Number(v.fiscalYear),
    startDate: entryDateIso(dayOf(v.startDate)),
    endDate: entryDateIso(dayOf(v.endDate)),
    items: v.items.map((i) => ({ accountId: Number(i.accountId), annualAmount: Number(clean(i.amount)), ...(i.notes.trim() ? { notes: i.notes.trim() } : {}) })),
  };
}

// ---------------------------------------------------------------- period

export const periodFormSchema = z
  .object({ name: z.string().trim().min(1, 'Name the period').max(100, 'Use 100 characters or fewer'), periodType: z.string().min(1), startDate: day, endDate: day })
  .superRefine((v, ctx) => {
    if (dayOf(v.endDate) <= dayOf(v.startDate)) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end must be after the start' });
  });
export type PeriodFormValues = z.infer<typeof periodFormSchema>;

export const PERIOD_TYPE_OPTIONS = [
  { label: 'A month', value: 'month' },
  { label: 'A quarter', value: 'quarter' },
  { label: 'A year', value: 'year' },
];

export const toPeriodPayload = (v: PeriodFormValues): PeriodPayload => ({
  name: v.name.trim(),
  periodType: v.periodType as PeriodPayload['periodType'],
  startDate: entryDateIso(dayOf(v.startDate)),
  endDate: entryDateIso(dayOf(v.endDate)),
});
