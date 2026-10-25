import { ONBOARDING_FINANCE_TEMPLATES } from '@societyledger/shared';
import { z } from 'zod';

import { parseAmount } from '@/features/finance/schemas';
import type { CategoryPayload } from '@/types/api/financeSetup';
import type { MemberFormPayload } from '@/types/api/membersManage';
import type { BankAccountPayload } from '@/types/api/bankManage';

// ---------------------------------------------------------------- O3 members (one at a time)

export const quickMemberSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter the first name').max(60, 'Too long'),
  lastName: z.string().trim().min(1, 'Enter the last name').max(60, 'Too long'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'Enter a phone number with 7 to 20 digits'),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address'),
  gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Choose one' }) }),
});
export type QuickMemberFormValues = z.infer<typeof quickMemberSchema>;

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

export function toMemberPayload(values: QuickMemberFormValues, now = new Date()): MemberFormPayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    phone: values.phone.trim() === '' ? null : values.phone.trim(),
    email: values.email.trim() === '' ? null : values.email.trim().toLowerCase(),
    gender: values.gender,
    category: 'regular',
    status: 'active',
    joinDate: now.toISOString(),
  };
}

// ---------------------------------------------------------------- O2 finance

export type FinanceTemplate = (typeof ONBOARDING_FINANCE_TEMPLATES)[number];

const amountText = z.string().trim().refine((v) => v === '' || parseAmount(v) !== null, 'Enter an amount above ₦0');

export const financeSetupSchema = z.object({
  // One amount per starter template, in the same order; a template that is not picked is ignored.
  amounts: z.array(amountText),
  bankName: z.string().trim(),
  accountName: z.string().trim(),
  accountNumber: z.string().trim(),
}).superRefine((values, ctx) => {
  const wantsBank = values.bankName !== '' || values.accountName !== '' || values.accountNumber !== '';
  if (!wantsBank) return;
  if (values.bankName === '') ctx.addIssue({ code: 'custom', path: ['bankName'], message: 'Choose the bank' });
  if (values.accountName.length < 2) ctx.addIssue({ code: 'custom', path: ['accountName'], message: 'Enter the account name' });
  if (!/^[0-9]{10}$/.test(values.accountNumber)) ctx.addIssue({ code: 'custom', path: ['accountNumber'], message: 'The account number must be 10 digits' });
});
export type FinanceSetupFormValues = z.infer<typeof financeSetupSchema>;

export function defaultAmounts(): string[] {
  return ONBOARDING_FINANCE_TEMPLATES.map((t) => String(t.amount));
}

export function toCategoryPayload(template: FinanceTemplate, amountText: string): CategoryPayload {
  return {
    name: template.name,
    type: template.type,
    amount: parseAmount(amountText),
    frequency: template.frequency,
    description: template.description,
    isActive: true,
  };
}

export function toBankAccountPayload(values: FinanceSetupFormValues, bankCode: string | undefined): BankAccountPayload | null {
  if (values.bankName === '' && values.accountName === '' && values.accountNumber === '') return null;
  return { bankName: values.bankName, accountName: values.accountName, accountNumber: values.accountNumber, bankCode, isDefault: true };
}
