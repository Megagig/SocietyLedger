import type { SubscriptionDTO } from '@/types/api/settings';
import { describeNextStep, describeReminderDays, formatReminderDays, inviteLifetimeLabel, parseReminderDays } from './labels';
import {
  enabledChannelsOf,
  financialFormSchema,
  financialToFormValues,
  membersAccessFormSchema,
  membersAccessToFormValues,
  notificationsFormSchema,
  paymentsFormSchema,
  paymentsToFormValues,
  profileFormSchema,
  profileToFormValues,
  toFinancialPayload,
  toMembersAccessPayload,
  toNotificationsPayload,
  toPaymentsPayload,
  toProfilePayload,
} from './schemas';

describe('reminder days', () => {
  it('reads whole days from 1 to 60, biggest first, with no repeats or nonsense', () => {
    expect(parseReminderDays('1, 7, 3, 7')).toEqual([7, 3, 1]);
    expect(parseReminderDays('7 3 1')).toEqual([7, 3, 1]);
    expect(parseReminderDays('0, 61, 2.5, abc, -3')).toEqual([]);
    expect(formatReminderDays([7, 3, 1])).toBe('7, 3, 1');
  });

  it('describes them in plain words', () => {
    expect(describeReminderDays([7, 3, 1])).toBe('7 days before it is due, then 3 days, then 1 day');
    expect(describeReminderDays([1])).toBe('1 day before it is due');
    expect(describeReminderDays([])).toBe('No reminders before a charge is due');
  });

  it('turns hours into days when they divide evenly', () => {
    expect(inviteLifetimeLabel(72)).toBe('3 days');
    expect(inviteLifetimeLabel(24)).toBe('1 day');
    expect(inviteLifetimeLabel(36)).toBe('36 hours');
    expect(inviteLifetimeLabel(1)).toBe('1 hour');
  });
});

describe('profile form', () => {
  const base = profileToFormValues({ name: 'Opuogun Union' });

  it('starts from the saved profile and sends blanks as null so a cleared field clears', () => {
    expect(base.associationType).toBe('general');
    const payload = toProfilePayload({ ...base, phone: '  ', city: ' Lagos ', primaryColor: '' });
    expect(payload).toMatchObject({ name: 'Opuogun Union', phone: null, city: 'Lagos', primaryColor: null });
  });

  it('checks the name, colour, email, website and phone', () => {
    expect(profileFormSchema.safeParse(base).success).toBe(true);
    expect(profileFormSchema.safeParse({ ...base, name: 'A' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, primaryColor: 'green' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, primaryColor: '#1a7f5a' }).success).toBe(true);
    expect(profileFormSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, website: 'ftp://x.org' }).success).toBe(false);
    expect(profileFormSchema.safeParse({ ...base, phone: 'call me' }).success).toBe(false);
  });
});

describe('financial form', () => {
  const settings = { enableLateFees: false, lateFeeType: 'fixed' as const, lateFeeAmount: 0, defaultGracePeriodDays: 7, enablePartialPayments: true };

  it('round-trips the saved settings', () => {
    expect(toFinancialPayload(financialToFormValues(settings))).toEqual(settings);
  });

  it('wants a late fee when late fees are on, and never above 100 for a percentage', () => {
    const on = { ...financialToFormValues(settings), enableLateFees: true };
    expect(financialFormSchema.safeParse(on).success).toBe(false);
    expect(financialFormSchema.safeParse({ ...on, lateFeeAmount: '500' }).success).toBe(true);
    expect(financialFormSchema.safeParse({ ...on, lateFeeType: 'percentage', lateFeeAmount: '150' }).success).toBe(false);
    expect(financialFormSchema.safeParse({ ...on, lateFeeType: 'percentage', lateFeeAmount: '5' }).success).toBe(true);
  });

  it('keeps the grace period a whole number of days', () => {
    const values = financialToFormValues(settings);
    expect(financialFormSchema.safeParse({ ...values, defaultGracePeriodDays: '2.5' }).success).toBe(false);
    expect(financialFormSchema.safeParse({ ...values, defaultGracePeriodDays: '400' }).success).toBe(false);
    expect(financialFormSchema.safeParse({ ...values, defaultGracePeriodDays: '' }).success).toBe(false);
  });
});

describe('payments form', () => {
  const settings = { enabledChannels: ['bank_transfer' as const, 'cash' as const], enablePartialPayments: true, receiptAutoGenerate: true, cashLodgmentDueDays: 3 };

  it('shows only the saved methods as on, and saves them back', () => {
    const values = paymentsToFormValues(settings);
    expect(values).toMatchObject({ bank_transfer: true, cash: true, card: false, mobile_money: false, cheque: false });
    expect(toPaymentsPayload(values)).toEqual(settings);
  });

  it('shows every method as on when the saved list is empty, because the server then accepts them all', () => {
    const values = paymentsToFormValues({ ...settings, enabledChannels: [] });
    expect(enabledChannelsOf(values)).toHaveLength(5);
  });

  it('refuses to switch every method off, since an empty list would mean "all"', () => {
    const off = { ...paymentsToFormValues(settings), bank_transfer: false, cash: false };
    const result = paymentsFormSchema.safeParse(off);
    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.issues[0]?.message).toBe('Keep at least one way to pay switched on');
  });
});

describe('notifications form', () => {
  it('reads the days from text and sends them as numbers', () => {
    const payload = toNotificationsPayload({ emailEnabled: true, paymentReminderDays: '1, 7, 3', overdueReminderFrequency: 'weekly', senderName: ' Opuogun Union ' });
    expect(payload).toEqual({ emailEnabled: true, paymentReminderDays: [7, 3, 1], overdueReminderFrequency: 'weekly', senderName: 'Opuogun Union' });
  });

  it('allows no reminder days at all, but not nonsense or more than six', () => {
    const base = { emailEnabled: true, paymentReminderDays: '', overdueReminderFrequency: 'weekly', senderName: 'Union' };
    expect(notificationsFormSchema.safeParse(base).success).toBe(true);
    expect(notificationsFormSchema.safeParse({ ...base, paymentReminderDays: 'soon' }).success).toBe(false);
    expect(notificationsFormSchema.safeParse({ ...base, paymentReminderDays: '1,2,3,4,5,6,7' }).success).toBe(false);
    expect(notificationsFormSchema.safeParse({ ...base, senderName: 'A' }).success).toBe(false);
  });
});

describe('members and access form', () => {
  const settings = { selfSignupEnabled: false, defaultRole: 'member' as const, inviteExpiryHours: 72, allowMultipleRoles: false, memberIdAutoGenerate: true };

  it('upper-cases the member ID prefix and clears it when blank', () => {
    const values = membersAccessToFormValues(settings);
    expect(toMembersAccessPayload({ ...values, memberIdPrefix: 'ogu' }).memberIdPrefix).toBe('OGU');
    expect(toMembersAccessPayload({ ...values, memberIdPrefix: ' ' }).memberIdPrefix).toBeNull();
  });

  it('keeps an invite between 1 hour and 30 days, and the prefix to 8 letters or numbers', () => {
    const values = membersAccessToFormValues(settings);
    expect(membersAccessFormSchema.safeParse(values).success).toBe(true);
    expect(membersAccessFormSchema.safeParse({ ...values, inviteExpiryHours: '0' }).success).toBe(false);
    expect(membersAccessFormSchema.safeParse({ ...values, inviteExpiryHours: '721' }).success).toBe(false);
    expect(membersAccessFormSchema.safeParse({ ...values, memberIdPrefix: 'TOO-LONG-ONE' }).success).toBe(false);
  });
});

describe('describeNextStep', () => {
  const base: SubscriptionDTO = {
    status: 'ACTIVE',
    billingCycle: 'MONTHLY',
    trialEndsAt: null,
    currentPeriodStart: '2026-10-01T00:00:00.000Z',
    currentPeriodEnd: '2026-11-01T00:00:00.000Z',
    renewalDate: '2026-11-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    plan: { name: 'Standard', memberLimit: 500 },
    pendingPlan: null,
  };

  it('says when it renews, when a trial ends, and when a cancelled plan stops', () => {
    expect(describeNextStep(base)).toEqual({ label: 'Renews on', date: base.renewalDate });
    expect(describeNextStep({ ...base, status: 'TRIALING', trialEndsAt: '2026-10-30T00:00:00.000Z' })).toEqual({ label: 'Free trial ends', date: '2026-10-30T00:00:00.000Z' });
    expect(describeNextStep({ ...base, cancelAtPeriodEnd: true })).toEqual({ label: 'Ends on', date: base.currentPeriodEnd });
    expect(describeNextStep({ ...base, status: 'EXPIRED' }).label).toBe('Ended on');
    expect(describeNextStep({ ...base, status: 'PAST_DUE' }).label).toBe('Payment was due');
  });
});
