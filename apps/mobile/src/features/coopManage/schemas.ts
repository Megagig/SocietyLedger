import { z } from 'zod';

import { parseAmount } from '@/features/finance/schemas';
import type { DisbursementMethod, LoanProductPayload, OfficerLoanProductDTO, OpenAccountPayload, RecordSavingsPayload } from '@/types/api/coopManage';
import type { InterestType } from '@/types/api/loans';
import type { SavingsAccountType } from '@/types/api/cooperatives';

const optionalAmount = z.string().trim().refine((v) => v === '' || parseAmount(v) !== null, 'Enter an amount above ₦0, or leave it blank');
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/** A number typed as text, blank allowed: returns undefined for blank, NaN for junk. */
const toNumber = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text.replace(/,/g, '')));

// ---------------------------------------------------------------- opening an account

export const openAccountSchema = z.object({
  member: z.object({ id: z.number(), name: z.string() }).nullable().refine((v): boolean => v !== null, 'Choose the member'),
  accountType: z.string().min(1, 'Choose the kind of account'),
  targetAmount: optionalAmount,
  monthlyContribution: optionalAmount,
  interestRate: z.string().trim().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 100), 'Enter a rate between 0 and 100, or leave it blank'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
});
export type OpenAccountValues = z.infer<typeof openAccountSchema>;

export const emptyOpenAccountValues = (): OpenAccountValues => ({ member: null, accountType: 'REGULAR', targetAmount: '', monthlyContribution: '', interestRate: '', notes: '' });

export function toOpenAccountPayload(values: OpenAccountValues): OpenAccountPayload {
  return {
    memberId: values.member!.id,
    accountType: values.accountType as SavingsAccountType,
    targetAmount: parseAmount(values.targetAmount) ?? undefined,
    monthlyContribution: parseAmount(values.monthlyContribution) ?? undefined,
    interestRate: toNumber(values.interestRate),
    notes: values.notes.trim() || undefined,
  };
}

// ---------------------------------------------------------------- recording a deposit or withdrawal

/** A withdrawal can't be more than what is available (held savings can't leave); a deposit has no limit. */
export function buildRecordSavingsSchema(type: 'DEPOSIT' | 'WITHDRAWAL', available: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0')
      .refine((v) => type === 'DEPOSIT' || (parseAmount(v) ?? 0) <= available + 0.001, `You can take out at most ${naira(available)}, which is what is available`),
    paymentMethod: z.string().min(1, 'Choose how it was paid'),
    reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
    notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
  });
}
export type RecordSavingsValues = z.infer<ReturnType<typeof buildRecordSavingsSchema>>;

export function toRecordSavingsPayload(values: RecordSavingsValues, accountId: number, type: 'DEPOSIT' | 'WITHDRAWAL'): RecordSavingsPayload {
  return {
    savingsAccountId: accountId,
    type,
    amount: parseAmount(values.amount) ?? 0,
    paymentMethod: values.paymentMethod,
    reference: values.reference.trim() || undefined,
    notes: values.notes.trim() || undefined,
  };
}

// ---------------------------------------------------------------- rejecting

/** A rejection needs a reason the member can read. */
export const rejectSchema = z.object({ reason: z.string().trim().min(3, 'Say why (at least 3 characters)').max(500, 'Keep the reason under 500 characters') });
export type RejectValues = z.infer<typeof rejectSchema>;

// ---------------------------------------------------------------- disbursing

export const disburseSchema = z
  .object({
    method: z.string().min(1, 'Choose how it is paid out'),
    savingsAccountId: z.string(),
    reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
    notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
  })
  .superRefine((values, ctx) => {
    if (values.method === 'savings_credit' && !values.savingsAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['savingsAccountId'], message: "Choose the member's savings account to credit" });
    }
  });
export type DisburseValues = z.infer<typeof disburseSchema>;

export function toDisbursePayload(values: DisburseValues) {
  return {
    disbursementMethod: values.method as DisbursementMethod,
    savingsAccountId: values.method === 'savings_credit' ? Number(values.savingsAccountId) : undefined,
    reference: values.reference.trim() || undefined,
    notes: values.notes.trim() || undefined,
  };
}

// ---------------------------------------------------------------- recording a repayment

/** A repayment can't be more than what is still owed on the loan. */
export function buildRepaymentSchema(outstanding: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0')
      .refine((v) => (parseAmount(v) ?? 0) <= outstanding + 0.001, `That is more than is still owed (${naira(outstanding)})`),
    paymentMethod: z.string().min(1, 'Choose how it was paid'),
    reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
    notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
  });
}
export type RepaymentValues = z.infer<ReturnType<typeof buildRepaymentSchema>>;

// ---------------------------------------------------------------- a loan product

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, `${label} must be a whole number from ${min} to ${max}`);

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
    minAmount: z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter the smallest loan, above ₦0'),
    maxAmount: z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter the largest loan, above ₦0'),
    interestRate: z.string().trim().refine((v) => v !== '' && Number(v) >= 0 && Number(v) <= 100, 'Enter a rate between 0 and 100'),
    interestType: z.string().min(1, 'Choose how interest is worked out'),
    minTenureMonths: wholeNumber('The shortest tenure', 1, 360),
    maxTenureMonths: wholeNumber('The longest tenure', 1, 360),
    processingFeePercent: z.string().trim().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 100), 'Enter a percentage between 0 and 100'),
    processingFeeFixed: optionalAmount,
    requiresGuarantor: z.boolean(),
    minGuarantors: z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 10), 'Enter a whole number up to 10'),
    maxLoanToSavingsRatio: z.string().trim().refine((v) => v === '' || Number(v) >= 0, 'Enter a number, or leave it blank'),
    lockSavings: z.boolean(),
    gracePeriodDays: z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 90), 'Enter a whole number up to 90'),
    lateFeePercent: z.string().trim().refine((v) => v === '' || (Number(v) >= 0 && Number(v) <= 100), 'Enter a percentage between 0 and 100'),
    lateFeeFixed: optionalAmount,
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const min = parseAmount(values.minAmount);
    const max = parseAmount(values.maxAmount);
    if (min !== null && max !== null && max < min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxAmount'], message: "The largest loan can't be less than the smallest" });
    }
    if (/^\d+$/.test(values.minTenureMonths) && /^\d+$/.test(values.maxTenureMonths) && Number(values.maxTenureMonths) < Number(values.minTenureMonths)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxTenureMonths'], message: "The longest tenure can't be less than the shortest" });
    }
  });
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const emptyProductValues = (): ProductFormValues => ({
  name: '', description: '', minAmount: '', maxAmount: '', interestRate: '', interestType: 'REDUCING_BALANCE', minTenureMonths: '3', maxTenureMonths: '12',
  processingFeePercent: '', processingFeeFixed: '', requiresGuarantor: true, minGuarantors: '1', maxLoanToSavingsRatio: '', lockSavings: false,
  gracePeriodDays: '', lateFeePercent: '', lateFeeFixed: '', isActive: true,
});

export function productToFormValues(product: OfficerLoanProductDTO): ProductFormValues {
  const num = (v: string | number | null) => (v === null || Number(v) === 0 ? '' : String(Number(v)));
  return {
    name: product.name,
    description: product.description ?? '',
    minAmount: String(Number(product.minAmount)),
    maxAmount: String(Number(product.maxAmount)),
    interestRate: String(Number(product.interestRate)),
    interestType: product.interestType,
    minTenureMonths: String(product.minTenureMonths),
    maxTenureMonths: String(product.maxTenureMonths),
    processingFeePercent: num(product.processingFeePercent),
    processingFeeFixed: num(product.processingFeeFixed),
    requiresGuarantor: product.requiresGuarantor,
    minGuarantors: String(product.minGuarantors),
    maxLoanToSavingsRatio: num(product.maxLoanToSavingsRatio),
    lockSavings: product.lockSavings,
    gracePeriodDays: product.gracePeriodDays ? String(product.gracePeriodDays) : '',
    lateFeePercent: num(product.lateFeePercent),
    lateFeeFixed: num(product.lateFeeFixed),
    isActive: product.isActive,
  };
}

export function toProductPayload(values: ProductFormValues): LoanProductPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    minAmount: parseAmount(values.minAmount) ?? 0,
    maxAmount: parseAmount(values.maxAmount) ?? 0,
    interestRate: Number(values.interestRate),
    interestType: values.interestType as InterestType,
    minTenureMonths: Number(values.minTenureMonths),
    maxTenureMonths: Number(values.maxTenureMonths),
    processingFeePercent: toNumber(values.processingFeePercent) ?? 0,
    processingFeeFixed: parseAmount(values.processingFeeFixed) ?? 0,
    requiresGuarantor: values.requiresGuarantor,
    minGuarantors: values.requiresGuarantor ? (toNumber(values.minGuarantors) ?? 1) : 0,
    maxLoanToSavingsRatio: toNumber(values.maxLoanToSavingsRatio),
    lockSavings: values.lockSavings,
    gracePeriodDays: toNumber(values.gracePeriodDays) ?? 0,
    lateFeePercent: toNumber(values.lateFeePercent) ?? 0,
    lateFeeFixed: parseAmount(values.lateFeeFixed) ?? 0,
    isActive: values.isActive,
  };
}
