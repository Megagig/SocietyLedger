import { z } from 'zod';

import { parseAmount } from '@/features/finance/schemas';
import type { AllocationDTO, AllocationKind, AllocationPayload, PenaltyRuleDTO, PenaltyRulePayload, RecordDonationPayload } from '@/types/api/donationsPenalties';

const optionalAmount = z.string().trim().refine((v) => v === '' || parseAmount(v) !== null, 'Enter an amount above ₦0, or leave it blank');
const wholeNumber = (label: string) => z.string().trim().regex(/^\d+$/, `${label} must be a whole number`);

const startOfToday = (now: Date = new Date()): number => {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

/** True when `iso` is a day before today. */
export const dateInPast = (iso: string, now: Date = new Date()): boolean => {
  const picked = new Date(iso);
  picked.setHours(0, 0, 0, 0);
  return picked.getTime() < startOfToday(now);
};

// ---------------------------------------------------------------- recording a donation

export const recordDonationSchema = z
  .object({
    member: z.object({ id: z.number(), name: z.string() }).nullable().refine((v): boolean => v !== null, 'Choose the donor'),
    donationType: z.enum(['instant', 'pledge']),
    amount: z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0'),
    allocationId: z.string(),
    paymentMethod: z.string(),
    pledgeDate: z.string(),
    donorMessage: z.string().trim().max(300, 'Keep the message under 300 characters'),
    isAnonymous: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.donationType === 'pledge' && values.pledgeDate && dateInPast(values.pledgeDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pledgeDate'], message: "A pledge date can't be in the past" });
    }
  });

export type RecordDonationValues = z.infer<typeof recordDonationSchema>;

export function emptyDonationValues(): RecordDonationValues {
  return { member: null, donationType: 'instant', amount: '', allocationId: '', paymentMethod: 'cash', pledgeDate: '', donorMessage: '', isAnonymous: false };
}

export function toDonationPayload(values: RecordDonationValues, categoryId: number): RecordDonationPayload {
  const instant = values.donationType === 'instant';
  return {
    memberId: values.member!.id,
    categoryId,
    amount: parseAmount(values.amount) ?? 0,
    allocationId: values.allocationId ? Number(values.allocationId) : undefined,
    donorMessage: values.donorMessage.trim() || undefined,
    isAnonymous: values.isAnonymous,
    donationType: values.donationType,
    paymentMethod: instant ? values.paymentMethod : undefined,
    pledgeDate: !instant && values.pledgeDate ? new Date(values.pledgeDate).toISOString() : undefined,
  };
}

// ---------------------------------------------------------------- a fund (allocation)

export const allocationFormSchema = z.object({
  name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
  type: z.string().min(1, 'Choose the kind'),
  targetAmount: optionalAmount,
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
  isActive: z.boolean(),
});

export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

export const emptyAllocationValues = (): AllocationFormValues => ({ name: '', type: 'project', targetAmount: '', description: '', isActive: true });

export function allocationToFormValues(allocation: AllocationDTO): AllocationFormValues {
  return {
    name: allocation.name,
    type: allocation.type,
    targetAmount: allocation.targetAmount === null ? '' : String(Number(allocation.targetAmount)),
    description: allocation.description ?? '',
    isActive: allocation.isActive,
  };
}

export function toAllocationPayload(values: AllocationFormValues): AllocationPayload {
  return {
    name: values.name.trim(),
    type: values.type as AllocationKind,
    targetAmount: parseAmount(values.targetAmount) ?? undefined,
    description: values.description.trim() || undefined,
    isActive: values.isActive,
  };
}

// ---------------------------------------------------------------- a late-fee rule

export const ruleFormSchema = z
  .object({
    name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
    categoryId: z.string(),
    gracePeriodDays: wholeNumber('Grace period'),
    feeType: z.enum(['fixed', 'percentage']),
    feeAmount: z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter the fee, above 0'),
    maxFeeAmount: optionalAmount,
    isCompounding: z.boolean(),
    compoundingDays: z.string().trim(),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const fee = parseAmount(values.feeAmount);
    if (values.feeType === 'percentage' && fee !== null && fee > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feeAmount'], message: 'A percentage can be at most 100' });
    }
    if (values.isCompounding && !/^[1-9]\d*$/.test(values.compoundingDays)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compoundingDays'], message: 'Enter how many days between fees' });
    }
  });

export type RuleFormValues = z.infer<typeof ruleFormSchema>;

export const emptyRuleValues = (): RuleFormValues => ({
  name: '', categoryId: '', gracePeriodDays: '7', feeType: 'fixed', feeAmount: '', maxFeeAmount: '', isCompounding: false, compoundingDays: '30', description: '', isActive: true,
});

export function ruleToFormValues(rule: PenaltyRuleDTO): RuleFormValues {
  return {
    name: rule.name,
    categoryId: rule.categoryId === null ? '' : String(rule.categoryId),
    gracePeriodDays: String(rule.gracePeriodDays),
    feeType: rule.feeType,
    feeAmount: String(Number(rule.feeAmount)),
    maxFeeAmount: rule.maxFeeAmount === null ? '' : String(Number(rule.maxFeeAmount)),
    isCompounding: rule.isCompounding,
    compoundingDays: String(rule.compoundingDays ?? 30),
    description: rule.description ?? '',
    isActive: rule.isActive,
  };
}

export function toRulePayload(values: RuleFormValues): PenaltyRulePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    categoryId: values.categoryId ? Number(values.categoryId) : undefined,
    triggerType: 'late_payment',
    gracePeriodDays: Number(values.gracePeriodDays),
    feeType: values.feeType,
    feeAmount: parseAmount(values.feeAmount) ?? 0,
    maxFeeAmount: values.feeType === 'percentage' ? (parseAmount(values.maxFeeAmount) ?? undefined) : undefined,
    isCompounding: values.isCompounding,
    compoundingDays: values.isCompounding ? Number(values.compoundingDays) : undefined,
    isActive: values.isActive,
  };
}

// ---------------------------------------------------------------- waiving a penalty

/** The waiver form for a penalty with `owed` naira still to pay: the amount can't be more than that, and a reason is needed. */
export function buildWaiveSchema(owed: number) {
  return z.object({
    amount: z
      .string()
      .trim()
      .refine((v) => parseAmount(v) !== null, 'Enter an amount above ₦0')
      .refine((v) => (parseAmount(v) ?? 0) <= owed + 0.001, `You can waive at most ₦${owed.toLocaleString('en-NG', { minimumFractionDigits: 2 })}, which is what is still owed`),
    reason: z.string().trim().min(5, 'Say why you are waiving it (at least 5 characters)').max(300, 'Keep the reason under 300 characters'),
  });
}

export type WaiveFormValues = z.infer<ReturnType<typeof buildWaiveSchema>>;
