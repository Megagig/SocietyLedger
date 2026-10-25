/**
 * Who may use an association's app, and when the free trial starts.
 *
 * A new association gets a free trial on the Enterprise plan. The clock starts when the SaaS owner approves the founding admin (not at
 * signup), and when it runs out everyone in that association is blocked until a payment is made. Signed-in people can still reach the
 * login/me, subscription and support endpoints so they can see why and renew.
 */
import prisma from '../lib/prisma';
import { PlatformSettingsService } from '../modules/admin/platform-settings.service';
import { BillingOverrideService } from './billing-override.service';

const DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_TRIAL_DAYS = 14;
export const MAX_TRIAL_DAYS = 90;

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
export function evaluateAccess(sub: SubscriptionFacts | null, now: Date, trialExtendedByOwner = false): AccessState {
  if (!sub) return { allowed: true, reason: 'NO_SUBSCRIPTION', status: null, trialEndsAt: null, trialDaysLeft: null };

  const trialEndsAt = sub.trialEndsAt ? sub.trialEndsAt.toISOString() : null;
  const base = { status: sub.status, trialEndsAt, trialDaysLeft: null as number | null };

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
    case 'PAST_DUE': // the 3-day grace period; the renewal job expires it afterwards
      return { ...base, allowed: true, reason: 'OK' };
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

// A short cache keeps the check off the database on every request.
const CACHE_MS = 20_000;
const cache = new Map<number, { at: number; state: AccessState }>();
let enforceCache: { at: number; value: boolean } | null = null;

export function invalidateAccessCache(associationId?: number): void {
  if (associationId === undefined) cache.clear();
  else cache.delete(associationId);
  enforceCache = null;
}

async function enforcementOn(): Promise<boolean> {
  if (enforceCache && Date.now() - enforceCache.at < 60_000) return enforceCache.value;
  const settings = await PlatformSettingsService.getSettings();
  // Anything but an explicit `false` keeps enforcement on.
  const value = (settings as unknown as { enforceSubscriptionAccess?: unknown }).enforceSubscriptionAccess !== false;
  enforceCache = { at: Date.now(), value };
  return value;
}

export async function getAssociationAccess(associationId: number, now = new Date()): Promise<AccessState> {
  const hit = cache.get(associationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.state;

  let state: AccessState;
  if (!(await enforcementOn())) {
    state = { allowed: true, reason: 'NOT_ENFORCED', status: null, trialEndsAt: null, trialDaysLeft: null };
  } else {
    const subs = await prisma.subscription.findMany({
      where: { associationId },
      select: { status: true, trialEndsAt: true, currentPeriodEnd: true, createdAt: true },
    });
    const deciding = pickDecidingSubscription(subs);
    const billing = await BillingOverrideService.getBillingStatus(associationId);
    const owner = billing.isBillingBypassed || billing.isPaidExternally || billing.hasGracePeriod;
    const computed = evaluateAccess(deciding, now, billing.isTrialExtended);
    state = owner && !computed.allowed ? { ...computed, allowed: true, reason: 'OK' } : computed;
  }

  cache.set(associationId, { at: Date.now(), state });
  return state;
}

/**
 * Start the free trial for an association that signed up and was just approved. Does nothing when the trial has already started (the
 * subscription row carries no end date until then), so approving a second admin later cannot restart or extend it.
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

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: pending.id },
      data: { trialEndsAt, currentPeriodStart: now, currentPeriodEnd: trialEndsAt, renewalDate: trialEndsAt },
    }),
    prisma.association.update({ where: { id: associationId }, data: { hasEverTrialed: true } }),
  ]);

  invalidateAccessCache(associationId);
  return { trialEndsAt, days };
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
