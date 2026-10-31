/**
 * Everything that changes what an association has bought: the onboarding subscription, activation after a verified payment, deferred
 * downgrades, and the audited manual actions platform staff can take.
 *
 * Two rules hold for all of it:
 *  1. Access is only ever granted by (a) a payment that was verified AND matches the quote the server stored at checkout to the kobo, or
 *     (b) an explicit staff action that records who did it and why. Returning from a checkout page grants nothing.
 *  2. Everything that belongs together happens in one database transaction, and a payment can only be applied once.
 */
import { Prisma, type BillingCycle, type SubscriptionSource, type SubscriptionTermKind } from '@prisma/client';
import prisma from '../../lib/prisma';
import { PlatformSettingsService } from '../../modules/admin/platform-settings.service';
import { settleLevyInTx } from '../../modules/ajo/ajo-levy.service';
import { invalidateAccessCache } from '../subscription-access.service';
import { tierForPlanCode } from '../subscription-plan.service';
import { getLatestPublishedPlan, getOnboardingPlan, getPlanVersionTerms, invalidateCatalogCache } from './catalog.service';
import { invalidateEntitlements } from './entitlements.service';
import { BillingError, type Quote } from './quote.service';
import { addDaysUtc, nairaToKobo, periodEndFor } from './money';
import { notifyBillingEvent } from './billing-notifications.service';

type Tx = Prisma.TransactionClient;

const TERM_KIND: Record<Quote['kind'], SubscriptionTermKind> = {
  SUBSCRIBE: 'PURCHASE',
  RENEW: 'RENEWAL',
  CHANGE: 'PLAN_CHANGE',
  ADDON: 'PURCHASE',
};

export function afterBillingChange(associationId: number): void {
  invalidateAccessCache(associationId);
  invalidateEntitlements(associationId);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------------------------------------------------------------

export interface OnboardingPlan {
  planId: number;
  planVersionId: number;
  code: string;
}

/** The plan a new association is given, read from the platform settings and the published catalog (never a hardcoded plan). */
export async function resolveOnboardingPlan(planCode?: string): Promise<OnboardingPlan> {
  const settings = await PlatformSettingsService.getSettings();
  // A tenant kind with its own base plan (a standalone thrift group) passes it; everyone else gets the configured onboarding plan.
  const code = (planCode || settings.onboardingPlanCode || 'enterprise').toString();
  const plan = await getOnboardingPlan(code);
  if (!plan) {
    throw new BillingError('ONBOARDING_PLAN_MISSING', `The onboarding plan "${code}" has no published version. Publish it in the Plan Builder.`, 500);
  }
  return { planId: plan.id, planVersionId: plan.versionId, code: plan.code };
}

/**
 * The subscription row a new association starts with. It carries no end date: the clock starts when the founding admin is approved
 * (see startTrialIfPending), so the plan version is fixed now but the dates are not.
 */
export function onboardingSubscriptionData(plan: OnboardingPlan, associationId: number, now: Date): Prisma.SubscriptionUncheckedCreateInput {
  return {
    associationId,
    planId: plan.planId,
    planVersionId: plan.planVersionId,
    source: 'ONBOARDING',
    status: 'TRIALING',
    billingCycle: 'MONTHLY',
    trialEndsAt: null,
    currentPeriodStart: now,
    currentPeriodEnd: now,
    renewalDate: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Applying a quote
// ---------------------------------------------------------------------------------------------------------------------------------

/** What each part of a quote actually cost, after credits: the plan's share and each add-on's share. */
export function netShares(quote: Quote): { planKobo: number; addons: Map<number, number> } {
  let planKobo = 0;
  const addons = new Map<number, number>();
  for (const l of quote.lines) {
    if (l.type === 'PLAN' || (l.type === 'CREDIT' && l.addonId === undefined)) planKobo += l.amountKobo;
    else if (l.addonId !== undefined) addons.set(l.addonId, (addons.get(l.addonId) ?? 0) + l.amountKobo);
  }
  return { planKobo: Math.max(0, planKobo), addons: new Map([...addons].map(([id, v]) => [id, Math.max(0, v)])) };
}

interface ApplyInput {
  subscriptionId: number;
  quote: Quote;
  now: Date;
  source: SubscriptionSource;
  paymentHistoryId: number | null;
  actorId: number | null;
  reason: string | null;
}

/** Apply a paid-for (or staff-approved) quote to the subscription, its add-ons and its term history. Runs inside the caller's transaction. */
async function applyQuote(tx: Tx, input: ApplyInput): Promise<{ periodEnd: Date }> {
  const { quote, now } = input;
  const sub = await tx.subscription.findUniqueOrThrow({ where: { id: input.subscriptionId } });
  const shares = netShares(quote);

  // ---- add-ons only: they ride on the existing subscription and end with its current period
  if (quote.kind === 'ADDON') {
    await upsertTenantAddons(tx, sub.id, sub.associationId, quote, sub.currentPeriodEnd, now, shares.addons, input);
    return { periodEnd: sub.currentPeriodEnd };
  }

  const termStart = quote.extend && sub.currentPeriodEnd.getTime() > now.getTime() ? sub.currentPeriodEnd : now;
  const periodEnd = periodEndFor(termStart, quote.billingCycle);

  await tx.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'ACTIVE',
      source: input.source,
      planId: quote.planId,
      planVersionId: quote.planVersionId,
      billingCycle: quote.billingCycle,
      // An extension keeps the period it started with and pushes the end out; any other purchase starts a fresh period today.
      currentPeriodStart: quote.extend ? sub.currentPeriodStart : now,
      currentPeriodEnd: periodEnd,
      renewalDate: periodEnd,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      // Buying a plan answers any downgrade that was waiting.
      pendingPlanId: null,
      pendingBillingCycle: null,
    },
  });

  await tx.subscriptionTerm.create({
    data: {
      subscriptionId: sub.id,
      associationId: sub.associationId,
      planVersionId: quote.planVersionId,
      kind: input.paymentHistoryId === null && input.source !== 'PURCHASE' ? 'MANUAL' : TERM_KIND[quote.kind],
      billingCycle: quote.billingCycle,
      startsAt: termStart,
      endsAt: periodEnd,
      amountKobo: shares.planKobo,
      paymentHistoryId: input.paymentHistoryId,
      actorId: input.actorId,
      reason: input.reason,
    },
  });

  // Add-ons that were not carried into the new plan end with the old one when the plan changed.
  if (quote.kind === 'CHANGE') {
    const keep = quote.addons.map((a) => a.addonId);
    const held = await tx.tenantAddon.findMany({
      where: { subscriptionId: sub.id, status: 'ACTIVE', addonVersion: { addonId: { notIn: keep } } },
      select: { id: true },
    });
    if (held.length > 0) {
      await tx.tenantAddon.updateMany({ where: { id: { in: held.map((h) => h.id) } }, data: { status: 'ENDED', endsAt: now } });
    }
  }

  await upsertTenantAddons(tx, sub.id, sub.associationId, quote, periodEnd, termStart, shares.addons, input);

  const plan = await tx.plan.findUnique({ where: { id: quote.planId }, select: { code: true } });
  const tier = tierForPlanCode(plan?.code);
  const association = await tx.association.findUnique({ where: { id: sub.associationId }, select: { status: true } });
  await tx.association.update({
    where: { id: sub.associationId },
    data: {
      subscriptionExpiresAt: periodEnd,
      // Paying never reinstates an association the platform suspended or cancelled.
      ...(association && association.status === 'SUSPENDED' ? {} : association && association.status === 'CANCELLED' ? {} : { status: 'ACTIVE' as const }),
      ...(tier ? { tier } : {}),
    },
  });

  return { periodEnd };
}

async function upsertTenantAddons(
  tx: Tx,
  subscriptionId: number,
  associationId: number,
  quote: Quote,
  endsAt: Date,
  startsAt: Date,
  nets: Map<number, number>,
  input: ApplyInput,
): Promise<void> {
  for (const a of quote.addons) {
    // A tier change ends the tier it replaces, so a tenant never holds two tiers of one product (their limits would add up).
    if (a.replacesTenantAddonIds?.length) {
      await tx.tenantAddon.updateMany({ where: { id: { in: a.replacesTenantAddonIds }, associationId, status: 'ACTIVE' }, data: { status: 'ENDED', endsAt: startsAt } });
    }
    const data = {
      addonVersionId: a.addonVersionId,
      status: 'ACTIVE' as const,
      billingCycle: quote.billingCycle,
      endsAt,
      cancelAtPeriodEnd: false,
      source: input.source,
      amountPaidKobo: nets.get(a.addonId) ?? a.amountKobo,
      paymentHistoryId: input.paymentHistoryId,
      actorId: input.actorId,
      reason: input.reason,
    };
    if (a.tenantAddonId) {
      // Renewing keeps the original start; re-buying one that had ended starts it again.
      const existing = await tx.tenantAddon.findUnique({ where: { id: a.tenantAddonId } });
      await tx.tenantAddon.update({
        where: { id: a.tenantAddonId },
        data: { ...data, startsAt: existing && existing.status === 'ACTIVE' && existing.endsAt > startsAt ? existing.startsAt : startsAt },
      });
    } else {
      await tx.tenantAddon.create({ data: { ...data, associationId, subscriptionId, startsAt } });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Activation after payment
// ---------------------------------------------------------------------------------------------------------------------------------

export type ActivationOutcome = 'ACTIVATED' | 'ALREADY_APPLIED' | 'NEEDS_REVIEW' | 'NOT_FOUND';

export interface ActivationResult {
  outcome: ActivationOutcome;
  subscriptionId?: number;
  associationId?: number;
  paymentId?: number;
  periodEnd?: Date;
  kind?: Quote['kind'];
}

/**
 * Turn a VERIFIED payment into access. The webhook, the verify endpoint and the return page can all call this for the same reference at
 * the same time; exactly one of them applies it. The amount the gateway confirms must equal the amount the server quoted at checkout,
 * otherwise the money is kept on record for staff to review and nothing is activated.
 */
export async function activateFromPayment(input: {
  reference: string;
  verifiedAmountKobo: number;
  paidAt?: Date;
  gatewayPayload?: unknown;
}): Promise<ActivationResult> {
  const now = new Date();
  const result = await prisma.$transaction(
    async (tx): Promise<ActivationResult> => {
      const payment = await tx.paymentHistory.findUnique({ where: { reference: input.reference }, include: { subscription: true } });
      if (!payment) return { outcome: 'NOT_FOUND' };
      const base = { subscriptionId: payment.subscriptionId, associationId: payment.subscription.associationId, paymentId: payment.id };

      if (payment.appliedAt) return { outcome: 'ALREADY_APPLIED', ...base };
      if (payment.needsReview) return { outcome: 'NEEDS_REVIEW', ...base };

      const quote = payment.quote as unknown as (Quote & { initiatedBy?: number }) | null;
      const expected = payment.expectedAmountKobo ?? nairaToKobo(payment.amount.toString());

      if (!quote || input.verifiedAmountKobo !== expected) {
        // Money arrived but it is not what was quoted (or the checkout predates quotes): keep it, grant nothing.
        const flagged = await tx.paymentHistory.updateMany({
          where: { id: payment.id, appliedAt: null, needsReview: false },
          data: { status: 'SUCCESS', paidAt: input.paidAt ?? now, needsReview: true, metadata: (input.gatewayPayload ?? Prisma.JsonNull) as Prisma.InputJsonValue },
        });
        if (flagged.count > 0) {
          await tx.platformActionLog.create({
            data: {
              actorId: 0,
              actorRole: 'SYSTEM',
              actionType: 'SUBSCRIPTION_PAYMENT_MISMATCH',
              targetType: 'billing',
              targetId: payment.id,
              associationId: payment.subscription.associationId,
              afterState: { reference: input.reference, expectedKobo: expected, verifiedKobo: input.verifiedAmountKobo, hasQuote: !!quote },
              reason: 'Verified payment did not match the quote, so nothing was activated',
            },
          });
        }
        return { outcome: 'NEEDS_REVIEW', ...base };
      }

      // Claim the payment. Concurrent callers block on this row, then see appliedAt set and match nothing.
      const claimed = await tx.paymentHistory.updateMany({
        where: { id: payment.id, appliedAt: null },
        data: {
          status: 'SUCCESS',
          appliedAt: now,
          paidAt: input.paidAt ?? now,
          metadata: (input.gatewayPayload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
      if (claimed.count === 0) return { outcome: 'ALREADY_APPLIED', ...base };

      const applied = await applyQuote(tx, {
        subscriptionId: payment.subscriptionId,
        quote,
        now,
        source: 'PURCHASE',
        paymentHistoryId: payment.id,
        actorId: quote.initiatedBy ?? null,
        reason: null,
      });
      // The Ajo platform levy that rode on this payment is settled in the same transaction, apart from the plan and add-on shares.
      await settleLevyInTx(tx, { quote, paymentHistoryId: payment.id, now });

      await tx.platformActionLog.create({
        data: {
          actorId: quote.initiatedBy ?? 0,
          actorRole: quote.initiatedBy ? 'ASSOCIATION_ADMIN' : 'SYSTEM',
          actionType: quote.kind === 'ADDON' ? 'ADDON_PURCHASED' : 'SUBSCRIPTION_PAYMENT_VERIFIED',
          targetType: 'subscription',
          targetId: payment.subscriptionId,
          associationId: payment.subscription.associationId,
          afterState: {
            reference: input.reference,
            amountKobo: input.verifiedAmountKobo,
            kind: quote.kind,
            planId: quote.planId,
            planVersionId: quote.planVersionId,
            billingCycle: quote.billingCycle,
            addons: quote.addons.map((a) => a.addonId),
            periodEnd: applied.periodEnd.toISOString(),
          },
        },
      });

      return { outcome: 'ACTIVATED', ...base, periodEnd: applied.periodEnd, kind: quote.kind };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  if (result.associationId) afterBillingChange(result.associationId);
  if (result.outcome === 'ACTIVATED' && result.associationId) {
    void notifyBillingEvent({ type: result.kind === 'ADDON' ? 'ADDON_ACTIVATED' : 'SUBSCRIPTION_ACTIVATED', associationId: result.associationId, periodEnd: result.periodEnd });
  }
  if (result.outcome === 'NEEDS_REVIEW' && result.associationId) {
    void notifyBillingEvent({ type: 'PAYMENT_NEEDS_REVIEW', associationId: result.associationId });
  }
  return result;
}

/** Apply a quote that costs nothing (a free plan, or credits that cover it) without a payment. */
export async function activateFreeQuote(input: { subscriptionId: number; quote: Quote; actorId: number | null }): Promise<ActivationResult> {
  if (input.quote.totalKobo !== 0) throw new BillingError('NOT_FREE', 'This checkout needs a payment.');
  const now = new Date();
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: input.subscriptionId } });
  const applied = await prisma.$transaction((tx) =>
    applyQuote(tx, { subscriptionId: input.subscriptionId, quote: input.quote, now, source: 'PURCHASE', paymentHistoryId: null, actorId: input.actorId, reason: 'No charge for this change' }),
  );
  afterBillingChange(sub.associationId);
  return { outcome: 'ACTIVATED', subscriptionId: sub.id, associationId: sub.associationId, periodEnd: applied.periodEnd, kind: input.quote.kind };
}

/** Schedule a downgrade for the end of the current period. Nothing changes today and nothing is charged. */
export async function scheduleDeferredChange(input: { subscriptionId: number; planId: number; billingCycle: BillingCycle; actorId: number }) {
  const sub = await prisma.subscription.update({
    where: { id: input.subscriptionId },
    data: { pendingPlanId: input.planId, pendingBillingCycle: input.billingCycle },
  });
  await PlatformLog.record({
    actorId: input.actorId,
    actorRole: 'ASSOCIATION_ADMIN',
    actionType: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
    associationId: sub.associationId,
    targetId: sub.id,
    afterState: { planId: input.planId, billingCycle: input.billingCycle, effectiveAt: sub.currentPeriodEnd.toISOString() },
  });
  afterBillingChange(sub.associationId);
  return sub;
}

/** Apply downgrades whose period has ended: the subscription moves to the pending plan's latest published version. */
export async function applyDueDeferredChanges(now = new Date()): Promise<number> {
  const due = await prisma.subscription.findMany({ where: { pendingPlanId: { not: null }, currentPeriodEnd: { lte: now } } });
  let applied = 0;
  for (const sub of due) {
    const target = await getLatestPublishedPlan(sub.pendingPlanId!);
    if (!target) continue; // nothing published for it any more: leave the request in place for staff to see
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { planId: target.id, planVersionId: target.versionId, billingCycle: sub.pendingBillingCycle ?? sub.billingCycle, pendingPlanId: null, pendingBillingCycle: null },
    });
    afterBillingChange(sub.associationId);
    applied += 1;
  }
  return applied;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Staff actions (always with a reason, always audited in the same transaction)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface Actor {
  id: number;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

const PlatformLog = {
  async record(entry: {
    actorId: number;
    actorRole: string;
    actionType: string;
    associationId: number;
    targetId?: number;
    beforeState?: object;
    afterState?: object;
    reason?: string;
  }) {
    await prisma.platformActionLog
      .create({ data: { ...entry, targetType: 'subscription' } })
      .catch((e) => console.error('Failed to write billing audit entry:', e));
  },
};

export function requireReason(reason: unknown): string {
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text.length < 10) throw new BillingError('REASON_REQUIRED', 'Give a reason of at least 10 characters. It is kept in the audit trail.');
  return text;
}

async function decidingSubscription(tx: Tx, associationId: number) {
  const subs = await tx.subscription.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' } });
  return subs.find((s) => ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(s.status)) ?? subs[0] ?? null;
}

/**
 * Give an association a subscription without a payment (manual activation or complimentary access). No payment row and no invoice is
 * created: the term is recorded as unpaid with the person and reason attached.
 */
export async function activateManually(input: {
  associationId: number;
  planId: number;
  planVersionId?: number;
  billingCycle: BillingCycle;
  /** Either an explicit end date or a number of days from today. */
  endsAt?: Date;
  days?: number;
  complimentary?: boolean;
  reason: unknown;
  actor: Actor;
}) {
  const reason = requireReason(input.reason);
  const plan = input.planVersionId ? await getPlanVersionTerms(input.planVersionId) : await getLatestPublishedPlan(input.planId);
  if (!plan || plan.id !== input.planId) throw new BillingError('PLAN_UNAVAILABLE', 'That plan has no published version.', 404);

  const now = new Date();
  const endsAt = input.endsAt ?? (input.days ? addDaysUtc(now, input.days) : periodEndFor(now, input.billingCycle));
  if (endsAt.getTime() <= now.getTime()) throw new BillingError('INVALID_DATE', 'The end date must be in the future.');
  const source: SubscriptionSource = input.complimentary ? 'COMPLIMENTARY' : 'MANUAL';

  const result = await prisma.$transaction(async (tx) => {
    const assoc = await tx.association.findUnique({ where: { id: input.associationId }, select: { id: true, status: true } });
    if (!assoc) throw new BillingError('ASSOCIATION_NOT_FOUND', 'Association not found.', 404);
    const before = await decidingSubscription(tx, input.associationId);

    const data = {
      status: 'ACTIVE' as const,
      source,
      planId: plan.id,
      planVersionId: plan.versionId,
      billingCycle: input.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: endsAt,
      renewalDate: endsAt,
      trialEndsAt: null,
      cancelAtPeriodEnd: false,
      pendingPlanId: null,
      pendingBillingCycle: null,
    };
    const sub = before
      ? await tx.subscription.update({ where: { id: before.id }, data })
      : await tx.subscription.create({ data: { ...data, associationId: input.associationId } });

    await tx.subscriptionTerm.create({
      data: {
        subscriptionId: sub.id,
        associationId: input.associationId,
        planVersionId: plan.versionId,
        kind: 'MANUAL',
        billingCycle: input.billingCycle,
        startsAt: now,
        endsAt,
        amountKobo: 0,
        actorId: input.actor.id,
        reason,
      },
    });
    const tier = tierForPlanCode(plan.code);
    await tx.association.update({
      where: { id: input.associationId },
      data: { subscriptionExpiresAt: endsAt, ...(tier ? { tier } : {}) },
    });
    await tx.platformActionLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        actionType: input.complimentary ? 'SUBSCRIPTION_COMPLIMENTARY_GRANTED' : 'SUBSCRIPTION_MANUALLY_ACTIVATED',
        targetType: 'subscription',
        targetId: sub.id,
        associationId: input.associationId,
        beforeState: before ? { planId: before.planId, planVersionId: before.planVersionId, status: before.status, periodEnd: before.currentPeriodEnd.toISOString() } : undefined,
        afterState: { planId: plan.id, planVersionId: plan.versionId, billingCycle: input.billingCycle, periodEnd: endsAt.toISOString(), source },
        reason,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
      },
    });
    return sub;
  });

  afterBillingChange(input.associationId);
  void notifyBillingEvent({ type: 'SUBSCRIPTION_ACTIVATED', associationId: input.associationId, periodEnd: endsAt });
  return result;
}

/** Push the end of the current period out (or, if it has ended, grant time from today). */
export async function extendSubscription(input: { associationId: number; days: number; reason: unknown; actor: Actor }) {
  const reason = requireReason(input.reason);
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 366) throw new BillingError('INVALID_DAYS', 'Extend by between 1 and 366 days.');
  const now = new Date();

  const sub = await prisma.$transaction(async (tx) => {
    const before = await decidingSubscription(tx, input.associationId);
    if (!before) throw new BillingError('NO_SUBSCRIPTION', 'This association has no subscription to extend.', 404);
    const from = before.currentPeriodEnd.getTime() > now.getTime() ? before.currentPeriodEnd : now;
    const endsAt = addDaysUtc(from, input.days);
    const isTrial = before.status === 'TRIALING' && before.trialEndsAt;
    const updated = await tx.subscription.update({
      where: { id: before.id },
      data: {
        status: isTrial ? 'TRIALING' : 'ACTIVE',
        currentPeriodEnd: endsAt,
        renewalDate: endsAt,
        ...(isTrial ? { trialEndsAt: endsAt } : {}),
      },
    });
    await tx.subscriptionTerm.create({
      data: {
        subscriptionId: before.id,
        associationId: input.associationId,
        planVersionId: before.planVersionId,
        kind: 'EXTENSION',
        billingCycle: before.billingCycle,
        startsAt: from,
        endsAt,
        amountKobo: 0,
        actorId: input.actor.id,
        reason,
      },
    });
    await tx.platformActionLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        actionType: 'SUBSCRIPTION_EXTENDED',
        targetType: 'subscription',
        targetId: before.id,
        associationId: input.associationId,
        beforeState: { status: before.status, periodEnd: before.currentPeriodEnd.toISOString() },
        afterState: { status: updated.status, periodEnd: endsAt.toISOString(), days: input.days },
        reason,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
      },
    });
    return updated;
  });

  afterBillingChange(input.associationId);
  return sub;
}

/** Stop an association's access now. Its data and add-ons are untouched; reactivating or paying restores it. */
export async function suspendSubscription(input: { associationId: number; reason: unknown; actor: Actor }) {
  const reason = requireReason(input.reason);
  const sub = await prisma.$transaction(async (tx) => {
    const before = await decidingSubscription(tx, input.associationId);
    if (!before) throw new BillingError('NO_SUBSCRIPTION', 'This association has no subscription.', 404);
    const updated = await tx.subscription.update({ where: { id: before.id }, data: { status: 'EXPIRED' } });
    await tx.platformActionLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        actionType: 'SUBSCRIPTION_SUSPENDED',
        targetType: 'subscription',
        targetId: before.id,
        associationId: input.associationId,
        beforeState: { status: before.status, periodEnd: before.currentPeriodEnd.toISOString() },
        afterState: { status: 'EXPIRED' },
        reason,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
      },
    });
    return updated;
  });
  afterBillingChange(input.associationId);
  void notifyBillingEvent({ type: 'SUBSCRIPTION_EXPIRED', associationId: input.associationId });
  return sub;
}

/** Undo a suspension, but only if paid time remains. Otherwise extend or activate instead. */
export async function reactivateSubscription(input: { associationId: number; reason: unknown; actor: Actor }) {
  const reason = requireReason(input.reason);
  const sub = await prisma.$transaction(async (tx) => {
    const before = await decidingSubscription(tx, input.associationId);
    if (!before) throw new BillingError('NO_SUBSCRIPTION', 'This association has no subscription.', 404);
    if (before.currentPeriodEnd.getTime() <= Date.now()) {
      throw new BillingError('PERIOD_ENDED', 'The paid period has already ended. Extend the subscription or activate a plan instead.');
    }
    const updated = await tx.subscription.update({ where: { id: before.id }, data: { status: before.trialEndsAt ? 'TRIALING' : 'ACTIVE' } });
    await tx.platformActionLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        actionType: 'SUBSCRIPTION_REACTIVATED',
        targetType: 'subscription',
        targetId: before.id,
        associationId: input.associationId,
        beforeState: { status: before.status },
        afterState: { status: updated.status },
        reason,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
      },
    });
    return updated;
  });
  afterBillingChange(input.associationId);
  return sub;
}

/** An audit row to write instead of the default ADDON_GRANTED one, so a caller that gives the grant a purpose (a tier change) leaves one row, not two. */
export interface GrantAudit {
  actionType: string;
  targetType: string;
  targetId: number;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
}

/** The grant itself, inside the caller's transaction. Staff grant of one tier replaces the tier of the same product the tenant already holds. */
export async function grantAddonInTx(tx: Tx, input: { associationId: number; addonId: number; reason: unknown; actor: Actor; audit?: GrantAudit }) {
  const reason = requireReason(input.reason);
  const now = new Date();
  const sub = await decidingSubscription(tx, input.associationId);
  if (!sub || sub.currentPeriodEnd.getTime() <= now.getTime()) {
    throw new BillingError('NO_ACTIVE_SUBSCRIPTION', 'The association needs a running subscription before an add-on can be granted.');
  }
  const version = await tx.addonVersion.findFirst({ where: { addonId: input.addonId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
  if (!version) throw new BillingError('ADDON_UNAVAILABLE', 'That add-on has no published version.', 404);
  const existing = await tx.tenantAddon.findFirst({ where: { subscriptionId: sub.id, addonVersion: { addonId: input.addonId }, status: 'ACTIVE' } });
  const family = (await tx.addon.findUnique({ where: { id: input.addonId }, select: { family: true } }))?.family;
  if (family) {
    await tx.tenantAddon.updateMany({
      where: { subscriptionId: sub.id, status: 'ACTIVE', addonVersion: { addon: { family, id: { not: input.addonId } } } },
      data: { status: 'ENDED', endsAt: now },
    });
  }
  const data = { addonVersionId: version.id, status: 'ACTIVE' as const, billingCycle: sub.billingCycle, endsAt: sub.currentPeriodEnd, cancelAtPeriodEnd: false, pendingAddonId: null, source: 'MANUAL' as const, amountPaidKobo: 0, actorId: input.actor.id, reason };
  const row = existing
    ? await tx.tenantAddon.update({ where: { id: existing.id }, data })
    : await tx.tenantAddon.create({ data: { ...data, associationId: input.associationId, subscriptionId: sub.id, startsAt: now } });
  await tx.platformActionLog.create({
    data: {
      actorId: input.actor.id,
      actorRole: input.actor.role,
      actionType: input.audit?.actionType ?? 'ADDON_GRANTED',
      targetType: input.audit?.targetType ?? 'addon',
      targetId: input.audit?.targetId ?? input.addonId,
      associationId: input.associationId,
      ...(input.audit?.beforeState ? { beforeState: input.audit.beforeState } : {}),
      afterState: input.audit?.afterState ?? { tenantAddonId: row.id, addonVersionId: version.id, endsAt: sub.currentPeriodEnd.toISOString() },
      reason,
      ipAddress: input.actor.ipAddress,
      userAgent: input.actor.userAgent,
    },
  });
  return row;
}

/** Grant an add-on to an association without a payment (staff action). It ends with the subscription's current period. */
export async function grantAddonManually(input: { associationId: number; addonId: number; reason: unknown; actor: Actor }) {
  const result = await prisma.$transaction((tx) => grantAddonInTx(tx, input));
  afterBillingChange(input.associationId);
  return result;
}

/** A tenant (or staff) stops an add-on renewing: it keeps working until its end date. */
export async function cancelAddonAtPeriodEnd(input: { associationId: number; tenantAddonId: number; undo?: boolean }) {
  const row = await prisma.tenantAddon.findFirst({ where: { id: input.tenantAddonId, associationId: input.associationId, status: 'ACTIVE' } });
  if (!row) throw new BillingError('ADDON_NOT_FOUND', 'Add-on not found.', 404);
  const updated = await prisma.tenantAddon.update({ where: { id: row.id }, data: { cancelAtPeriodEnd: !input.undo } });
  afterBillingChange(input.associationId);
  return updated;
}

export { invalidateCatalogCache };
