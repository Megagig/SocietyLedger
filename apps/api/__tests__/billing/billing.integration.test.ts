/**
 * Billing against a real (disposable) database: plan versions, onboarding, verified-payment activation, entitlements, add-ons, lockout,
 * migrations and authorization.
 *
 * Needs a migrated database. Point BILLING_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped, so a normal `pnpm test` never touches a database.
 *
 *   BILLING_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_migtest pnpm -F @societyledger/api exec jest __tests__/billing
 */
import type { BillingCycle } from '@prisma/client';

const TEST_DB = process.env.BILLING_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('BILLING_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => undefined), sendBulkEmail: jest.fn() }));
const sent: Array<{ type: string; associationId: number }> = [];
jest.mock('../../src/services/billing/billing-notifications.service', () => ({
  notifyBillingEvent: jest.fn(async (e: { type: string; associationId: number }) => {
    sent.push(e);
  }),
  sendBillingEmail: jest.fn(),
}));

const suite = TEST_DB ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const code = (s: string) => `${s}-${run}`;
const actor = { id: 9001, role: 'SUPER_ADMIN' };

/* eslint-disable @typescript-eslint/no-var-requires */
suite('billing (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let builder: typeof import('../../src/services/billing/plan-builder.service');
  let lifecycle: typeof import('../../src/services/billing/lifecycle.service');
  let quotes: typeof import('../../src/services/billing/quote.service');
  let catalog: typeof import('../../src/services/billing/catalog.service');
  let entitlements: typeof import('../../src/services/billing/entitlements.service');
  let migrations: typeof import('../../src/services/billing/migration.service');
  let access: typeof import('../../src/services/subscription-access.service');
  let settingsOverride: Record<string, unknown>;

  const modules = { core: code('core'), a: code('mod-a'), b: code('mod-b'), c: code('mod-c') };
  const feature = code('feat-a') ;
  const ids: Record<string, number> = {};
  let planStarter: number;
  let planPro: number;
  let planEnt: number;

  async function publishPlan(planCode: string, name: string, monthly: number, annual: number, mods: string[], limits: Record<string, number | null> = {}, extra: Record<string, unknown> = {}) {
    const plan = await builder.createPlan({ code: planCode, name, priceMonthlyKobo: monthly, priceAnnualKobo: annual, moduleCodes: mods, featureCodes: [], limits, isPublic: true, ...extra }, actor);
    await builder.publishDraft(plan.id, actor);
    return plan.id;
  }

  async function newAssociation(label: string) {
    const sub = `${label}-${run}`.slice(0, 40);
    return prisma.association.create({ data: { name: `Test ${label}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE' } });
  }

  /** A subscription row exactly as registration creates it, then started the way approval starts it. */
  async function onboard(associationId: number, planId: number) {
    const version = await catalog.getLatestPublishedPlan(planId);
    const sub = await prisma.subscription.create({
      data: lifecycle.onboardingSubscriptionData({ planId, planVersionId: version!.versionId, code: 'x' }, associationId, new Date()),
    });
    await access.startTrialIfPending(associationId);
    return sub;
  }

  /** Create the pending payment the way checkout does, from the server's own quote. */
  async function pendingPayment(associationId: number, planId: number, cycle: BillingCycle, addonIds?: number[]) {
    const quote = await quotes.quotePlanCheckout(associationId, { planId, billingCycle: cycle, addonIds });
    const subs = await prisma.subscription.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' } });
    const subscriptionId = subs[0].id;
    const reference = `SUB-T-${run}-${Math.random().toString(36).slice(2, 8)}`;
    await prisma.paymentHistory.create({
      data: { subscriptionId, amount: quote.totalKobo / 100, status: 'PENDING', provider: 'paystack', reference, purpose: 'SUBSCRIPTION', expectedAmountKobo: quote.totalKobo, quote: { ...quote, initiatedBy: 1 } as never },
    });
    return { quote, reference, subscriptionId };
  }

  async function expire(associationId: number, daysAgo: number) {
    await prisma.subscription.updateMany({ where: { associationId }, data: { status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - daysAgo * DAY), trialEndsAt: null } });
    access.invalidateAccessCache(associationId);
    entitlements.invalidateEntitlements(associationId);
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    builder = require('../../src/services/billing/plan-builder.service');
    lifecycle = require('../../src/services/billing/lifecycle.service');
    quotes = require('../../src/services/billing/quote.service');
    catalog = require('../../src/services/billing/catalog.service');
    entitlements = require('../../src/services/billing/entitlements.service');
    migrations = require('../../src/services/billing/migration.service');
    access = require('../../src/services/subscription-access.service');
    const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');

    settingsOverride = { onboardingPlanCode: code('ent'), defaultTrialDays: 14, gracePeriodDays: 3, onboardingPolicy: 'TRIAL' };
    jest.spyOn(PlatformSettingsService, 'getSettings').mockImplementation(async () => ({
      maintenanceMode: false, maxAssociationsPerUser: 3, allowNewSignups: true, requireEmailVerification: true, requireAdminApproval: true,
      enforceSubscriptionAccess: true, defaultAssociationTier: 'STARTER', platformVersion: '1', expiryReminderDays: [7, 3, 1],
      ...settingsOverride,
    }));

    ids.core = (await prisma.platformModule.create({ data: { code: modules.core, name: 'Core', isCore: true } })).id;
    ids.a = (await prisma.platformModule.create({ data: { code: modules.a, name: 'Module A' } })).id;
    ids.b = (await prisma.platformModule.create({ data: { code: modules.b, name: 'Module B' } })).id;
    ids.c = (await prisma.platformModule.create({ data: { code: modules.c, name: 'Module C' } })).id;
    await prisma.platformFeature.create({ data: { code: feature, name: 'Feature A', moduleId: ids.a } });

    planStarter = await publishPlan(code('starter'), 'T Starter', 800_000, 8_000_000, [modules.a], { members: 2 });
    planPro = await publishPlan(code('pro'), 'T Pro', 1_000_000, 10_000_000, [modules.a, modules.b], { members: 500 }, { isRecommended: true });
    planEnt = await publishPlan(code('ent'), 'T Enterprise', 1_500_000, 15_000_000, [modules.a, modules.b, modules.c]);
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ------------------------------------------------------------------------------------------------------------ plan builder & versions
  describe('Plan Builder and versions', () => {
    it('shows only published, visible plans, with kobo prices formatted in full', async () => {
      const list = await catalog.listPurchasablePlans();
      const mine = list.filter((p) => p.code.endsWith(run));
      expect(mine.map((p) => p.name)).toEqual(['T Starter', 'T Pro', 'T Enterprise']);
      expect(mine[1].prices).toMatchObject({ monthly: '₦10,000.00', annual: '₦100,000.00', annualSavings: '₦20,000.00' });
      expect(mine[1].isRecommended).toBe(true);
    });

    it('keeps a draft away from customers, and publishing a change to a live plan needs a reason', async () => {
      await builder.getOrCreateDraft(planStarter, actor);
      await builder.updateDraft(planStarter, { priceMonthlyKobo: 900_000, priceAnnualKobo: 9_000_000 }, actor);
      // still the old price for customers
      expect((await catalog.getLatestPublishedPlan(planStarter))!.prices.monthlyKobo).toBe(800_000);
      expect((await catalog.listPurchasablePlans()).find((p) => p.id === planStarter)!.prices.monthlyKobo).toBe(800_000);

      await expect(builder.publishDraft(planStarter, actor, 'short')).rejects.toThrow(/reason/i);
      await builder.publishDraft(planStarter, actor, 'Annual price review for the new year');
      catalog.invalidateCatalogCache();
      expect((await catalog.listPurchasablePlans()).find((p) => p.id === planStarter)!.prices.monthlyKobo).toBe(900_000);

      const versions = await prisma.planVersion.findMany({ where: { planId: planStarter }, orderBy: { version: 'asc' } });
      expect(versions.map((v) => [v.version, v.status])).toEqual([[1, 'SUPERSEDED'], [2, 'PUBLISHED']]);
      // restore the launch price for the tests below
      await builder.getOrCreateDraft(planStarter, actor);
      await builder.updateDraft(planStarter, { priceMonthlyKobo: 800_000, priceAnnualKobo: 8_000_000 }, actor);
      await builder.publishDraft(planStarter, actor, 'Back to the launch price for testing');
      catalog.invalidateCatalogCache();
    });

    it('writes who changed what, why, before and after, to the audit trail', async () => {
      const log = await prisma.platformActionLog.findMany({ where: { targetType: 'plan', targetId: planStarter, actionType: 'PLAN_VERSION_PUBLISHED' }, orderBy: { id: 'asc' } });
      expect(log.length).toBeGreaterThanOrEqual(2);
      const first = log.find((l) => (l.afterState as { priceMonthlyKobo: number }).priceMonthlyKobo === 900_000)!;
      expect(first).toMatchObject({ actorId: actor.id, reason: 'Annual price review for the new year' });
      expect((first.beforeState as { priceMonthlyKobo: number }).priceMonthlyKobo).toBe(800_000);
    });

    it('always includes core modules, whatever the owner picks', async () => {
      const terms = await catalog.getLatestPublishedPlan(planStarter);
      expect(terms!.modules.map((m) => m.code)).toEqual(expect.arrayContaining([modules.core, modules.a]));
    });

    it('previews the impact of a publish before it happens', async () => {
      await builder.getOrCreateDraft(planPro, actor);
      await builder.updateDraft(planPro, { moduleCodes: [modules.a], priceMonthlyKobo: 1_200_000 }, actor);
      const preview = await builder.previewPublish(planPro);
      expect(preview).toMatchObject({ fromVersion: 1, toVersion: 2, modulesRemoved: [modules.b], price: { monthly: { from: 1_000_000, to: 1_200_000 } } });
      expect(preview.warnings.join(' ')).toMatch(/Existing subscribers keep/);
      await builder.discardDraft(planPro, actor);
    });

    it('hides a plan that is made not public, deactivated or archived, without touching existing subscribers', async () => {
      const temp = await publishPlan(code('temp'), 'T Temp', 100_000, 1_000_000, [modules.a]);
      expect((await catalog.listPurchasablePlans()).some((p) => p.id === temp)).toBe(true);
      const assoc = await newAssociation('arch');
      await onboard(assoc.id, temp);
      await builder.archivePlan(temp, actor, 'Retiring this plan for testing');
      expect((await catalog.listPurchasablePlans()).some((p) => p.id === temp)).toBe(false);
      await expect(quotes.quotePlanCheckout(assoc.id, { planId: temp, billingCycle: 'MONTHLY' })).rejects.toThrow(/not available/);
      // the existing subscription still resolves its entitlements from the archived plan's version
      const e = await entitlements.computeEntitlements(assoc.id);
      expect(e.planCode).toBe(code('temp'));
      expect(e.modules.get(modules.a)!.isEnabled).toBe(true);
    });

    it('will not archive or deactivate the plan new associations are given', async () => {
      await expect(builder.archivePlan(planEnt, actor, 'Trying to archive the onboarding plan')).rejects.toThrow(/new associations are given/);
      await expect(builder.updatePlanMeta(planEnt, { isActive: false }, actor)).rejects.toThrow(/new associations are given/);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ onboarding
  describe('onboarding', () => {
    it('gives a new association the published onboarding plan version with no end date until approval', async () => {
      const onboarding = await lifecycle.resolveOnboardingPlan();
      expect(onboarding.planId).toBe(planEnt);
      const assoc = await newAssociation('onb1');
      const sub = await prisma.subscription.create({ data: lifecycle.onboardingSubscriptionData(onboarding, assoc.id, new Date()) });
      expect(sub).toMatchObject({ status: 'TRIALING', source: 'ONBOARDING', trialEndsAt: null, planVersionId: onboarding.planVersionId });
      // not locked while waiting for approval
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(true);
    });

    it('starts a defined-length trial on approval, records it as unpaid, and creates no payment', async () => {
      const assoc = await newAssociation('onb2');
      const sub = await onboard(assoc.id, planEnt);
      const row = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(row.trialEndsAt!.getTime() - Date.now()).toBeGreaterThan(13.9 * DAY);
      expect(row.trialEndsAt!.getTime() - Date.now()).toBeLessThan(14.1 * DAY);
      const terms = await prisma.subscriptionTerm.findMany({ where: { subscriptionId: sub.id } });
      expect(terms).toHaveLength(1);
      expect(terms[0]).toMatchObject({ kind: 'ONBOARDING', amountKobo: 0, paymentHistoryId: null });
      expect(await prisma.paymentHistory.count({ where: { subscriptionId: sub.id } })).toBe(0);
    });

    it('starting the clock twice does not extend it (a retried request creates nothing new)', async () => {
      const assoc = await newAssociation('onb3');
      const sub = await onboard(assoc.id, planEnt);
      const before = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(await access.startTrialIfPending(assoc.id)).toBeNull();
      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      expect(after.trialEndsAt!.getTime()).toBe(before.trialEndsAt!.getTime());
      expect(await prisma.subscriptionTerm.count({ where: { subscriptionId: sub.id } })).toBe(1);
    });

    it('records a complimentary onboarding as an active unpaid subscription, not a trial', async () => {
      settingsOverride.onboardingPolicy = 'COMPLIMENTARY';
      try {
        const assoc = await newAssociation('onb4');
        const sub = await onboard(assoc.id, planEnt);
        const row = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
        expect(row).toMatchObject({ status: 'ACTIVE', source: 'COMPLIMENTARY', trialEndsAt: null });
        expect(await prisma.paymentHistory.count({ where: { subscriptionId: sub.id } })).toBe(0);
      } finally {
        settingsOverride.onboardingPolicy = 'TRIAL';
      }
    });

    it('a billable policy locks the association until it pays', async () => {
      settingsOverride.onboardingPolicy = 'BILLABLE';
      try {
        const assoc = await newAssociation('onb5');
        await onboard(assoc.id, planEnt);
        access.invalidateAccessCache(assoc.id);
        expect(await access.getAssociationAccess(assoc.id)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
      } finally {
        settingsOverride.onboardingPolicy = 'TRIAL';
      }
    });

    it('gives the onboarding association exactly what the CURRENT published plan includes', async () => {
      const assoc = await newAssociation('onb6');
      await onboard(assoc.id, planEnt);
      const e = await entitlements.computeEntitlements(assoc.id);
      for (const m of [modules.core, modules.a, modules.b, modules.c]) expect(e.modules.get(m)!.isEnabled).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ payment & activation
  describe('verified payment and activation', () => {
    it('activates exactly the plan that was quoted, with the right dates, a term, and an audit entry', async () => {
      const assoc = await newAssociation('pay1');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30); // an expired tenant
      access.invalidateAccessCache(assoc.id);
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(false);

      const { quote, reference, subscriptionId } = await pendingPayment(assoc.id, planStarter, 'ANNUAL');
      expect(quote).toMatchObject({ kind: 'SUBSCRIBE', totalKobo: 8_000_000 });
      const result = await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 8_000_000 });
      expect(result.outcome).toBe('ACTIVATED');

      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(sub).toMatchObject({ status: 'ACTIVE', planId: planStarter, billingCycle: 'ANNUAL', source: 'PURCHASE' });
      expect(sub.currentPeriodEnd.getTime() - Date.now()).toBeGreaterThan(364 * DAY);
      const term = await prisma.subscriptionTerm.findFirstOrThrow({ where: { subscriptionId, kind: 'PURCHASE' } });
      expect(term).toMatchObject({ amountKobo: 8_000_000 });
      expect(await prisma.platformActionLog.count({ where: { associationId: assoc.id, actionType: 'SUBSCRIPTION_PAYMENT_VERIFIED' } })).toBe(1);

      // access is back, and only the Starter plan's modules are on (not Enterprise's)
      access.invalidateAccessCache(assoc.id);
      entitlements.invalidateEntitlements(assoc.id);
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(true);
      const e = await entitlements.computeEntitlements(assoc.id);
      expect(e.modules.get(modules.a)!.isEnabled).toBe(true);
      expect(e.modules.get(modules.b)!.isEnabled).toBe(false);
      expect(e.modules.get(modules.c)!.isEnabled).toBe(false);
    });

    it('does nothing the second time the same payment is reported, even in parallel (webhook + verify + return page)', async () => {
      const assoc = await newAssociation('pay2');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const { reference, subscriptionId } = await pendingPayment(assoc.id, planPro, 'MONTHLY');

      const results = await Promise.all(Array.from({ length: 6 }, () => lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 1_000_000 })));
      expect(results.filter((r) => r.outcome === 'ACTIVATED')).toHaveLength(1);
      expect(results.filter((r) => r.outcome === 'ALREADY_APPLIED')).toHaveLength(5);

      expect(await prisma.subscriptionTerm.count({ where: { subscriptionId, kind: 'PURCHASE' } })).toBe(1);
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(sub.currentPeriodEnd.getTime() - Date.now()).toBeLessThan(31.1 * DAY); // one month, not six
      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 1_000_000 })).outcome).toBe('ALREADY_APPLIED');
    });

    it('does not activate when the verified amount differs from the quote; the payment is kept for review', async () => {
      const assoc = await newAssociation('pay3');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const { reference, subscriptionId } = await pendingPayment(assoc.id, planEnt, 'MONTHLY');

      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 1_000_000 })).outcome).toBe('NEEDS_REVIEW'); // paid Pro money for Enterprise
      const payment = await prisma.paymentHistory.findUniqueOrThrow({ where: { reference } });
      expect(payment).toMatchObject({ needsReview: true, appliedAt: null, status: 'SUCCESS' });
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(sub.currentPeriodEnd.getTime()).toBeLessThan(Date.now()); // still expired
      // even a later report with the right amount cannot sneak it through
      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 1_500_000 })).outcome).toBe('NEEDS_REVIEW');
      access.invalidateAccessCache(assoc.id);
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(false);
    });

    it('never activates a checkout that has no stored quote (an old pending payment)', async () => {
      const assoc = await newAssociation('pay4');
      const sub = await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const reference = `SUB-T-${run}-legacy`;
      await prisma.paymentHistory.create({ data: { subscriptionId: sub.id, amount: 8000, status: 'PENDING', provider: 'paystack', reference } });
      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: 800_000 })).outcome).toBe('NEEDS_REVIEW');
    });

    it('reports an unknown reference as not found', async () => {
      expect((await lifecycle.activateFromPayment({ reference: 'SUB-DOES-NOT-EXIST', verifiedAmountKobo: 1 })).outcome).toBe('NOT_FOUND');
    });

    it('an upgrade credits the unused part of what was paid and starts a fresh term', async () => {
      const assoc = await newAssociation('pay5');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const first = await pendingPayment(assoc.id, planStarter, 'MONTHLY');
      await lifecycle.activateFromPayment({ reference: first.reference, verifiedAmountKobo: 800_000 });
      access.invalidateAccessCache(assoc.id);

      const second = await pendingPayment(assoc.id, planEnt, 'MONTHLY');
      expect(second.quote.kind).toBe('CHANGE');
      expect(second.quote.lines.some((l) => l.type === 'CREDIT')).toBe(true);
      expect(second.quote.totalKobo).toBeLessThan(1_500_000);
      expect(second.quote.totalKobo).toBeGreaterThan(1_500_000 - 800_000 - 1);
      await lifecycle.activateFromPayment({ reference: second.reference, verifiedAmountKobo: second.quote.totalKobo });
      entitlements.invalidateEntitlements(assoc.id);
      expect((await entitlements.computeEntitlements(assoc.id)).modules.get(modules.c)!.isEnabled).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ lockout
  describe('expiry and lockout', () => {
    it('blocks an association whose paid period ended beyond the grace period, even if the status column still says ACTIVE', async () => {
      const assoc = await newAssociation('lock1');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 1); // 1 day ago: inside the 3-day grace
      expect(await access.getAssociationAccess(assoc.id)).toMatchObject({ allowed: true, inGrace: true });
      await expire(assoc.id, 5); // beyond grace
      expect(await access.getAssociationAccess(assoc.id)).toMatchObject({ allowed: false, reason: 'EXPIRED' });
    });

    it('keeps every record when a subscription expires', async () => {
      const assoc = await newAssociation('lock2');
      await onboard(assoc.id, planEnt);
      await prisma.member.create({ data: { associationId: assoc.id, memberId: `M-${run}`, firstName: 'Ada', lastName: 'Okafor', status: 'active' } as never });
      await expire(assoc.id, 40);
      expect(await prisma.member.count({ where: { associationId: assoc.id } })).toBe(1);
      expect(await prisma.association.count({ where: { id: assoc.id } })).toBe(1);
    });

    it('a suspended tenant is locked and a reactivation needs paid time and a reason', async () => {
      const assoc = await newAssociation('lock3');
      await onboard(assoc.id, planEnt);
      await lifecycle.suspendSubscription({ associationId: assoc.id, reason: 'Chargeback under investigation', actor });
      access.invalidateAccessCache(assoc.id);
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(false);
      await expect(lifecycle.reactivateSubscription({ associationId: assoc.id, reason: 'short', actor })).rejects.toThrow(/reason/);
      await lifecycle.reactivateSubscription({ associationId: assoc.id, reason: 'Investigation closed, no issue', actor });
      access.invalidateAccessCache(assoc.id);
      expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ versioning for existing subscribers
  describe('existing subscribers keep their terms', () => {
    it('a new version does not change a current subscriber, a new buyer gets it, and migration moves the subscriber deliberately', async () => {
      const planCode = code('ver');
      const planId = await publishPlan(planCode, 'T Versioned', 500_000, 5_000_000, [modules.a, modules.b]);
      const subscriberA = await newAssociation('ver1');
      await onboard(subscriberA.id, planId);
      await expire(subscriberA.id, -20); // paid, 20 days left
      const v1 = (await catalog.getLatestPublishedPlan(planId))!;

      // owner raises the price and removes a module
      await builder.getOrCreateDraft(planId, actor);
      await builder.updateDraft(planId, { priceMonthlyKobo: 700_000, priceAnnualKobo: 7_000_000, moduleCodes: [modules.a] }, actor);
      await builder.publishDraft(planId, actor, 'Price increase and module change for testing');
      const v2 = (await catalog.getLatestPublishedPlan(planId))!;
      expect(v2.versionId).not.toBe(v1.versionId);

      // existing subscriber: untouched
      entitlements.invalidateEntitlements(subscriberA.id);
      expect((await prisma.subscription.findFirstOrThrow({ where: { associationId: subscriberA.id } })).planVersionId).toBe(v1.versionId);
      expect((await entitlements.computeEntitlements(subscriberA.id)).modules.get(modules.b)!.isEnabled).toBe(true);
      // renewing keeps their price
      expect((await quotes.quotePlanCheckout(subscriberA.id, { planId, billingCycle: 'MONTHLY' }))).toMatchObject({ kind: 'RENEW', totalKobo: 500_000, planVersionId: v1.versionId });

      // a brand-new buyer: latest version and price
      const buyer = await newAssociation('ver2');
      await onboard(buyer.id, planEnt);
      await expire(buyer.id, 30);
      expect(await quotes.quotePlanCheckout(buyer.id, { planId, billingCycle: 'MONTHLY' })).toMatchObject({ kind: 'SUBSCRIBE', totalKobo: 700_000, planVersionId: v2.versionId });

      // deliberate migration
      const preview = await migrations.previewMigration({ planId, fromVersionId: v1.versionId, toVersionId: v2.versionId });
      expect(preview).toMatchObject({ affectedSubscriptions: 1, modulesLost: [modules.b] });
      expect(preview.sample[0]).toMatchObject({ associationId: subscriberA.id, currentPriceKobo: 500_000, newPriceKobo: 700_000 });
      await expect(migrations.scheduleMigration({ planId, fromVersionId: v1.versionId, toVersionId: v2.versionId, effectiveAt: new Date(), reason: 'nope' }, actor)).rejects.toThrow(/reason/);
      await migrations.scheduleMigration({ planId, fromVersionId: v1.versionId, toVersionId: v2.versionId, effectiveAt: new Date(Date.now() + 5 * DAY), reason: 'Moving everyone to the new terms' }, actor);
      // scheduled for later: nothing has moved yet
      expect((await prisma.subscription.findFirstOrThrow({ where: { associationId: subscriberA.id } })).planVersionId).toBe(v1.versionId);
      // the date arrives
      expect(await migrations.applyDueMigrations(new Date(Date.now() + 6 * DAY))).toBe(1);
      entitlements.invalidateEntitlements(subscriberA.id);
      expect((await prisma.subscription.findFirstOrThrow({ where: { associationId: subscriberA.id } })).planVersionId).toBe(v2.versionId);
      expect((await entitlements.computeEntitlements(subscriberA.id)).modules.get(modules.b)!.isEnabled).toBe(false);
      expect(await prisma.platformActionLog.count({ where: { associationId: subscriberA.id, actionType: 'SUBSCRIPTION_MIGRATED' } })).toBe(1);
      // applying twice moves nobody twice
      expect(await migrations.applyDueMigrations(new Date(Date.now() + 7 * DAY))).toBe(0);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ add-ons
  describe('add-ons', () => {
    let addonId: number;

    beforeAll(async () => {
      const addon = await builder.createAddon({ code: code('addon'), name: 'T Extra Module C', priceMonthlyKobo: 300_000, priceAnnualKobo: 3_000_000, moduleCodes: [modules.c], limits: { members: 50 }, isPublic: true }, actor);
      addonId = addon.id;
      await builder.publishAddonDraft(addonId, actor);
      catalog.invalidateCatalogCache();
    });

    it('is bought prorated to the renewal date, ends with the plan period, and adds its modules and limit', async () => {
      const assoc = await newAssociation('add1');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const first = await pendingPayment(assoc.id, planStarter, 'MONTHLY');
      await lifecycle.activateFromPayment({ reference: first.reference, verifiedAmountKobo: 800_000 });
      // put the plan period in the middle: 15 days remain
      await prisma.subscription.updateMany({ where: { associationId: assoc.id }, data: { currentPeriodEnd: new Date(Date.now() + 15 * DAY) } });
      access.invalidateAccessCache(assoc.id);

      const quote = await quotes.quoteAddonCheckout(assoc.id, { addonIds: [addonId] });
      expect(quote.kind).toBe('ADDON');
      expect(quote.totalKobo).toBeGreaterThan(130_000);
      expect(quote.totalKobo).toBeLessThan(170_000); // about half of the 300,000 monthly price

      const subscriptionId = (await prisma.subscription.findFirstOrThrow({ where: { associationId: assoc.id } })).id;
      const reference = `ADDON-T-${run}-${Math.random().toString(36).slice(2, 7)}`;
      await prisma.paymentHistory.create({ data: { subscriptionId, amount: quote.totalKobo / 100, status: 'PENDING', provider: 'paystack', reference, purpose: 'ADDON', expectedAmountKobo: quote.totalKobo, quote: { ...quote, initiatedBy: 1 } as never } });
      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: quote.totalKobo })).outcome).toBe('ACTIVATED');
      expect((await lifecycle.activateFromPayment({ reference, verifiedAmountKobo: quote.totalKobo })).outcome).toBe('ALREADY_APPLIED');

      const held = await prisma.tenantAddon.findMany({ where: { associationId: assoc.id } });
      expect(held).toHaveLength(1);
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(held[0].endsAt.getTime()).toBe(sub.currentPeriodEnd.getTime());

      entitlements.invalidateEntitlements(assoc.id);
      const e = await entitlements.computeEntitlements(assoc.id);
      expect(e.modules.get(modules.c)).toMatchObject({ isEnabled: true, source: 'addon' });
      expect(e.limits.members).toBe(2 + 50); // Starter's 2 plus the add-on's 50

      // buying it again is refused
      await expect(quotes.quoteAddonCheckout(assoc.id, { addonIds: [addonId] })).rejects.toThrow(/already have/);
    });

    it('stops granting anything when the subscription it rides on has expired', async () => {
      const assoc = await newAssociation('add2');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      const first = await pendingPayment(assoc.id, planStarter, 'MONTHLY');
      await lifecycle.activateFromPayment({ reference: first.reference, verifiedAmountKobo: 800_000 });
      await lifecycle.grantAddonManually({ associationId: assoc.id, addonId, reason: 'Goodwill for a long-standing customer', actor });
      entitlements.invalidateEntitlements(assoc.id);
      expect((await entitlements.computeEntitlements(assoc.id)).modules.get(modules.c)!.isEnabled).toBe(true);

      await expire(assoc.id, 10); // period and add-on both ended, beyond grace
      await prisma.tenantAddon.updateMany({ where: { associationId: assoc.id }, data: { endsAt: new Date(Date.now() - 10 * DAY) } });
      entitlements.invalidateEntitlements(assoc.id);
      expect((await entitlements.computeEntitlements(assoc.id)).modules.get(modules.c)!.isEnabled).toBe(false);
    });

    it('cannot be bought without a running paid subscription', async () => {
      const assoc = await newAssociation('add3');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      await expect(quotes.quoteAddonCheckout(assoc.id, { addonIds: [addonId] })).rejects.toThrow(/active subscription/);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ manual actions
  describe('manual actions', () => {
    it('activating by hand needs a reason, records an unpaid term and an audit entry, and never creates a payment', async () => {
      const assoc = await newAssociation('man1');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, 30);
      await expect(lifecycle.activateManually({ associationId: assoc.id, planId: planPro, billingCycle: 'MONTHLY', days: 30, reason: 'x', actor })).rejects.toThrow(/reason/);
      await lifecycle.activateManually({ associationId: assoc.id, planId: planPro, billingCycle: 'MONTHLY', days: 30, reason: 'Paid by bank transfer, receipt on file', actor });
      const sub = await prisma.subscription.findFirstOrThrow({ where: { associationId: assoc.id } });
      expect(sub).toMatchObject({ status: 'ACTIVE', source: 'MANUAL', planId: planPro });
      expect(await prisma.paymentHistory.count({ where: { subscriptionId: sub.id } })).toBe(0);
      const log = await prisma.platformActionLog.findFirstOrThrow({ where: { associationId: assoc.id, actionType: 'SUBSCRIPTION_MANUALLY_ACTIVATED' } });
      expect(log).toMatchObject({ actorId: actor.id, reason: 'Paid by bank transfer, receipt on file' });
    });

    it('extends from the current end and audits it', async () => {
      const assoc = await newAssociation('man2');
      await onboard(assoc.id, planEnt);
      await expire(assoc.id, -10);
      const before = (await prisma.subscription.findFirstOrThrow({ where: { associationId: assoc.id } })).currentPeriodEnd.getTime();
      await lifecycle.extendSubscription({ associationId: assoc.id, days: 7, reason: 'Customer support goodwill extension', actor });
      const after = (await prisma.subscription.findFirstOrThrow({ where: { associationId: assoc.id } })).currentPeriodEnd.getTime();
      expect(after - before).toBe(7 * DAY);
      expect(await prisma.platformActionLog.count({ where: { associationId: assoc.id, actionType: 'SUBSCRIPTION_EXTENDED' } })).toBe(1);
    });
  });

  // ------------------------------------------------------------------------------------------------------------ authorization
  describe('authorization', () => {
    it('refuses plan administration to anyone who is not a platform Super Admin', async () => {
      const express = require('express');
      const request = require('supertest');
      const { generateToken } = require('../../src/lib/auth');
      const router = require('../../src/modules/admin/billing-admin.routes').default;
      const app = express();
      app.use(express.json());
      app.use('/api/admin/billing', router);

      const assoc = await newAssociation('auth1');
      await onboard(assoc.id, planEnt);
      const tenantAdmin = generateToken({ id: 777, email: 'a@test.local', role: 'admin', associationId: assoc.id });
      const agent = generateToken({ id: 778, email: 'b@test.local', role: 'admin', platformRole: 'SUPPORT_AGENT' });
      const owner = generateToken({ id: 779, email: 'c@test.local', role: 'admin', platformRole: 'SUPER_ADMIN' });

      await request(app).get('/api/admin/billing/plans').expect(401);
      await request(app).get('/api/admin/billing/plans').set('Authorization', `Bearer ${tenantAdmin}`).expect(403);
      await request(app).get('/api/admin/billing/plans').set('Authorization', `Bearer ${agent}`).expect(403);
      await request(app).post(`/api/admin/billing/plans/${planStarter}/publish`).set('Authorization', `Bearer ${tenantAdmin}`).send({ reason: 'trying to publish' }).expect(403);
      await request(app).post(`/api/admin/billing/subscriptions/${assoc.id}/activate`).set('Authorization', `Bearer ${tenantAdmin}`).send({}).expect(403);
      const ok = await request(app).get('/api/admin/billing/plans').set('Authorization', `Bearer ${owner}`).expect(200);
      expect(ok.body.data.some((p: { id: number }) => p.id === planStarter)).toBe(true);
    });
  });
});
