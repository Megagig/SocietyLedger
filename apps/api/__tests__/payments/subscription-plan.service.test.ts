/**
 * Regression tests for the "paid for Enterprise, stayed on Starter" bug: a plain subscription checkout
 * carries `planId` + `subscriptionId` in its gateway metadata (not `type: 'plan_change'`), and the verify /
 * webhook handlers used to ignore it. Prisma is mocked; no database is touched.
 */
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    plan: { findFirst: jest.fn(), findUnique: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn() },
    association: { update: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  },
}));

import { prisma } from '../../src/lib/prisma';
import { resolvePaidPlan, setTenantPlan, tierForPlanCode } from '../../src/services/subscription-plan.service';

const planFindFirst = prisma.plan.findFirst as jest.Mock;
const subscriptionFindFirst = prisma.subscription.findFirst as jest.Mock;
const planFindUnique = prisma.plan.findUnique as jest.Mock;

const subscription = { id: 4, planId: 1, associationId: 15, billingCycle: 'MONTHLY' as const };

beforeEach(() => jest.clearAllMocks());

describe('tierForPlanCode', () => {
  it('maps the seeded plan codes to tiers and ignores unknown ones', () => {
    expect(tierForPlanCode('starter')).toBe('STARTER');
    expect(tierForPlanCode('Professional')).toBe('PROFESSIONAL');
    expect(tierForPlanCode('enterprise')).toBe('ENTERPRISE');
    expect(tierForPlanCode('custom-plan')).toBeUndefined();
    expect(tierForPlanCode(null)).toBeUndefined();
  });
});

describe('resolvePaidPlan', () => {
  it('activates the plan from a plain checkout (planId + subscriptionId) — the reported bug', async () => {
    planFindFirst.mockResolvedValue({ id: 3, code: 'enterprise' });

    const result = await resolvePaidPlan(
      { planId: 3, subscriptionId: 4, associationId: 15, billingCycle: 'MONTHLY' },
      subscription,
    );

    expect(result).toEqual({ planId: 3, billingCycle: 'MONTHLY', isPlanChange: false, tier: 'ENTERPRISE' });
  });

  it('still honours a plan_change confirmation and flags it so pending downgrades are cleared', async () => {
    planFindFirst.mockResolvedValue({ id: 2, code: 'professional' });

    const result = await resolvePaidPlan({ type: 'plan_change', newPlanId: 2, billingCycle: 'ANNUAL' }, subscription);

    expect(result).toEqual({ planId: 2, billingCycle: 'ANNUAL', isPlanChange: true, tier: 'PROFESSIONAL' });
  });

  it('keeps the current plan for a plain renewal with no plan metadata', async () => {
    planFindFirst.mockResolvedValue({ id: 1, code: 'starter' });

    const result = await resolvePaidPlan({}, subscription);

    expect(result.planId).toBe(1);
    expect(result.isPlanChange).toBe(false);
  });

  it('ignores metadata that belongs to another association or subscription', async () => {
    const otherTenant = await resolvePaidPlan({ planId: 3, subscriptionId: 4, associationId: 99 }, subscription);
    const otherSubscription = await resolvePaidPlan({ planId: 3, subscriptionId: 77, associationId: 15 }, subscription);

    expect(otherTenant).toEqual({ planId: 1, billingCycle: 'MONTHLY', isPlanChange: false });
    expect(otherSubscription.planId).toBe(1);
  });

  it('keeps the current plan when the target plan is missing or inactive', async () => {
    planFindFirst.mockResolvedValue(null);

    const result = await resolvePaidPlan({ planId: 3, subscriptionId: 4, associationId: 15 }, subscription);

    expect(result).toEqual({ planId: 1, billingCycle: 'MONTHLY', isPlanChange: false });
  });

  it('falls back to the subscription billing cycle when the metadata value is invalid', async () => {
    planFindFirst.mockResolvedValue({ id: 3, code: 'enterprise' });

    const result = await resolvePaidPlan({ planId: 3, subscriptionId: 4, billingCycle: 'WEEKLY' }, subscription);

    expect(result.billingCycle).toBe('MONTHLY');
  });
});

describe('setTenantPlan', () => {
  it('points the live subscription at the plan and syncs the association tier', async () => {
    planFindFirst.mockResolvedValue({ id: 3, name: 'Enterprise', code: 'enterprise' });
    subscriptionFindFirst.mockResolvedValue({ id: 4, planId: 1, status: 'ACTIVE' });
    planFindUnique.mockResolvedValue({ id: 1, name: 'Starter' });

    const result = await setTenantPlan(15, 3);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { planId: 3, pendingPlanId: null, pendingBillingCycle: null },
    });
    expect(prisma.association.update).toHaveBeenCalledWith({ where: { id: 15 }, data: { tier: 'ENTERPRISE' } });
    expect(result).toMatchObject({ from: { name: 'Starter' }, to: { name: 'Enterprise' }, tier: 'ENTERPRISE' });
  });

  it('rejects an unknown plan and a tenant with no subscription', async () => {
    planFindFirst.mockResolvedValueOnce(null);
    await expect(setTenantPlan(15, 999)).rejects.toThrow('Plan not found');

    planFindFirst.mockResolvedValueOnce({ id: 3, name: 'Enterprise', code: 'enterprise' });
    subscriptionFindFirst.mockResolvedValue(null);
    await expect(setTenantPlan(15, 3)).rejects.toThrow('no subscription');
  });
});
