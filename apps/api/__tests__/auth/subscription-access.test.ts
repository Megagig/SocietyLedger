/**
 * When an association may use the app. The free trial starts when the founding admin is approved (not at signup), lasts the number of days
 * the platform settings say (14 by default), and once it ends everyone in that association is blocked until a payment is made.
 */
const subFindFirst = jest.fn();
const subUpdate = jest.fn((args: unknown) => args);
const assocUpdate = jest.fn((args: unknown) => args);
const txMock = jest.fn(async (ops: unknown[]) => ops);
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    subscription: { findFirst: (...a: unknown[]) => subFindFirst(...a), update: (a: unknown) => subUpdate(a), findMany: jest.fn() },
    association: { update: (a: unknown) => assocUpdate(a) },
    $transaction: (ops: unknown[]) => txMock(ops),
  },
}));

let platform: Record<string, unknown> = { defaultTrialDays: 14 };
jest.mock('../../src/modules/admin/platform-settings.service', () => ({
  PlatformSettingsService: { getSettings: jest.fn(async () => platform) },
}));
jest.mock('../../src/services/billing-override.service', () => ({
  BillingOverrideService: { getBillingStatus: jest.fn() },
}));

import {
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
