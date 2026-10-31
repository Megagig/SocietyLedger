/**
 * Who may use an association's app, and when the onboarding clock starts.
 *
 * A new association is given the configured onboarding subscription (the Enterprise plan by default). The clock starts when the SaaS owner
 * approves the founding admin (not at signup), and when it runs out everyone in that association is blocked until a payment is made.
 * Signed-in people can still reach the login/me, subscription and support endpoints so they can see why and renew.
 *
 * Expiry is decided here, from the server clock and the stored period end, on every request. The renewal cron only sends emails and tidies
 * the status column, so a missed cron run can never keep an expired association inside the app.
 */
import prisma from '../lib/prisma';
import { PlatformSettingsService } from '../modules/admin/platform-settings.service';
import { BillingOverrideService } from './billing-override.service';
import { addDaysUtc } from './billing/money';

const DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_TRIAL_DAYS = 90;
export const DEFAULT_GRACE_DAYS = 3;
export const MAX_GRACE_DAYS = 30;

export type AccessReason =
  | 'OK'
  | 'TRIAL_NOT_STARTED'
  | 'TRIAL_ENDED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'NO_SUBSCRIPTION'
  | 'NOT_ENFORCED';

export interface AccessState {
  allowed: boolean;
  reason: AccessReason;
  /** TRIALING, ACTIVE, PAST_DUE, CANCELLED, EXPIRED, or null when the association has no subscription row. */
  status: string | null;
  trialEndsAt: string | null;
  /** Whole days left in the trial (rounded up), only while the trial is running. */
  trialDaysLeft: number | null;
  /** When the paid or complimentary period ends (null for trials and when there is no subscription). */
  periodEndsAt: string | null;
  /** True while a paid period has ended but the grace period is still keeping the association in. */
  inGrace: boolean;
  graceEndsAt: string | null;
}

export interface SubscriptionFacts {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  createdAt: Date;
}

const LIVE_ORDER = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

/** The row that decides access: a live one if there is any, otherwise the newest. */
export function pickDecidingSubscription<T extends SubscriptionFacts>(subs: T[]): T | null {
  if (subs.length === 0) return null;
  const live = subs.filter((s) => LIVE_ORDER.includes(s.status));
  const pool = live.length > 0 ? live : subs;
  return [...pool].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY));
}

/** Pure: given the deciding subscription, say whether the association may use the app. */
export function evaluateAccess(
  sub: SubscriptionFacts | null,
  now: Date,
  trialExtendedByOwner = false,
  graceDays = DEFAULT_GRACE_DAYS,
): AccessState {
  const empty = { trialEndsAt: null, trialDaysLeft: null, periodEndsAt: null, inGrace: false, graceEndsAt: null };
  if (!sub) return { ...empty, allowed: true, reason: 'NO_SUBSCRIPTION', status: null };

  const base = {
    status: sub.status,
    trialEndsAt: sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
    trialDaysLeft: null as number | null,
    periodEndsAt: sub.status === 'TRIALING' ? null : sub.currentPeriodEnd.toISOString(),
    inGrace: false,
    graceEndsAt: null as string | null,
  };

  switch (sub.status) {
    case 'TRIALING': {
      // The clock has not started yet (waiting for approval): nothing to block.
      if (!sub.trialEndsAt) return { ...base, allowed: true, reason: 'TRIAL_NOT_STARTED' };
      if (sub.trialEndsAt.getTime() > now.getTime() || trialExtendedByOwner) {
        return { ...base, allowed: true, reason: 'OK', trialDaysLeft: trialDaysLeft(sub.trialEndsAt, now) };
      }
      return { ...base, allowed: false, reason: 'TRIAL_ENDED' };
    }
    case 'ACTIVE':
    case 'PAST_DUE': {
      // The stored period end is the truth; the status column only follows it (the cron moves ACTIVE -> PAST_DUE -> EXPIRED).
      if (sub.currentPeriodEnd.getTime() > now.getTime()) return { ...base, allowed: true, reason: 'OK' };
      const graceEnd = addDaysUtc(sub.currentPeriodEnd, Math.max(0, graceDays));
      if (graceEnd.getTime() > now.getTime()) {
        return { ...base, allowed: true, reason: 'OK', inGrace: true, graceEndsAt: graceEnd.toISOString() };
      }
      return { ...base, allowed: false, reason: 'EXPIRED', graceEndsAt: graceEnd.toISOString() };
    }
    case 'CANCELLED':
      // A cancelled plan stays usable until the period that was already paid for ends.
      return sub.currentPeriodEnd.getTime() > now.getTime()
        ? { ...base, allowed: true, reason: 'OK' }
        : { ...base, allowed: false, reason: 'CANCELLED' };
    default:
      return { ...base, allowed: false, reason: 'EXPIRED' };
  }
}

/** Trial length from the platform settings, kept inside sensible bounds. */
export function clampTrialDays(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TRIAL_DAYS;
  return Math.min(n, MAX_TRIAL_DAYS);
}

/** Grace period from the platform settings: 0 is allowed (no grace), anything invalid falls back to the default. */
export function clampGraceDays(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_GRACE_DAYS;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_GRACE_DAYS;
  return Math.min(n, MAX_GRACE_DAYS);
}

// A short cache keeps the check off the database on every request.
const CACHE_MS = 20_000;
const cache = new Map<number, { at: number; state: AccessState }>();
let policyCache: { at: number; enforce: boolean; graceDays: number } | null = null;

export function invalidateAccessCache(associationId?: number): void {
  if (associationId === undefined) cache.clear();
  else cache.delete(associationId);
  policyCache = null;
}

async function accessPolicy(): Promise<{ enforce: boolean; graceDays: number }> {
  if (policyCache && Date.now() - policyCache.at < 60_000) return policyCache;
  const settings = (await PlatformSettingsService.getSettings()) as unknown as {
    enforceSubscriptionAccess?: unknown;
    gracePeriodDays?: unknown;
  };
  policyCache = {
    at: Date.now(),
    // Anything but an explicit `false` keeps enforcement on.
    enforce: settings.enforceSubscriptionAccess !== false,
    graceDays: clampGraceDays(settings.gracePeriodDays),
  };
  return policyCache;
}

export async function getAssociationAccess(associationId: number, now = new Date()): Promise<AccessState> {
  const hit = cache.get(associationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.state;

  let state: AccessState;
  const policy = await accessPolicy();
  if (!policy.enforce) {
    state = {
      allowed: true,
      reason: 'NOT_ENFORCED',
      status: null,
      trialEndsAt: null,
      trialDaysLeft: null,
      periodEndsAt: null,
      inGrace: false,
      graceEndsAt: null,
    };
  } else {
    const subs = await prisma.subscription.findMany({
      where: { associationId },
      select: { status: true, trialEndsAt: true, currentPeriodEnd: true, createdAt: true },
    });
    const deciding = pickDecidingSubscription(subs);
    const billing = await BillingOverrideService.getBillingStatus(associationId);
    const owner = billing.isBillingBypassed || billing.isPaidExternally || billing.hasGracePeriod;
    const computed = evaluateAccess(deciding, now, billing.isTrialExtended, policy.graceDays);
    state = owner && !computed.allowed ? { ...computed, allowed: true, reason: 'OK' } : computed;
  }

  cache.set(associationId, { at: Date.now(), state });
  return state;
}

/**
 * Start the onboarding clock for an association that signed up and was just approved. Does nothing when it has already started (the
 * subscription row carries no end date until then), so approving a second admin later cannot restart or extend it.
 *
 * What starts depends on the platform's onboarding policy: a free trial, a complimentary subscription of the same length (recorded as
 * unpaid, not as a trial), or nothing free at all (billable: the association has to pay before it can use the app).
 */
export async function startTrialIfPending(associationId: number, now = new Date()): Promise<{ trialEndsAt: Date; days: number } | null> {
  const pending = await prisma.subscription.findFirst({
    where: { associationId, status: 'TRIALING', trialEndsAt: null },
    select: { id: true },
  });
  if (!pending) return null;

  const settings = await PlatformSettingsService.getSettings();
  const days = clampTrialDays(settings.defaultTrialDays);
  const trialEndsAt = new Date(now.getTime() + days * DAY);
  const policy = settings.onboardingPolicy === 'COMPLIMENTARY' || settings.onboardingPolicy === 'BILLABLE' ? settings.onboardingPolicy : 'TRIAL';

  if (policy === 'BILLABLE') {
    // Nothing free: the period ends now, so the association is sent straight to choose a plan and pay.
    await prisma.subscription.update({
      where: { id: pending.id },
      data: { status: 'EXPIRED', currentPeriodStart: now, currentPeriodEnd: now, renewalDate: null },
    });
    invalidateAccessCache(associationId);
    void announceOnboarding(pending.id, associationId, now, 'BILLABLE');
    return { trialEndsAt: now, days: 0 };
  }

  const data =
    policy === 'COMPLIMENTARY'
      ? { status: 'ACTIVE' as const, source: 'COMPLIMENTARY' as const, trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: trialEndsAt, renewalDate: trialEndsAt }
      : { trialEndsAt, currentPeriodStart: now, currentPeriodEnd: trialEndsAt, renewalDate: trialEndsAt };

  await prisma.$transaction([
    prisma.subscription.update({ where: { id: pending.id }, data }),
    prisma.association.update({ where: { id: associationId }, data: { hasEverTrialed: true } }),
  ]);

  // The term record is the history of what was granted and why; it carries no payment because none happened.
  await recordOnboardingTerm(pending.id, associationId, now, trialEndsAt, policy).catch((error) => {
    console.error('Could not record the onboarding term (the subscription itself was started):', error);
  });

  // A standalone thrift group's trial includes the Ajo Starter add-on for the same days. Never allowed to fail the approval.
  try {
    const { grantThriftTrialAddon } = await import('../modules/ajo/ajo-standalone');
    await grantThriftTrialAddon(associationId, trialEndsAt, now);
  } catch (error) {
    console.error('Could not grant the Ajo trial add-on (the trial itself was started):', error);
  }

  invalidateAccessCache(associationId);
  void announceOnboarding(pending.id, associationId, trialEndsAt, policy);
  return { trialEndsAt, days };
}

/** Tell the association what it was given and when it ends. Loaded lazily and never allowed to fail the approval that started the clock. */
async function announceOnboarding(subscriptionId: number, associationId: number, endsAt: Date, policy: 'TRIAL' | 'COMPLIMENTARY' | 'BILLABLE'): Promise<void> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { plan: { select: { name: true } } } });
    const { notifyBillingEvent } = await import('./billing/billing-notifications.service');
    await notifyBillingEvent({ type: 'ONBOARDING_STARTED', associationId, endsAt, policy, planName: sub?.plan.name ?? 'your plan' });
  } catch (error) {
    console.error('Could not send the onboarding notification:', error);
  }
}

async function recordOnboardingTerm(
  subscriptionId: number,
  associationId: number,
  startsAt: Date,
  endsAt: Date,
  policy: 'TRIAL' | 'COMPLIMENTARY',
): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId }, select: { planVersionId: true, billingCycle: true } });
  if (!sub) return;
  await prisma.subscriptionTerm.create({
    data: {
      subscriptionId,
      associationId,
      planVersionId: sub.planVersionId,
      kind: 'ONBOARDING',
      billingCycle: sub.billingCycle,
      startsAt,
      endsAt,
      amountKobo: 0,
      reason: policy === 'COMPLIMENTARY' ? 'Complimentary onboarding subscription' : 'Onboarding free trial',
    },
  });
}

/** For the login and /me responses: null for platform staff or when the check cannot run (the apps then show nothing). */
export async function loadSubscriptionAccess(associationId: number | null | undefined, platformRole: unknown): Promise<AccessState | null> {
  if (!associationId || platformRole) return null;
  try {
    return await getAssociationAccess(associationId);
  } catch (error) {
    console.error('Could not load subscription access:', error);
    return null;
  }
}
