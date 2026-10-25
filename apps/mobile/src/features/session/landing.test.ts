import type { SessionUser } from '@/stores/session';
import { isSetupPending, isSubscriptionBlocked, landingHref, SETUP_HREF, trialEndingInDays } from './landing';

const base: SessionUser = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  permissions: [],
  roles: ['member'],
  requiresOnboarding: false,
  platformRole: null,
  member: null,
};
const trialing = (trialDaysLeft: number | null, allowed = true): SessionUser => ({
  ...base,
  role: 'admin',
  subscriptionAccess: { allowed, reason: allowed ? 'OK' : 'TRIAL_ENDED', status: 'TRIALING', trialEndsAt: '2026-11-17T00:00:00.000Z', trialDaysLeft },
});

describe('where a signed-in person lands', () => {
  it('sends an association admin with setup still pending to the wizard', () => {
    const admin = { ...base, role: 'admin', requiresOnboarding: true };
    expect(isSetupPending(admin)).toBe(true);
    expect(landingHref(admin)).toBe(SETUP_HREF);
  });

  it('sends everyone else to Home, even if the flag is set on a member or on platform staff', () => {
    expect(landingHref(base)).toBe('/(app)/(tabs)/home');
    expect(landingHref({ ...base, requiresOnboarding: true })).toBe('/(app)/(tabs)/home');
    expect(landingHref({ ...base, role: 'admin', requiresOnboarding: true, platformRole: 'SUPER_ADMIN' })).toBe('/(app)/(tabs)/home');
    expect(landingHref(null)).toBe('/(app)/(tabs)/home');
  });
});

describe('isSubscriptionBlocked', () => {
  it('is true only when the server said the association is not allowed in', () => {
    expect(isSubscriptionBlocked(trialing(null, false))).toBe(true);
    expect(isSubscriptionBlocked(trialing(5))).toBe(false);
    expect(isSubscriptionBlocked(base)).toBe(false);
    expect(isSubscriptionBlocked(null)).toBe(false);
  });

  it('never blocks platform staff', () => {
    expect(isSubscriptionBlocked({ ...trialing(null, false), platformRole: 'SUPER_ADMIN' })).toBe(false);
  });
});

describe('trialEndingInDays (the countdown banner)', () => {
  it('shows from 3 days left down to 1', () => {
    expect(trialEndingInDays(trialing(3))).toBe(3);
    expect(trialEndingInDays(trialing(1))).toBe(1);
  });

  it('stays quiet earlier than that, when blocked, and when it is not a trial', () => {
    expect(trialEndingInDays(trialing(4))).toBeNull();
    expect(trialEndingInDays(trialing(14))).toBeNull();
    expect(trialEndingInDays(trialing(null, false))).toBeNull();
    expect(trialEndingInDays({ ...trialing(2), subscriptionAccess: { allowed: true, reason: 'OK', status: 'ACTIVE', trialEndsAt: null, trialDaysLeft: null } })).toBeNull();
    expect(trialEndingInDays(null)).toBeNull();
  });
});
