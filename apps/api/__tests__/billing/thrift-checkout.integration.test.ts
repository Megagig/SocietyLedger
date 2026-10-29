/**
 * A standalone thrift group pays only for Ajo (T7.6). Its base plan has no price and is offered to nobody else, so the one thing it buys is
 * an Ajo tier. This proves it through the real checkout path: what it is offered, what it is quoted, and what it is charged, with Paystack
 * stubbed and a real, disposable database (see billing.integration.test.ts for how to set one up).
 */

// This file is a module, so its names never clash with the other suites in the same test run.
export {};
const TEST_DB = process.env.BILLING_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('BILLING_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
process.env.FRONTEND_URL = 'http://localhost:3000';

const paystackInit = jest.fn();
jest.mock('../../src/modules/payments/paystack/paystack.service', () => ({
  PaystackService: class {
    static generateReference(prefix = 'PAY') {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    static nairaToKobo(n: number) {
      return Math.round(n * 100);
    }
    static koboToNaira(k: number) {
      return k / 100;
    }
    initializePayment(args: unknown) {
      return paystackInit(args);
    }
    verifyPayment() {
      return Promise.resolve({ status: false });
    }
  },
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => undefined) }));
jest.mock('../../src/services/billing/billing-notifications.service', () => ({ notifyBillingEvent: jest.fn(async () => undefined), sendBillingEmail: jest.fn(async () => undefined) }));

const suite = TEST_DB ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

function fakeRes() {
  const res: { statusCode: number; body: any; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    statusCode: 200,
    body: undefined,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return res;
}

/* eslint-disable @typescript-eslint/no-var-requires */
suite('standalone thrift group checkout (database, Paystack stubbed)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let controller: typeof import('../../src/modules/subscription/subscription.controller').subscriptionController;
  let access: typeof import('../../src/services/subscription-access.service');
  let thriftPlanId: number;
  let associationPlanId: number;
  let growthAddonId: number;
  let n = 0;

  async function tenant(kind: 'THRIFT_GROUP' | 'ASSOCIATION', status: 'TRIALING' | 'EXPIRED' = 'EXPIRED') {
    n += 1;
    const sub = `tg${n}-${run}`.slice(0, 40);
    const assoc = await prisma.association.create({ data: { name: `Thrift ${n}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE', kind } });
    const planId = kind === 'THRIFT_GROUP' ? thriftPlanId : associationPlanId;
    const version = await prisma.planVersion.findFirstOrThrow({ where: { planId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
    const trial = status === 'TRIALING';
    const row = await prisma.subscription.create({
      data: {
        associationId: assoc.id, planId, planVersionId: version.id, source: 'ONBOARDING', status, billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(Date.now() - (trial ? 1 : 40) * DAY), currentPeriodEnd: new Date(Date.now() + (trial ? 13 : -10) * DAY),
        ...(trial ? { trialEndsAt: new Date(Date.now() + 13 * DAY) } : {}),
      } as never,
    });
    access.invalidateAccessCache(assoc.id);
    return { assoc, sub: row };
  }
  const req = (associationId: number, body: unknown = {}) => ({ user: { id: 55, email: 'owner@test.local', associationId, role: 'admin' }, body, params: {} }) as never;

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    controller = require('../../src/modules/subscription/subscription.controller').subscriptionController;
    access = require('../../src/services/subscription-access.service');
    const builder = require('../../src/services/billing/plan-builder.service');
    const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');
    jest.spyOn(PlatformSettingsService, 'getSettings').mockResolvedValue({
      maintenanceMode: false, maxAssociationsPerUser: 3, defaultTrialDays: 14, allowNewSignups: true, requireEmailVerification: true, requireAdminApproval: true,
      enforceSubscriptionAccess: true, onboardingPolicy: 'TRIAL', onboardingPlanCode: 'enterprise', gracePeriodDays: 3, expiryReminderDays: [7, 3, 1],
      defaultAssociationTier: 'STARTER', platformVersion: '1',
    });

    // What platform-modules.seed.ts gives every database: a core module, the Ajo module and its features.
    const existingCore = await prisma.platformModule.findFirst({ where: { isCore: true } });
    if (!existingCore) await prisma.platformModule.create({ data: { code: `tg-core-${run}`, name: 'Core', isCore: true } });
    const ajo = await prisma.platformModule.upsert({ where: { code: 'ajo' }, create: { code: 'ajo', name: 'Ajo / Thrift' }, update: {} });
    for (const code of ['ajo.collector_thrift', 'ajo.rotating_pot', 'ajo.guarantors', 'ajo.reminders', 'ajo.advanced_reports']) {
      await prisma.platformFeature.upsert({ where: { code }, create: { code, name: code, moduleId: ajo.id }, update: {} });
    }
    const { seedAjoAddons, seedThriftGroupPlan } = require('../../prisma/seeds/ajo-addons.seed');
    await seedThriftGroupPlan(prisma);
    await seedAjoAddons(prisma);
    thriftPlanId = (await prisma.plan.findUniqueOrThrow({ where: { code: 'thrift-group' } })).id;
    growthAddonId = (await prisma.addon.findUniqueOrThrow({ where: { code: 'ajo-growth' } })).id;

    // An ordinary association plan, to prove a thrift group is never offered it.
    const mod = await prisma.platformModule.create({ data: { code: `tg-mod-${run}`, name: 'Mod' } });
    const plan = await builder.createPlan({ code: `tg-assoc-${run}`, name: 'Association plan', priceMonthlyKobo: 800_000, priceAnnualKobo: 8_000_000, moduleCodes: [mod.code], isPublic: true }, { id: 9002, role: 'SUPER_ADMIN' });
    await builder.publishDraft(plan.id, { id: 9002, role: 'SUPER_ADMIN' });
    associationPlanId = plan.id;
  }, 90_000);

  beforeEach(() => {
    paystackInit.mockReset();
    paystackInit.mockImplementation(async (args: { reference: string }) => ({ status: true, data: { reference: args.reference, access_code: 'ac_test', authorization_url: `https://checkout.test/${args.reference}` } }));
    delete process.env.SUBSCRIPTION_NOMBA_ENABLED;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('offers a thrift group only its own free base plan and the Ajo tiers, never an association plan', async () => {
    const { assoc } = await tenant('THRIFT_GROUP');
    const res = fakeRes();
    await controller.getPlans(req(assoc.id), res as never);
    expect(res.statusCode).toBe(200);
    const codes = res.body.data.plans.map((p: { code: string }) => p.code);
    expect(codes).toEqual(['thrift-group']);
    expect(res.body.data.plans[0].prices).toMatchObject({ monthlyKobo: 0, annualKobo: 0 });
    expect(res.body.data.addons.map((a: { code: string }) => a.code)).toEqual(expect.arrayContaining(['ajo-starter', 'ajo-growth', 'ajo-business']));

    // The reverse: an association is never offered the thrift group plan.
    const other = await tenant('ASSOCIATION');
    const resB = fakeRes();
    await controller.getPlans(req(other.assoc.id), resB as never);
    expect(resB.body.data.plans.map((p: { code: string }) => p.code)).not.toContain('thrift-group');
  });

  it('charges a group still in its trial only the Ajo tier when it subscribes early, and an add-on on its own needs a subscription first (as for any tenant)', async () => {
    const { assoc } = await tenant('THRIFT_GROUP', 'TRIALING');
    const growth = await prisma.addon.findUniqueOrThrow({ where: { id: growthAddonId }, include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } } });
    const expected = Number(growth.versions[0].priceMonthlyKobo);
    const alone = fakeRes();
    await controller.quoteAddons(req(assoc.id, { addonIds: [growthAddonId] }), alone as never);
    expect(alone.statusCode).toBe(403);
    expect(alone.body.code).toBe('NO_ACTIVE_SUBSCRIPTION');

    const res = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: thriftPlanId, billingCycle: 'MONTHLY', addonIds: [growthAddonId] }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.quote.totalKobo).toBe(expected);
  });

  it('charges a group whose trial has ended exactly the Ajo tier when it subscribes on the free base plan', async () => {
    const { assoc } = await tenant('THRIFT_GROUP', 'EXPIRED');
    const growth = await prisma.addon.findUniqueOrThrow({ where: { id: growthAddonId }, include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } } });
    const expected = Number(growth.versions[0].priceMonthlyKobo);
    const res = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: thriftPlanId, billingCycle: 'MONTHLY', addonIds: [growthAddonId] }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.quote.totalKobo).toBe(expected);
    expect(paystackInit).toHaveBeenCalledWith(expect.objectContaining({ amount: expected }));
    const payment = await prisma.paymentHistory.findFirstOrThrow({ where: { reference: res.body.data.reference } });
    expect(payment).toMatchObject({ expectedAmountKobo: expected, status: 'PENDING', purpose: 'SUBSCRIPTION' });
  });

  it('refuses to sell a thrift group an association plan', async () => {
    const { assoc } = await tenant('THRIFT_GROUP', 'EXPIRED');
    const res = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: associationPlanId, billingCycle: 'MONTHLY' }), res as never);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(paystackInit).not.toHaveBeenCalled();
  });

  it('starts a thrift group\x27s trial on Growth features with the Starter cap, and the trial add-on is never for sale', async () => {
    const { assoc } = await tenant('THRIFT_GROUP', 'TRIALING');
    const { grantThriftTrialAddon } = require('../../src/modules/ajo/ajo-standalone');
    const { computeEntitlements, invalidateEntitlements } = require('../../src/services/billing/entitlements.service');
    const endsAt = new Date(Date.now() + 13 * DAY);
    expect(await grantThriftTrialAddon(assoc.id, endsAt)).toBe(true);
    expect(await grantThriftTrialAddon(assoc.id, endsAt)).toBe(false); // once only
    invalidateEntitlements(assoc.id);
    const ent = await computeEntitlements(assoc.id);
    expect(ent.features.has('ajo.collector_thrift')).toBe(true);
    expect(ent.features.has('ajo.reminders')).toBe(true);
    expect(ent.limits.ajoContributors).toBe(30);

    const res = fakeRes();
    await controller.getPlans(req(assoc.id), res as never);
    expect(res.body.data.addons.map((a: { code: string }) => a.code)).not.toContain('ajo-trial');
  });
});
