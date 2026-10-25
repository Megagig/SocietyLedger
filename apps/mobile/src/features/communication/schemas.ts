import { z } from 'zod';

import type {
  AnnouncementAudience,
  AnnouncementPayload,
  AnnouncementPriority,
  CampaignPayload,
  SmsRecipientFilter,
  SmsRecipientType,
  SmsTemplateCategory,
  TemplatePayload,
} from '@/types/api/communication';
import { parseNumbers } from './labels';

// ---------------------------------------------------------------- who it goes to

/** What the officer has picked as the audience: the kind, and what that kind needs. */
export type AudienceDraft = {
  type: string;
  categories: string[];
  memberIds: number[];
  /** Phone numbers typed or pasted (only for "Phone numbers"). */
  numbers: string;
};

export const emptyAudience = (type: string): AudienceDraft => ({ type, categories: [], memberIds: [], numbers: '' });

/** Why this audience can't be used yet, or null. Named audiences must name someone: an empty pick is never treated as "everyone". */
export function audienceProblem(a: AudienceDraft): string | null {
  if (a.type === 'CATEGORY' || a.type === 'MEMBER_CATEGORY') return a.categories.length === 0 ? 'Pick at least one category' : null;
  if (a.type === 'SELECTED' || a.type === 'SELECTED_MEMBERS') return a.memberIds.length === 0 ? 'Choose at least one member' : null;
  if (a.type === 'CUSTOM_NUMBERS') return parseNumbers(a.numbers).length === 0 ? 'Add at least one phone number' : null;
  return null;
}

/** The filter the texting endpoints expect for this audience. */
export function toRecipientFilter(a: AudienceDraft): SmsRecipientFilter | undefined {
  if (a.type === 'MEMBER_CATEGORY') return { categories: a.categories };
  if (a.type === 'SELECTED_MEMBERS') return { memberIds: a.memberIds };
  if (a.type === 'CUSTOM_NUMBERS') return { customNumbers: parseNumbers(a.numbers) };
  return undefined;
}

// ---------------------------------------------------------------- an announcement

export const announcementFormSchema = z.object({
  title: z.string().trim().min(1, 'Give it a title').max(200, 'Keep the title under 200 characters'),
  message: z.string().trim().min(1, 'Write the message').max(2000, 'Keep the message under 2,000 characters'),
  smsText: z.string().trim().max(1000, 'Keep the text under 1,000 characters'),
  sendEmail: z.boolean(),
  sendSms: z.boolean(),
});
export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;
export const emptyAnnouncementValues = (): AnnouncementFormValues => ({ title: '', message: '', smsText: '', sendEmail: false, sendSms: false });

export type AnnouncementDraft = {
  values: AnnouncementFormValues;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  categories: string[];
  memberIds: number[];
};

export function toAnnouncementPayload(d: AnnouncementDraft): AnnouncementPayload {
  const smsText = d.values.sendSms ? d.values.smsText.trim() : '';
  return {
    title: d.values.title.trim(),
    message: d.values.message.trim(),
    priority: d.priority,
    audience: d.audience,
    ...(d.audience === 'CATEGORY' ? { categories: d.categories } : {}),
    ...(d.audience === 'SELECTED' ? { memberIds: d.memberIds } : {}),
    sendEmail: d.values.sendEmail,
    sendSms: d.values.sendSms,
    ...(smsText ? { smsText } : {}),
  };
}

/** Ready to ask the server about: the words are there and the audience names someone. */
export function announcementReady(d: AnnouncementDraft): boolean {
  return !!d.values.title.trim() && !!d.values.message.trim() && audienceProblem({ type: d.audience, categories: d.categories, memberIds: d.memberIds, numbers: '' }) === null;
}

// ---------------------------------------------------------------- a quick text

export const quickSmsSchema = z.object({
  message: z.string().trim().min(1, 'Write the message').max(918, 'That is too long for a text. Keep it under 918 characters'),
  numbers: z.string(),
});
export type QuickSmsValues = z.infer<typeof quickSmsSchema>;

// ---------------------------------------------------------------- a campaign

export const campaignFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the campaign a name').max(100, 'Keep the name under 100 characters'),
  message: z.string().trim().min(1, 'Write the message').max(918, 'That is too long for a text. Keep it under 918 characters'),
  numbers: z.string(),
  scheduledAt: z.string(),
});
export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
export const emptyCampaignValues = (): CampaignFormValues => ({ name: '', message: '', numbers: '', scheduledAt: '' });

export function toCampaignPayload(values: CampaignFormValues, audience: AudienceDraft, templateId?: number): CampaignPayload {
  const filter = toRecipientFilter({ ...audience, numbers: values.numbers });
  return {
    name: values.name.trim(),
    message: values.message.trim(),
    recipientType: audience.type as SmsRecipientType,
    ...(filter ? { recipientFilter: filter } : {}),
    ...(templateId ? { templateId } : {}),
    ...(values.scheduledAt ? { scheduledAt: new Date(values.scheduledAt).toISOString() } : {}),
  };
}

// ---------------------------------------------------------------- a template

export const templateFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the template a name').max(100, 'Keep the name under 100 characters'),
  content: z.string().trim().min(1, 'Write the message').max(918, 'That is too long for a text. Keep it under 918 characters'),
  category: z.string().min(1, 'Choose a category'),
});
export type TemplateFormValues = z.infer<typeof templateFormSchema>;
export const emptyTemplateValues = (): TemplateFormValues => ({ name: '', content: '', category: 'GENERAL' });

/** The {placeholders} in the wording, so the server knows what a template fills in. */
export function placeholdersIn(content: string): string[] {
  return [...new Set([...content.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string))];
}

export function toTemplatePayload(values: TemplateFormValues): TemplatePayload {
  return {
    name: values.name.trim(),
    content: values.content.trim(),
    category: values.category as SmsTemplateCategory,
    placeholders: placeholdersIn(values.content),
  };
}
