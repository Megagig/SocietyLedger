import { z } from 'zod';

import { parseAmount } from '@/features/finance/schemas';
import type { CampaignDetailDTO, CategoryDTO, CategoryKind, CategoryPayload, CreateCampaignPayload } from '@/types/api/financeSetup';

/** An amount typed in a field that may be left blank: blank is fine, anything typed must be a real amount above ₦0. */
const optionalAmount = z.string().trim().refine((v) => v === '' || parseAmount(v) !== null, 'Enter an amount above ₦0, or leave it blank');

// ---------------------------------------------------------------- a category

export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
  type: z.string().min(1, 'Choose the type'),
  amount: optionalAmount,
  frequency: z.string(),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
  isActive: z.boolean(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function emptyCategoryValues(type: CategoryKind = 'due'): CategoryFormValues {
  return { name: '', type, amount: '', frequency: type === 'due' ? 'monthly' : 'one-time', description: '', isActive: true };
}

export function categoryToFormValues(category: CategoryDTO): CategoryFormValues {
  return {
    name: category.name,
    type: category.type,
    amount: category.amount === null ? '' : String(Number(category.amount)),
    frequency: category.frequency ?? '',
    description: category.description ?? '',
    isActive: category.isActive,
  };
}

export function toCategoryPayload(values: CategoryFormValues): CategoryPayload {
  return {
    name: values.name.trim(),
    type: values.type as CategoryKind,
    amount: values.amount.trim() === '' ? null : parseAmount(values.amount),
    frequency: (values.frequency || null) as CategoryPayload['frequency'],
    description: values.description.trim() || null,
    isActive: values.isActive,
  };
}

// ---------------------------------------------------------------- a levy campaign

/** True when `iso` is a day before today — the API refuses a deadline that has already passed. */
export function deadlineInPast(iso: string, now: Date = new Date()): boolean {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const picked = new Date(iso);
  picked.setHours(0, 0, 0, 0);
  return picked.getTime() < today.getTime();
}

export const campaignFormSchema = z.object({
  name: z.string().trim().min(2, 'The name needs at least 2 characters').max(100, 'Keep the name under 100 characters'),
  categoryId: z.string().min(1, 'Choose the levy category'),
  targetAmount: z.string().trim().refine((v) => parseAmount(v) !== null, 'Enter the total to raise, above ₦0'),
  amountPerMember: optionalAmount,
  deadline: z.string().min(1, 'Choose the deadline'),
  description: z.string().trim().max(500, 'Keep the description under 500 characters'),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export function emptyCampaignValues(): CampaignFormValues {
  return { name: '', categoryId: '', targetAmount: '', amountPerMember: '', deadline: '', description: '' };
}

export function campaignToFormValues(campaign: CampaignDetailDTO): CampaignFormValues {
  return {
    name: campaign.name,
    categoryId: String(campaign.category.id),
    targetAmount: String(Number(campaign.targetAmount)),
    amountPerMember: campaign.amountPerMember === null ? '' : String(Number(campaign.amountPerMember)),
    deadline: campaign.deadline,
    description: campaign.description ?? '',
  };
}

export function toCampaignPayload(values: CampaignFormValues): CreateCampaignPayload {
  const perMember = parseAmount(values.amountPerMember);
  return {
    categoryId: Number(values.categoryId),
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    targetAmount: parseAmount(values.targetAmount) ?? 0,
    amountPerMember: perMember ?? undefined,
    deadline: new Date(values.deadline).toISOString(),
  };
}

// ---------------------------------------------------------------- assigning members

export const assignFormSchema = z.object({ amount: optionalAmount });
export type AssignFormValues = z.infer<typeof assignFormSchema>;

/** The amount each member is charged: the one typed here, else the campaign's own; null when neither exists. */
export function assignAmount(typed: string, campaignPerMember: string | number | null): number | null {
  return parseAmount(typed) ?? (campaignPerMember === null ? null : Number(campaignPerMember) || null);
}
