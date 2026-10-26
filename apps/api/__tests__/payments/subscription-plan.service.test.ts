/**
 * The platform-admin "move this tenant to another plan" override, and the plan-code to tier mapping.
 *
 * The old `resolvePaidPlan` (which read the plan out of the payment gateway's metadata) is gone on purpose: activation now takes the plan,
 * version and amount only from the quote the server stored at checkout, and a metadata plan is never trusted. That behaviour is tested in
 * __tests__/billing/ (activation, amount mismatch, idempotency). Prisma is mocked here; no database is touched.
 */
jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    plan: { findFirst: jest.fn(), findUnique: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn() },
    association: { update: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  },
}));
jest.mock('../../src/services/billing/catalog.service', () => ({ getLatestPublishedPlan: jest.fn() }));
jest.mock('../../src/services/billing/lifecycle.service', () => ({ afterBillingChange: jest.fn() }));

import { prisma } from '../../src/lib/prisma';
import { getLatestPublishedPlan } from '../../src/services/billing/catalog.service';
import { afterBillingChange } from '../../src/services/billing/lifecycle.service';
import { setTenantPlan, tierForPlanCode } from '../../src/services/subscription-plan.service';

const planFindFirst = prisma.plan.findFirst as jest.Mock;
const subscriptionFindFirst = prisma.subscription.findFirst as jest.Mock;
const planFindUnique = prisma.plan.findUnique as jest.Mock;
const latestPublished = getLatestPublishedPlan as jest.Mock;

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

describe('setTenantPlan', () => {
  it('points the live subscription at the plan\'s latest published version and syncs the association tier', async () => {
    planFindFirst.mockResolvedValue({ id: 3, name: 'Enterprise', code: 'enterprise' });
    latestPublished.mockResolvedValue({ id: 3, versionId: 31 });
    subscriptionFindFirst.mockResolvedValue({ id: 4, planId: 1, status: 'ACTIVE' });
    planFindUnique.mockResolvedValue({ id: 1, name: 'Starter' });

    const result = await setTenantPlan(15, 3);

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { planId: 3, planVersionId: 31, pendingPlanId: null, pendingBillingCycle: null },
    });
    expect(prisma.association.update).toHaveBeenCalledWith({ where: { id: 15 }, data: { tier: 'ENTERPRISE' } });
    expect(afterBillingChange).toHaveBeenCalledWith(15);
    expect(result).toMatchObject({ from: { name: 'Starter' }, to: { name: 'Enterprise' }, tier: 'ENTERPRISE' });
  });

  it('only considers plans that are active and not archived', async () => {
    planFindFirst.mockResolvedValue(null);
    await expect(setTenantPlan(15, 3)).rejects.toThrow('Plan not found');
    expect(planFindFirst).toHaveBeenCalledWith({ where: { id: 3, isActive: true, isArchived: false } });
  });

  it('rejects a plan with nothing published, and a tenant with no subscription', async () => {
    planFindFirst.mockResolvedValue({ id: 3, name: 'Enterprise', code: 'enterprise' });
    latestPublished.mockResolvedValueOnce(null);
    await expect(setTenantPlan(15, 3)).rejects.toThrow('no published version');

    latestPublished.mockResolvedValue({ id: 3, versionId: 31 });
    subscriptionFindFirst.mockResolvedValue(null);
    await expect(setTenantPlan(15, 3)).rejects.toThrow('no subscription');
  });
});
