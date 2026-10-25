import { z } from 'zod';

import { parseAmount } from '@/features/finance/schemas';
import type { BulkContributionPayload, FundKind, FundPayload, FundStatus, OfficerFundDTO, RecordContributionPayload } from '@/types/api/welfareManage';

const optionalAmount = z.string().trim().refine((v) => v === '' || parseAmount(v) !== null, 'Enter an amount above ₦0, or leave it blank');
const wholeNumber = (label: string) => z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), `${label} must be a whole number`);
const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- a fund

export const fundFormSchema = z.object({
  name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
  fundType: z.string().min(1, 'Choose the kind of fund'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
  targetBalance: optionalAmount,
  monthlyContribution: optionalAmount,
  isContributionMandatory: z.boolean(),
  minContribution: optionalAmount,
  maxPayout: optionalAmount,
  waitingPeriodDays: wholeNumber('Waiting period'),
  minContributionMonths: wholeNumber('Months of contributions'),
  status: z.string(),
});
export type FundFormValues = z.infer<typeof fundFormSchema>;

export const emptyFundValues = (): FundFormValues => ({
  name: '', fundType: 'GENERAL', description: '', targetBalance: '', monthlyContribution: '', isContributionMandatory: false, minContribution: '',
  maxPayout: '', waitingPeriodDays: '', minContributionMonths: '', status: 'ACTIVE',
});

export function fundToFormValues(fund: OfficerFundDTO): FundFormValues {
  const num = (v: string | number | null) => (v === null ? '' : String(Number(v)));
  return {
    name: fund.name,
    fundType: fund.fundType,
    description: fund.description ?? '',
    targetBalance: num(fund.targetBalance),
    monthlyContribution: num(fund.monthlyContribution),
    isContributionMandatory: fund.isContributionMandatory,
    minContribution: num(fund.minContribution),
    maxPayout: num(fund.maxPayout),
    waitingPeriodDays: fund.waitingPeriodDays ? String(fund.waitingPeriodDays) : '',
    minContributionMonths: fund.minContributionMonths ? String(fund.minContributionMonths) : '',
    status: fund.status,
  };
}

export function toFundPayload(values: FundFormValues): FundPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    fundType: values.fundType as FundKind,
    targetBalance: parseAmount(values.targetBalance),
    monthlyContribution: parseAmount(values.monthlyContribution),
    isContributionMandatory: values.isContributionMandatory,
    minContribution: parseAmount(values.minContribution),
    maxPayout: parseAmount(values.maxPayout),
    waitingPeriodDays: Number(values.waitingPeriodDays || 0),
    minContributionMonths: Number(values.minContributionMonths || 0),
    status: values.status as FundStatus,
  };
}

// ---------------------------------------------------------------- recording contributions

/** A contribution has an amount that meets the fund's minimum, a date that is not in the future, and a way it was paid. */
export function buildContributionSchema(minContribution: number | null) {
  return z.object({
    fundId: z.string().min(1, 'Choose the fund'),
    /** The member, when recording for one (the screen checks it is set). */
    member: z.object({ id: z.number(), name: z.string() }).nullable(),
    amount: z
      .string()
      .trim()
      .refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0')
      .refine((v) => minContribution === null || (parseAmount(v) ?? 0) >= minContribution, `The smallest contribution to this fund is ${naira(minContribution ?? 0)}`),
    contributionDate: z.string().refine((v) => v === '' || new Date(v).getTime() <= Date.now() + 86_400_000, "The date can't be in the future"),
    paymentMethod: z.string().min(1, 'Choose how it was paid'),
    reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
    notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
  });
}
export type ContributionValues = z.infer<ReturnType<typeof buildContributionSchema>>;

export const emptyContributionValues = (fundId = ''): ContributionValues => ({
  fundId, member: null, amount: '', contributionDate: new Date().toISOString(), paymentMethod: 'cash', reference: '', notes: '',
});

export function toContributionPayload(values: ContributionValues, memberId: number): RecordContributionPayload {
  return {
    fundId: Number(values.fundId),
    memberId,
    amount: parseAmount(values.amount) ?? 0,
    contributionDate: values.contributionDate ? new Date(values.contributionDate).toISOString() : undefined,
    paymentMethod: values.paymentMethod,
    reference: values.reference.trim() || undefined,
    notes: values.notes.trim() || undefined,
  };
}

export function toBulkPayload(values: ContributionValues, memberIds: number[]): BulkContributionPayload {
  return {
    fundId: Number(values.fundId),
    memberIds,
    amount: parseAmount(values.amount) ?? 0,
    contributionDate: values.contributionDate ? new Date(values.contributionDate).toISOString() : undefined,
    paymentMethod: values.paymentMethod,
    notes: values.notes.trim() || undefined,
  };
}

// ---------------------------------------------------------------- approving a payout

/** The amount to approve can be lower than asked, never higher than `max` (the least of what was asked, the fund's limit and its balance). */
export function buildApproveSchema(max: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0')
      .refine((v) => (parseAmount(v) ?? 0) <= max + 0.001, `You can approve at most ${naira(max)}`),
    comments: z.string().trim().max(500, 'Keep the comment under 500 characters'),
  });
}
export type ApproveValues = z.infer<ReturnType<typeof buildApproveSchema>>;

// ---------------------------------------------------------------- paying a payout out

export const disburseSchema = z.object({
  method: z.string().min(1, 'Choose how it is paid out'),
  reference: z.string().trim().max(100, 'Keep the reference under 100 characters'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters'),
});
export type DisburseValues = z.infer<typeof disburseSchema>;
