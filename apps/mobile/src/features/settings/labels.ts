import { ASSOCIATION_TYPES, associationTypeLabel as sharedAssociationTypeLabel } from '@societyledger/shared';

import type { PermissionAlias } from '@/lib/permissions';
import type {
  AssociationType,
  DefaultRole,
  LateFeeType,
  PaymentChannel,
  ReminderFrequency,
  SubscriptionDTO,
  SubscriptionStatus,
} from '@/types/api/settings';

/** Reading any settings screen (`settings.view`). */
export const SETTINGS_VIEW_ACCESS: PermissionAlias = 'SETTINGS_VIEW';
/** Saving a change (`settings.edit`). Payments also accepts `settings.billing`, as the server does. */
export const SETTINGS_EDIT_ACCESS: PermissionAlias = 'SETTINGS_EDIT';
export const PAYMENTS_EDIT_ACCESS: PermissionAlias[] = ['SETTINGS_EDIT', 'SETTINGS_BILLING'];
/** Opening a settings screen to look at it: the server lets `settings.view` read every category. */
export const SETTINGS_READ_ACCESS: PermissionAlias[] = ['SETTINGS_VIEW', 'SETTINGS_EDIT'];
export const PAYMENTS_READ_ACCESS: PermissionAlias[] = ['SETTINGS_VIEW', 'SETTINGS_EDIT', 'SETTINGS_BILLING'];
/** The subscription screen is read-only and shows what billing is (`settings.billing`; `settings.view` is enough on the server). */
export const SUBSCRIPTION_ACCESS: PermissionAlias[] = ['SETTINGS_BILLING', 'SETTINGS_VIEW'];
/** Anything that makes Settings appear in Manage: the settings screens, roles, the audit log. */
export const SETTINGS_HUB_ACCESS: PermissionAlias[] = ['SETTINGS_VIEW', 'SETTINGS_EDIT', 'SETTINGS_BILLING', 'ROLES_VIEW', 'AUDIT_VIEW'];

export const ASSOCIATION_TYPE_OPTIONS: { label: string; value: AssociationType }[] = ASSOCIATION_TYPES.map((t) => ({ label: t.label, value: t.key }));

export const LATE_FEE_TYPE_OPTIONS: { label: string; value: LateFeeType }[] = [
  { label: 'A fixed amount', value: 'fixed' },
  { label: 'A percentage of the charge', value: 'percentage' },
];

export const PAYMENT_CHANNEL_OPTIONS: { label: string; value: PaymentChannel; helper: string }[] = [
  { label: 'Bank transfer', value: 'bank_transfer', helper: 'Members pay into your bank account and send a receipt' },
  { label: 'Cash', value: 'cash', helper: 'Officers collect and record cash' },
  { label: 'Card (Paystack)', value: 'card', helper: 'Members pay online by card' },
  { label: 'Mobile money', value: 'mobile_money', helper: 'Transfers from a mobile wallet' },
  { label: 'Cheque', value: 'cheque', helper: 'Cheques that officers record' },
];

export const REMINDER_FREQUENCY_OPTIONS: { label: string; value: ReminderFrequency }[] = [
  { label: 'Every day', value: 'daily' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every month', value: 'monthly' },
  { label: 'Never', value: 'none' },
];

export const DEFAULT_ROLE_OPTIONS: { label: string; value: DefaultRole }[] = [
  { label: 'Member', value: 'member' },
  { label: 'Financial secretary', value: 'financial_secretary' },
  { label: 'Treasurer', value: 'treasurer' },
];

export function associationTypeLabel(type: AssociationType | undefined, customType?: string | null): string {
  return sharedAssociationTypeLabel(type, customType);
}

/** "7, 3, 1" → [7, 3, 1]: whole days from 1 to 60, no repeats, biggest first. Anything else is dropped. */
export function parseReminderDays(text: string): number[] {
  const days = text
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
  return [...new Set(days)].sort((a, b) => b - a);
}

/** [7, 3, 1] → "7, 3, 1". */
export function formatReminderDays(days: number[]): string {
  return days.join(', ');
}

/** "7 days before it is due, then 3 days, then 1 day". */
export function describeReminderDays(days: number[]): string {
  if (days.length === 0) return 'No reminders before a charge is due';
  const [first, ...rest] = days;
  const list = [`${first} ${first === 1 ? 'day' : 'days'} before it is due`, ...rest.map((d) => `${d} ${d === 1 ? 'day' : 'days'}`)];
  return list.join(', then ');
}

export function frequencyLabel(value: ReminderFrequency | undefined): string {
  return REMINDER_FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? 'Every week';
}

export function inviteLifetimeLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** The line that says what happens next: when the plan renews, when it ends, or when the free trial stops. */
export function describeNextStep(s: SubscriptionDTO): { label: string; date: string } {
  if (s.status === 'TRIALING' && s.trialEndsAt) return { label: 'Free trial ends', date: s.trialEndsAt };
  if (s.cancelAtPeriodEnd) return { label: 'Ends on', date: s.currentPeriodEnd };
  if (s.status === 'CANCELED' || s.status === 'EXPIRED') return { label: 'Ended on', date: s.currentPeriodEnd };
  return { label: s.status === 'PAST_DUE' ? 'Payment was due' : 'Renews on', date: s.renewalDate ?? s.currentPeriodEnd };
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Free trial',
  PAST_DUE: 'Payment overdue',
  CANCELED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const SUBSCRIPTION_STATUS_TONE: Record<SubscriptionStatus, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  ACTIVE: 'success',
  TRIALING: 'info',
  PAST_DUE: 'warning',
  CANCELED: 'neutral',
  EXPIRED: 'danger',
};
