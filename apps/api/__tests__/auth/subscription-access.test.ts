/**
 * When an association may use the app. The free trial starts when the founding admin is approved (not at signup), lasts the number of days
 * the platform settings say (14 by default), and once it ends everyone in that association is blocked until a payment is made.
 */
const subFindFirst = jest.fn();
const subFindUnique = jest.fn(async () => ({ planVersionId: 5, billingCycle: 'MONTHLY', plan: { name: 'Enterprise' } }));
const termCreate = jest.fn();
const notify = jest.fn();
const subUpdate = jest.fn((args: unknown) => args);
const assocUpdate = jest.fn((args: unknown) => args);
const txMock = jest.fn(async (ops: unknown[]) => ops);
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    subscription: {
      findFirst: (...a: unknown[]) => subFindFirst(...a),
      findUnique: (...a: unknown[]) => subFindUnique(...(a as [])),
      update: (a: unknown) => subUpdate(a),
      findMany: jest.fn(),
    },
    subscriptionTerm: { create: (a: unknown) => termCreate(a) },
    association: { update: (a: unknown) => assocUpdate(a) },
    $transaction: (ops: unknown[]) => txMock(ops),
  },
}));

let platform: Record<string, unknown> = { defaultTrialDays: 14 };
jest.mock('../../src/modules/admin/platform-settings.service', () => ({
  PlatformSettingsService: { getSettings: jest.fn(async () => platform) },
}));
jest.mock('../../src/services/billing/billing-notifications.service', () => ({ notifyBillingEvent: (e: unknown) => notify(e) }));
jest.mock('../../src/services/billing-override.service', () => ({
  BillingOverrideService: { getBillingStatus: jest.fn() },
}));

import {
  clampGraceDays,
  clampTrialDays,
  evaluateAccess,
  pickDecidingSubscription,
  startTrialIfPending,
  trialDaysLeft,
  type SubscriptionFacts,
} from '../../src/services/subscription-access.service';
import { isSubscriptionExempt } from '../../src/middleware/auth.middleware';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const sub = (over: Partial<SubscriptionFacts>): SubscriptionFacts => ({
  status: 'TRIALING',
  trialEndsAt: null,
  currentPeriodEnd: days(0),
  createdAt: days(-1),
  ...over,
});

describe('evaluateAccess', () => {
  it('lets an association with no subscription row in, so older associations are never locked out by mistake', () => {
    expect(evaluateAccess(null, NOW)).toMatchObject({ allowed: true, reason: 'NO_SUBSCRIPTION' });
  });

  it('does not block a trial that has not started yet (still waiting for approval)', () => {
    expect(evaluateAccess(sub({ trialEndsAt: null }), NOW)).toMatchObject({ allowed: true, reason: 'TRIAL_NOT_STARTED', trialDaysLeft: null });
  });

  it('allows a running trial and counts the days left, rounded up', () => {
    expect(evaluateAccess(sub({ trialEndsAt: days(14) }), NOW)).toMatchObject({ allowed: true, reason: 'OK', trialDaysLeft: 14 });
    expect(evaluateAccess(sub({ trialEndsAt: new Date(NOW.getTime() + 2.2 * 24 * 60 * 60 * 1000) }), NOW).trialDaysLeft).toBe(3);
    expect(evaluateAccess(sub({ trialEndsAt: new Date(NOW.getTime() + 60 * 60 * 1000) }), NOW).trialDaysLeft).toBe(1);
  });

  it('blocks everyone once the trial has ended', () => {
    expect(evaluateAccess(sub({ trialEndsAt: days(-1) }), NOW)).toMatchObject({ allowed: false, reason: 'TRIAL_ENDED' });
  });

  it('keeps an ended trial open when the platform owner extended it', () => {
    expect(evaluateAccess(sub({ trialEndsAt: days(-1) }), NOW, true).allowed).toBe(true);
  });

  it('allows paid and past-due (grace period) subscriptions, and blocks expired ones', () => {
    expect(evaluateAccess(sub({ status: 'ACTIVE' }), NOW).allowed).toBe(true);
    expect(evaluateAccess(sub({ status: 'PAST_DUE' }), NOW).allowed).toBe(true);
    expect(evaluateAccess(sub({ status: 'EXPIRED' }), NOW)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
  });

  it('keeps a paid subscription in during the grace period after its end date, and says so', () => {
    const justEnded = sub({ status: 'ACTIVE', currentPeriodEnd: days(-1) });
    expect(evaluateAccess(justEnded, NOW, false, 3)).toMatchObject({ allowed: true, inGrace: true, reason: 'OK' });
    expect(evaluateAccess(justEnded, NOW, false, 3).graceEndsAt).toBe(days(2).toISOString());
  });

  it('locks the app once the grace period is over, even if the cron never moved the status', () => {
    // Status is still ACTIVE, but the stored end date is long past: the clock decides, not the status column.
    const longGone = sub({ status: 'ACTIVE', currentPeriodEnd: days(-4) });
    expect(evaluateAccess(longGone, NOW, false, 3)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
    expect(evaluateAccess(sub({ status: 'PAST_DUE', currentPeriodEnd: days(-4) }), NOW, false, 3).allowed).toBe(false);
  });

  it('locks straight away at the end date when the grace period is switched off', () => {
    expect(evaluateAccess(sub({ status: 'ACTIVE', currentPeriodEnd: days(-0.01) }), NOW, false, 0)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
    expect(evaluateAccess(sub({ status: 'ACTIVE', currentPeriodEnd: days(5) }), NOW, false, 0)).toMatchObject({ allowed: true, inGrace: false });
  });

  it('does not give a trial any grace', () => {
    expect(evaluateAccess(sub({ trialEndsAt: days(-0.5) }), NOW, false, 3)).toMatchObject({ allowed: false, reason: 'TRIAL_ENDED' });
  });

  it('lets a cancelled plan run until the paid period ends', () => {
    expect(evaluateAccess(sub({ status: 'CANCELLED', currentPeriodEnd: days(5) }), NOW).allowed).toBe(true);
    expect(evaluateAccess(sub({ status: 'CANCELLED', currentPeriodEnd: days(-1) }), NOW)).toMatchObject({ allowed: false, reason: 'CANCELLED' });
  });
});

describe('pickDecidingSubscription', () => {
  it('prefers a live subscription over a newer dead one, so paying again unblocks the association', () => {
    const dead = sub({ status: 'EXPIRED', createdAt: days(-1) });
    const live = sub({ status: 'ACTIVE', createdAt: days(-30) });
    expect(pickDecidingSubscription([dead, live])).toBe(live);
  });

  it('falls back to the newest when none is live, and to nothing when there are none', () => {
    const older = sub({ status: 'EXPIRED', createdAt: days(-30) });
    const newer = sub({ status: 'CANCELLED', createdAt: days(-2) });
    expect(pickDecidingSubscription([older, newer])).toBe(newer);
    expect(pickDecidingSubscription([])).toBeNull();
  });
});

describe('grace period setting', () => {
  it('allows 0 (off), caps at 30 and falls back to 3 for anything invalid', () => {
    expect(clampGraceDays(0)).toBe(0);
    expect(clampGraceDays('7')).toBe(7);
    expect(clampGraceDays(99)).toBe(30);
    expect(clampGraceDays(-2)).toBe(3);
    expect(clampGraceDays(undefined)).toBe(3);
    expect(clampGraceDays('abc')).toBe(3);
  });
});

describe('trial length', () => {
  it('uses the setting, keeps it between 1 and 90 days, and falls back to 14', () => {
    expect(clampTrialDays(21)).toBe(21);
    expect(clampTrialDays('30')).toBe(30);
    expect(clampTrialDays(500)).toBe(90);
    expect(clampTrialDays(0)).toBe(14);
    expect(clampTrialDays(undefined)).toBe(14);
    expect(clampTrialDays('abc')).toBe(14);
  });

  it('counts days left without going below zero', () => {
    expect(trialDaysLeft(days(-3), NOW)).toBe(0);
  });
});

describe('startTrialIfPending', () => {
  beforeEach(() => {
    subFindFirst.mockReset();
    subUpdate.mockClear();
    assocUpdate.mockClear();
    txMock.mockClear();
    termCreate.mockClear();
    notify.mockClear();
    platform = { defaultTrialDays: 14 };
  });

  it('starts a 14-day trial from the approval time and marks the association as having trialled', async () => {
    subFindFirst.mockResolvedValue({ id: 7 });
    const started = await startTrialIfPending(42, NOW);

    expect(started?.days).toBe(14);
    expect(started?.trialEndsAt.toISOString()).toBe(days(14).toISOString());
    expect(subUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { trialEndsAt: days(14), currentPeriodStart: NOW, currentPeriodEnd: days(14), renewalDate: days(14) },
    });
    expect(assocUpdate).toHaveBeenCalledWith({ where: { id: 42 }, data: { hasEverTrialed: true } });
  });

  it('follows the trial length set in the platform settings', async () => {
    platform = { defaultTrialDays: 30 };
    subFindFirst.mockResolvedValue({ id: 7 });
    const started = await startTrialIfPending(42, NOW);
    expect(started?.days).toBe(30);
  });

  it('records the trial as an unpaid onboarding term and tells the association when it ends', async () => {
    subFindFirst.mockResolvedValue({ id: 7 });
    await startTrialIfPending(42, NOW);
    expect(termCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ subscriptionId: 7, kind: 'ONBOARDING', amountKobo: 0, planVersionId: 5, startsAt: NOW, endsAt: days(14) }),
    });
    await new Promise((r) => setImmediate(r));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'ONBOARDING_STARTED', associationId: 42, policy: 'TRIAL', planName: 'Enterprise' }));
  });

  it('with a COMPLIMENTARY policy, starts an active complimentary subscription (not a trial) with no payment', async () => {
    platform = { defaultTrialDays: 30, onboardingPolicy: 'COMPLIMENTARY' };
    subFindFirst.mockResolvedValue({ id: 7 });
    await startTrialIfPending(42, NOW);
    expect(subUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'ACTIVE', source: 'COMPLIMENTARY', trialEndsAt: null, currentPeriodStart: NOW, currentPeriodEnd: days(30), renewalDate: days(30) },
    });
    expect(termCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'ONBOARDING', amountKobo: 0, reason: 'Complimentary onboarding subscription' }) });
  });

  it('with a BILLABLE policy, gives nothing free: the subscription ends now so the association must pay first', async () => {
    platform = { defaultTrialDays: 14, onboardingPolicy: 'BILLABLE' };
    subFindFirst.mockResolvedValue({ id: 7 });
    const started = await startTrialIfPending(42, NOW);
    expect(started?.days).toBe(0);
    expect(subUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'EXPIRED', currentPeriodStart: NOW, currentPeriodEnd: NOW, renewalDate: null },
    });
    expect(txMock).not.toHaveBeenCalled();
    expect(termCreate).not.toHaveBeenCalled();
  });

  it('only looks for a trial that has not started, so approving a second admin cannot restart or extend it', async () => {
    subFindFirst.mockResolvedValue(null);
    expect(await startTrialIfPending(42, NOW)).toBeNull();
    expect(subFindFirst).toHaveBeenCalledWith({ where: { associationId: 42, status: 'TRIALING', trialEndsAt: null }, select: { id: true } });
    expect(txMock).not.toHaveBeenCalled();
  });
});

describe('the areas a blocked association can still reach', () => {
  it('keeps sign-in, /me, renewal, support and push-token cleanup open', () => {
    for (const url of ['/api/auth/me', '/api/subscriptions/current', '/api/support/tickets?x=1', '/api/help/articles', '/api/devices/unregister']) {
      expect(isSubscriptionExempt(url)).toBe(true);
    }
  });

  it('blocks everything else, including look-alike paths', () => {
    for (const url of ['/api/members', '/api/finance/transactions', '/api/authors', '/api/subscriptions-export', '/api/ai/ask']) {
      expect(isSubscriptionExempt(url)).toBe(false);
    }
  });
});
