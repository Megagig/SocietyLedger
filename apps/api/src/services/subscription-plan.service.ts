import { AssociationTier, BillingCycle } from '@prisma/client';
import { prisma } from '../lib/prisma';

const TIER_BY_PLAN_CODE: Record<string, AssociationTier> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  enterprise: 'ENTERPRISE',
};

/** `Association.tier` mirrors the plan's code; unknown/custom plan codes leave the tier untouched. */
export function tierForPlanCode(code: string | null | undefined): AssociationTier | undefined {
  return code ? TIER_BY_PLAN_CODE[code.toLowerCase()] : undefined;
}

type SubscriptionRef = { id: number; planId: number; associationId: number; billingCycle: BillingCycle };

export type PaidPlan = {
  planId: number;
  billingCycle: BillingCycle;
  /** True only for a `plan_change` confirmation — those also clear any pending deferred downgrade. */
  isPlanChange: boolean;
  /** Tier implied by the plan being activated, if it maps to one. */
  tier?: AssociationTier;
};

function asBillingCycle(value: unknown, fallback: BillingCycle): BillingCycle {
  return value === 'MONTHLY' || value === 'ANNUAL' ? value : fallback;
}

/**
 * Works out which plan a successful subscription payment should activate, from the gateway metadata
 * the checkout was initialised with.
 *
 * Two shapes exist: `type: 'plan_change'` + `newPlanId` (the change-plan flow) and a plain checkout
 * carrying `planId` + `subscriptionId` (the subscribe/upgrade flow). Previously only the first was read,
 * so paying for a higher plan through plain checkout recorded the money but kept the old plan.
 * Metadata for another association or subscription is ignored, as is a missing/inactive plan.
 */
export async function resolvePaidPlan(metadata: unknown, subscription: SubscriptionRef): Promise<PaidPlan> {
  const keep: PaidPlan = { planId: subscription.planId, billingCycle: subscription.billingCycle, isPlanChange: false };
  const m = (metadata && typeof metadata === 'object' ? metadata : {}) as Record<string, unknown>;

  if (m.associationId !== undefined && Number(m.associationId) !== subscription.associationId) return keep;

  const isPlanChange = m.type === 'plan_change' && !!m.newPlanId;
  const targetPlanId = isPlanChange
    ? Number(m.newPlanId)
    : m.planId !== undefined && Number(m.subscriptionId) === subscription.id
      ? Number(m.planId)
      : subscription.planId;

  const plan = await prisma.plan.findFirst({ where: { id: targetPlanId, isActive: true }, select: { id: true, code: true } });
  if (!plan) return keep;

  return {
    planId: plan.id,
    billingCycle: asBillingCycle(m.billingCycle, subscription.billingCycle),
    isPlanChange,
    tier: tierForPlanCode(plan.code),
  };
}

/**
 * Platform-admin plan change: points the tenant's live subscription (ACTIVE/TRIALING, else the latest one)
 * at `planId` and syncs `Association.tier`. No payment is taken — this is the support/override path.
 */
export async function setTenantPlan(associationId: number, planId: number) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw new Error('Plan not found or inactive');

  const subscription =
    (await prisma.subscription.findFirst({
      where: { associationId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    })) ?? (await prisma.subscription.findFirst({ where: { associationId }, orderBy: { createdAt: 'desc' } }));
  if (!subscription) throw new Error('This association has no subscription to change');

  const previous = await prisma.plan.findUnique({ where: { id: subscription.planId }, select: { id: true, name: true } });
  const tier = tierForPlanCode(plan.code);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: { planId: plan.id, pendingPlanId: null, pendingBillingCycle: null },
    }),
    ...(tier ? [prisma.association.update({ where: { id: associationId }, data: { tier } })] : []),
  ]);

  return { subscriptionId: subscription.id, from: previous, to: { id: plan.id, name: plan.name }, tier };
}
