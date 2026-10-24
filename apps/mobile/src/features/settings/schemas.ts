import { z } from 'zod';

import type {
  AssociationProfileDTO,
  AssociationProfilePayload,
  AssociationType,
  DefaultRole,
  FinancialSettingsDTO,
  LateFeeType,
  MembersAccessSettingsDTO,
  NotificationsSettingsDTO,
  PaymentChannel,
  PaymentsSettingsDTO,
  ReminderFrequency,
} from '@/types/api/settings';
import { formatReminderDays, parseReminderDays } from './labels';

// These mirror the server's own checks (settings.schema.ts) so a bad value is caught on the phone with the same words.

const blankToNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());
const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .refine((v) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max, `Use a whole number from ${min} to ${max}`);

// ---------------------------------------------------------------- ST2 association profile

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'The name needs at least 2 characters').max(120, 'The name can be 120 characters at most'),
  associationType: z.string().min(1, 'Choose a type'),
  primaryColor: z
    .string()
    .trim()
    .refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Use a colour like #1a7f5a'),
  address: z.string().trim().max(200, 'Use 200 characters or fewer'),
  city: z.string().trim().max(80, 'Use 80 characters or fewer'),
  state: z.string().trim().max(80, 'Use 80 characters or fewer'),
  country: z.string().trim().max(80, 'Use 80 characters or fewer'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+()\-\s]{7,20}$/.test(v), 'Enter a phone number with 7 to 20 digits'),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address'),
  website: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Start the website with http:// or https://'),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function profileToFormValues(profile: AssociationProfileDTO): ProfileFormValues {
  return {
    name: profile.name,
    associationType: profile.associationType ?? 'general',
    primaryColor: profile.primaryColor ?? '',
    address: profile.address ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    website: profile.website ?? '',
  };
}

export function toProfilePayload(values: ProfileFormValues): AssociationProfilePayload {
  return {
    name: values.name.trim(),
    associationType: values.associationType as AssociationType,
    primaryColor: blankToNull(values.primaryColor),
    address: blankToNull(values.address),
    city: blankToNull(values.city),
    state: blankToNull(values.state),
    country: blankToNull(values.country),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    website: blankToNull(values.website),
  };
}

// ---------------------------------------------------------------- ST3 financial

export const financialFormSchema = z
  .object({
    enableLateFees: z.boolean(),
    lateFeeType: z.string().min(1),
    lateFeeAmount: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 100_000_000), 'Enter an amount like 500 or 2.5'),
    defaultGracePeriodDays: wholeNumber('the grace period in days', 0, 365),
    enablePartialPayments: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.enableLateFees && (v.lateFeeAmount === '' || Number(v.lateFeeAmount) <= 0)) {
      ctx.addIssue({ code: 'custom', path: ['lateFeeAmount'], message: 'Enter the late fee, or switch late fees off' });
    }
    if (v.lateFeeType === 'percentage' && Number(v.lateFeeAmount) > 100) {
      ctx.addIssue({ code: 'custom', path: ['lateFeeAmount'], message: 'A percentage cannot be more than 100' });
    }
  });
export type FinancialFormValues = z.infer<typeof financialFormSchema>;

export function financialToFormValues(s: FinancialSettingsDTO): FinancialFormValues {
  return {
    enableLateFees: s.enableLateFees,
    lateFeeType: s.lateFeeType,
    lateFeeAmount: s.lateFeeAmount ? String(s.lateFeeAmount) : '',
    defaultGracePeriodDays: String(s.defaultGracePeriodDays),
    enablePartialPayments: s.enablePartialPayments,
  };
}

export function toFinancialPayload(v: FinancialFormValues): FinancialSettingsDTO {
  return {
    enableLateFees: v.enableLateFees,
    lateFeeType: v.lateFeeType as LateFeeType,
    lateFeeAmount: v.lateFeeAmount === '' ? 0 : Number(v.lateFeeAmount),
    defaultGracePeriodDays: Number(v.defaultGracePeriodDays),
    enablePartialPayments: v.enablePartialPayments,
  };
}

// ---------------------------------------------------------------- ST4 payments

export const paymentsFormSchema = z
  .object({
    bank_transfer: z.boolean(),
    cash: z.boolean(),
    card: z.boolean(),
    mobile_money: z.boolean(),
    cheque: z.boolean(),
    enablePartialPayments: z.boolean(),
    receiptAutoGenerate: z.boolean(),
    cashLodgmentDueDays: wholeNumber('the days to lodge cash', 0, 60),
  })
  .refine((v) => v.bank_transfer || v.cash || v.card || v.mobile_money || v.cheque, {
    path: ['bank_transfer'],
    message: 'Keep at least one way to pay switched on',
  });
export type PaymentsFormValues = z.infer<typeof paymentsFormSchema>;

const CHANNELS: PaymentChannel[] = ['bank_transfer', 'cash', 'card', 'mobile_money', 'cheque'];

export function paymentsToFormValues(s: PaymentsSettingsDTO): PaymentsFormValues {
  // An empty list means every method is accepted (the server treats it that way), so show them all as on.
  const all = s.enabledChannels.length === 0;
  const has = (c: PaymentChannel) => all || s.enabledChannels.includes(c);
  return {
    bank_transfer: has('bank_transfer'),
    cash: has('cash'),
    card: has('card'),
    mobile_money: has('mobile_money'),
    cheque: has('cheque'),
    enablePartialPayments: s.enablePartialPayments,
    receiptAutoGenerate: s.receiptAutoGenerate,
    cashLodgmentDueDays: String(s.cashLodgmentDueDays ?? 3),
  };
}

/** The methods switched on. Never an empty list: that would silently mean "everything", the opposite of what switching all off says. */
export function enabledChannelsOf(v: PaymentsFormValues): PaymentChannel[] {
  return CHANNELS.filter((c) => v[c]);
}

export function toPaymentsPayload(v: PaymentsFormValues): PaymentsSettingsDTO {
  return {
    enabledChannels: enabledChannelsOf(v),
    enablePartialPayments: v.enablePartialPayments,
    receiptAutoGenerate: v.receiptAutoGenerate,
    cashLodgmentDueDays: Number(v.cashLodgmentDueDays),
  };
}

// ---------------------------------------------------------------- ST5 notifications

export const notificationsFormSchema = z.object({
  emailEnabled: z.boolean(),
  paymentReminderDays: z
    .string()
    .trim()
    .refine((v) => v === '' || parseReminderDays(v).length > 0, 'Use whole days from 1 to 60, like 7, 3, 1')
    .refine((v) => parseReminderDays(v).length <= 6, 'Use at most 6 reminders'),
  overdueReminderFrequency: z.string().min(1),
  senderName: z.string().trim().min(2, 'The sender name needs at least 2 characters').max(40, 'The sender name can be 40 characters at most'),
});
export type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

export function notificationsToFormValues(s: NotificationsSettingsDTO): NotificationsFormValues {
  return {
    emailEnabled: s.emailEnabled,
    paymentReminderDays: formatReminderDays(s.paymentReminderDays ?? []),
    overdueReminderFrequency: s.overdueReminderFrequency,
    senderName: s.senderName ?? '',
  };
}

export function toNotificationsPayload(v: NotificationsFormValues): NotificationsSettingsDTO {
  return {
    emailEnabled: v.emailEnabled,
    paymentReminderDays: parseReminderDays(v.paymentReminderDays),
    overdueReminderFrequency: v.overdueReminderFrequency as ReminderFrequency,
    senderName: v.senderName.trim(),
  };
}

// ---------------------------------------------------------------- ST6 members & access

export const membersAccessFormSchema = z
  .object({
    selfSignupEnabled: z.boolean(),
    defaultRole: z.string().min(1),
    inviteExpiryHours: wholeNumber('how many hours an invite lasts', 1, 720),
    allowMultipleRoles: z.boolean(),
    memberIdAutoGenerate: z.boolean(),
    memberIdPrefix: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[A-Za-z0-9]{1,8}$/.test(v), 'Use 1 to 8 letters or numbers'),
  });
export type MembersAccessFormValues = z.infer<typeof membersAccessFormSchema>;

export function membersAccessToFormValues(s: MembersAccessSettingsDTO): MembersAccessFormValues {
  return {
    selfSignupEnabled: s.selfSignupEnabled,
    defaultRole: s.defaultRole,
    inviteExpiryHours: String(s.inviteExpiryHours),
    allowMultipleRoles: s.allowMultipleRoles,
    memberIdAutoGenerate: s.memberIdAutoGenerate,
    memberIdPrefix: s.memberIdPrefix ?? '',
  };
}

export function toMembersAccessPayload(v: MembersAccessFormValues): MembersAccessSettingsDTO {
  return {
    selfSignupEnabled: v.selfSignupEnabled,
    defaultRole: v.defaultRole as DefaultRole,
    inviteExpiryHours: Number(v.inviteExpiryHours),
    allowMultipleRoles: v.allowMultipleRoles,
    memberIdAutoGenerate: v.memberIdAutoGenerate,
    memberIdPrefix: v.memberIdPrefix.trim() === '' ? null : v.memberIdPrefix.trim().toUpperCase(),
  };
}
