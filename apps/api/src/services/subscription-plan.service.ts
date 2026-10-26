import { AssociationTier } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getLatestPublishedPlan } from './billing/catalog.service';
import { afterBillingChange } from './billing/lifecycle.service';

const TIER_BY_PLAN_CODE: Record<string, AssociationTier> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  enterprise: 'ENTERPRISE',
};

/** `Association.tier` mirrors the plan's code; unknown/custom plan codes leave the tier untouched. */
export function tierForPlanCode(code: string | null | undefined): AssociationTier | undefined {
  return code ? TIER_BY_PLAN_CODE[code.toLowerCase()] : undefined;
}

/**
 * Platform-admin plan change: points the tenant's live subscription (ACTIVE/TRIALING, else the latest one)
 * at `planId`'s latest published version and syncs `Association.tier`. No payment is taken and the billing period
 * is left as it is — this is the support/override path. The caller records the audit entry with the reason.
 */
export async function setTenantPlan(associationId: number, planId: number) {
  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true, isArchived: false } });
  if (!plan) throw new Error('Plan not found or inactive');
  const terms = await getLatestPublishedPlan(plan.id);
  if (!terms) throw new Error('That plan has no published version yet');

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
      data: { planId: plan.id, planVersionId: terms.versionId, pendingPlanId: null, pendingBillingCycle: null },
    }),
    ...(tier ? [prisma.association.update({ where: { id: associationId }, data: { tier } })] : []),
  ]);
  afterBillingChange(associationId);

  return { subscriptionId: subscription.id, from: previous, to: { id: plan.id, name: plan.name }, tier };
}
