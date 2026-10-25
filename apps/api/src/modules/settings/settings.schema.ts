/**
 * What each settings category accepts, and who may change it.
 *
 * Settings used to be saved as whatever the caller sent: any key, any type, any size, and `platform.*` keys that belong to the
 * SocietyLedger staff. A value that is not in these tables is refused with a plain message instead of being stored.
 */

import { z } from 'zod';
import { ASSOCIATION_TYPE_KEYS, CUSTOM_ASSOCIATION_TYPE_MAX } from '@societyledger/shared';
import { PERMISSIONS } from '../../lib/permissions';
import { RuleError } from '../finance/rule-error';
import type { SettingsCategory } from './settings.types';

/** An optional text field: an empty string clears it. */
const text = (max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(max, `Use ${max} characters or fewer.`).nullable().optional());

const hexColour = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #1a7f5a.').nullable().optional(),
);

/** A text field the web sends as "" when it is empty: that means cleared, not a bad value. */
const blankToNull = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), schema);

const month = z.number().int().min(1, 'Choose a month.').max(12, 'Choose a month.');
const days = (max: number) => z.number().int().min(0, 'Use 0 or more.').max(max, `Use ${max} or fewer.`);

// One list for signup and for Settings on every platform (packages/shared/src/association-signup.ts).
export const ASSOCIATION_TYPES = ASSOCIATION_TYPE_KEYS;
export const PAYMENT_CHANNELS = ['bank_transfer', 'cash', 'card', 'mobile_money', 'cheque'] as const;
export const DEFAULT_ROLES = ['member', 'financial_secretary', 'treasurer'] as const;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The association's profile. The logo is changed only by the upload and delete routes, never by a saved value. */
export const associationProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'The name needs at least 2 characters.').max(120, 'The name can be 120 characters at most.').optional(),
    primaryColor: hexColour,
    secondaryColor: hexColour,
    associationType: z.enum(ASSOCIATION_TYPES).optional(),
    // What they call it themselves, when the type is "other".
    customAssociationType: blankToNull(z.string().trim().max(CUSTOM_ASSOCIATION_TYPE_MAX, `Use ${CUSTOM_ASSOCIATION_TYPE_MAX} characters or fewer.`).nullable().optional()),
    address: text(200),
    city: text(80),
    state: text(80),
    country: text(80),
    phone: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a phone number with 7 to 20 digits.').nullable().optional(),
    ),
    email: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().email('Enter a valid email address.').max(160).nullable().optional()),
    website: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().max(200).regex(/^https?:\/\/\S+$/i, 'Start the website with http:// or https://.').nullable().optional(),
    ),
    fiscalYearStart: month.optional(),
    timezone: z.string().trim().max(60).refine(isTimeZone, 'Choose a real time zone, like Africa/Lagos.').optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, like NGN.').optional(),
    // The web form sends the logo back with the rest; it is read and dropped, never stored from here.
    logo: z.unknown().optional(),
  })
  .strict();

export const membersAccessSchema = z
  .object({
    selfSignupEnabled: z.boolean(),
    defaultRole: z.enum(DEFAULT_ROLES),
    requireApproval: z.boolean(),
    requireEmailVerification: z.boolean(),
    inviteExpiryHours: z.number().int().min(1, 'An invite lasts at least 1 hour.').max(24 * 30, 'An invite can last 30 days at most.'),
    allowMultipleRoles: z.boolean(),
    memberIdPrefix: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,8}$/, 'Use 1 to 8 letters or numbers.').nullable().optional(),
    ),
    memberIdAutoGenerate: z.boolean(),
  })
  .partial()
  .strict();

export const financialSchema = z
  .object({
    defaultGracePeriodDays: days(365),
    enableLateFees: z.boolean(),
    lateFeeType: z.enum(['fixed', 'percentage']),
    lateFeeAmount: z.number().min(0, 'A late fee cannot be negative.').max(100_000_000, 'That late fee is too large.'),
    maxLateFeeAmount: z.number().min(0).max(100_000_000).nullable(),
    enablePartialPayments: z.boolean(),
    requirePaymentApproval: z.boolean(),
    approvalThreshold: z.number().min(0).max(100_000_000_000).nullable(),
    receiptRequiredAbove: z.number().min(0, 'The receipt limit cannot be negative.').max(100_000_000_000, 'That receipt limit is too large.'),
    fiscalYearStart: month,
    currencyCode: z.string().trim().regex(/^[A-Z]{3}$/),
    currencySymbol: z.string().trim().min(1).max(4),
    decimalPlaces: z.number().int().min(0).max(4),
  })
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (value.lateFeeType === 'percentage' && typeof value.lateFeeAmount === 'number' && value.lateFeeAmount > 100) {
      ctx.addIssue({ code: 'custom', path: ['lateFeeAmount'], message: 'A percentage late fee cannot be more than 100.' });
    }
  });

export const paymentsSchema = z
  .object({
    enabledChannels: z.array(z.enum(PAYMENT_CHANNELS)).max(PAYMENT_CHANNELS.length),
    defaultPaymentMethod: z.enum(PAYMENT_CHANNELS),
    enableManualPayments: z.boolean(),
    manualPaymentApprovalRequired: z.boolean(),
    enablePartialPayments: z.boolean(),
    minimumPaymentAmount: z.number().min(0).max(100_000_000).nullable(),
    receiptPrefix: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/).nullable().optional(),
    ),
    receiptAutoGenerate: z.boolean(),
    cashLodgmentDueDays: days(60),
  })
  .partial()
  .strict();

export const notificationsSchema = z
  .object({
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    paymentReminderDays: z.array(z.number().int().min(1, 'Use 1 or more days.').max(60, 'Use 60 or fewer days.')).max(6, 'Use at most 6 reminders.'),
    overdueReminderFrequency: z.enum(['daily', 'weekly', 'monthly', 'none']),
    quietHoursStart: blankToNull(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 22:00.').nullable()),
    quietHoursEnd: blankToNull(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:00.').nullable()),
    senderName: z.string().trim().min(2, 'The sender name needs at least 2 characters.').max(40, 'The sender name can be 40 characters at most.'),
    senderEmail: blankToNull(z.string().trim().email('Enter a valid email address.').max(160).nullable()),
  })
  .partial()
  .strict();

export const integrationsSchema = z
  .object({
    paystackEnabled: z.boolean(),
    paystackPublicKey: blankToNull(z.string().trim().max(200).nullable()),
    nombaEnabled: z.boolean(),
    nombaAccountId: blankToNull(z.string().trim().max(120).nullable()),
    smsProvider: z.enum(['termii', 'none']),
    webhookUrl: blankToNull(z.string().trim().max(300).regex(/^https:\/\/\S+$/i, 'A webhook address must start with https://.').nullable()),
    apiAccessEnabled: z.boolean(),
  })
  .partial()
  .strict();

export const dataPrivacySchema = z
  .object({
    dataRetentionMonths: z.number().int().min(12, 'Keep records for at least 12 months.').max(240),
    softDeleteEnabled: z.boolean(),
    anonymizeInactiveMembers: z.boolean(),
    anonymizeAfterMonths: z.number().int().min(1).max(240).nullable(),
    allowDataExport: z.boolean(),
    gdprCompliant: z.boolean(),
  })
  .partial()
  .strict();

const SCHEMAS: Partial<Record<SettingsCategory, z.ZodTypeAny>> = {
  association: associationProfileSchema,
  members_access: membersAccessSchema,
  financial: financialSchema,
  payments: paymentsSchema,
  notifications: notificationsSchema,
  integrations: integrationsSchema,
  data_privacy: dataPrivacySchema,
};

/**
 * Who may change each category. `platform` is not here on purpose: those keys belong to SocietyLedger's own staff and a
 * tenant can never write them. Payments follow the billing permission or the general edit permission, as the web always did.
 */
export const SETTINGS_WRITE_PERMISSIONS: Partial<Record<SettingsCategory, string[]>> = {
  association: [PERMISSIONS.SETTINGS_EDIT],
  members_access: [PERMISSIONS.SETTINGS_EDIT],
  financial: [PERMISSIONS.SETTINGS_EDIT],
  payments: [PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.SETTINGS_BILLING],
  notifications: [PERMISSIONS.SETTINGS_EDIT],
  integrations: [PERMISSIONS.SETTINGS_INTEGRATIONS],
  data_privacy: [PERMISSIONS.SETTINGS_EDIT],
};

/** Who may read each category. Integrations hold only public identifiers (no secret keys are stored here), so anyone who can view settings may read them. */
export const SETTINGS_READ_PERMISSIONS: Partial<Record<SettingsCategory, string[]>> = {
  association: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT],
  members_access: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT],
  financial: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT],
  payments: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.SETTINGS_BILLING],
  notifications: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT],
  integrations: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT, PERMISSIONS.SETTINGS_INTEGRATIONS],
  data_privacy: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT],
};

const FIELD_NAMES: Record<string, string> = {
  name: 'Name',
  primaryColor: 'Brand colour',
  secondaryColor: 'Second colour',
  lateFeeAmount: 'Late fee',
  defaultGracePeriodDays: 'Grace period',
  inviteExpiryHours: 'Invite lifetime',
  memberIdPrefix: 'Member ID prefix',
  cashLodgmentDueDays: 'Cash lodgment days',
  paymentReminderDays: 'Reminder days',
  senderName: 'Sender name',
  senderEmail: 'Sender email',
  enabledChannels: 'Payment methods',
};

/**
 * Checks a category's body and returns only the values it accepts. Anything unknown, mistyped or out of range is refused with a
 * 400 `INVALID_SETTINGS` that names the first few problems in plain words.
 */
export function validateSettings(category: SettingsCategory, body: unknown): Record<string, unknown> {
  const schema = SCHEMAS[category];
  if (!schema) throw new RuleError('These settings cannot be changed here.', 403, 'SETTINGS_NOT_EDITABLE');
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new RuleError('Send the settings as an object.', 400, 'INVALID_SETTINGS');

  const result = schema.safeParse(body);
  if (!result.success) {
    const lines = result.error.issues.slice(0, 3).map((issue) => {
      if (issue.code === 'unrecognized_keys') return `${issue.keys.join(', ')} ${issue.keys.length === 1 ? 'is' : 'are'} not a setting you can change.`;
      const key = String(issue.path[0] ?? '');
      const label = FIELD_NAMES[key] ?? key;
      return label ? `${label}: ${issue.message}` : issue.message;
    });
    throw new RuleError(lines.join(' '), 400, 'INVALID_SETTINGS');
  }

  const data = { ...(result.data as Record<string, unknown>) };
  delete data.logo;
  return data;
}
