/**
 * Checkout over HTTP-shaped calls: what the browser may and may not influence, provider gating, and how verification reacts to each
 * payment outcome. Paystack is stubbed; the database is a real, disposable one (see billing.integration.test.ts for how to set it up).
 */
const TEST_DB = process.env.BILLING_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('BILLING_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;
process.env.FRONTEND_URL = 'http://localhost:3000';

const paystackInit = jest.fn();
const paystackVerify = jest.fn();
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
    verifyPayment(ref: string) {
      return paystackVerify(ref);
    }
  },
}));
jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => undefined) }));
jest.mock('../../src/services/billing/billing-notifications.service', () => ({ notifyBillingEvent: jest.fn(async () => undefined), sendBillingEmail: jest.fn() }));

const suite = TEST_DB ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const actor = { id: 9002, role: 'SUPER_ADMIN' };

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
suite('checkout (database, Paystack stubbed)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let controller: typeof import('../../src/modules/subscription/subscription.controller').subscriptionController;
  let builder: typeof import('../../src/services/billing/plan-builder.service');
  let lifecycle: typeof import('../../src/services/billing/lifecycle.service');
  let checkout: typeof import('../../src/services/billing/checkout.service');
  let access: typeof import('../../src/services/subscription-access.service');
  let catalog: typeof import('../../src/services/billing/catalog.service');
  let planA: number;
  let planB: number;
  let n = 0;

  async function tenant() {
    n += 1;
    const sub = `co${n}-${run}`.slice(0, 40);
    const assoc = await prisma.association.create({ data: { name: `Checkout ${n}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE' } });
    const plan = await catalog.getLatestPublishedPlan(planB);
    const row = await prisma.subscription.create({
      data: { associationId: assoc.id, planId: planB, planVersionId: plan!.versionId, source: 'ONBOARDING', status: 'EXPIRED', billingCycle: 'MONTHLY', currentPeriodStart: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - 30 * DAY) },
    });
    access.invalidateAccessCache(assoc.id);
    return { assoc, sub: row };
  }

  const req = (associationId: number, body: unknown, params: Record<string, string> = {}) => ({ user: { id: 55, email: 'owner@test.local', associationId, role: 'admin' }, body, params }) as never;

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    controller = require('../../src/modules/subscription/subscription.controller').subscriptionController;
    builder = require('../../src/services/billing/plan-builder.service');
    lifecycle = require('../../src/services/billing/lifecycle.service');
    checkout = require('../../src/services/billing/checkout.service');
    access = require('../../src/services/subscription-access.service');
    catalog = require('../../src/services/billing/catalog.service');
    const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');
    jest.spyOn(PlatformSettingsService, 'getSettings').mockResolvedValue({
      maintenanceMode: false, maxAssociationsPerUser: 3, defaultTrialDays: 14, allowNewSignups: true, requireEmailVerification: true, requireAdminApproval: true,
      enforceSubscriptionAccess: true, onboardingPolicy: 'TRIAL', onboardingPlanCode: 'enterprise', gracePeriodDays: 3, expiryReminderDays: [7, 3, 1],
      defaultAssociationTier: 'STARTER', platformVersion: '1',
    });

    const core = await prisma.platformModule.create({ data: { code: `co-core-${run}`, name: 'Core', isCore: true } });
    void core;
    const mod = await prisma.platformModule.create({ data: { code: `co-mod-${run}`, name: 'Mod' } });
    const a = await builder.createPlan({ code: `co-a-${run}`, name: 'Co A', priceMonthlyKobo: 800_000, priceAnnualKobo: 8_000_000, moduleCodes: [mod.code], isPublic: true }, actor);
    await builder.publishDraft(a.id, actor);
    const b = await builder.createPlan({ code: `co-b-${run}`, name: 'Co B', priceMonthlyKobo: 1_000_000, priceAnnualKobo: 10_000_000, moduleCodes: [mod.code], isPublic: true }, actor);
    await builder.publishDraft(b.id, actor);
    planA = a.id;
    planB = b.id;
  }, 60_000);

  beforeEach(() => {
    paystackInit.mockReset();
    paystackVerify.mockReset();
    paystackInit.mockImplementation(async (args: { reference: string }) => ({
      status: true,
      data: { reference: args.reference, access_code: 'ac_test', authorization_url: `https://checkout.test/${args.reference}` },
    }));
    delete process.env.SUBSCRIPTION_NOMBA_ENABLED;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('charges the server price and ignores any amount, price or plan version the browser sends', async () => {
    const { assoc } = await tenant();
    const res = fakeRes();
    await controller.initializePayment(
      req(assoc.id, { planId: planA, billingCycle: 'MONTHLY', amount: 1, amountKobo: 100, price: 1, priceMonthly: 1, planVersionId: 999999, expectedAmountKobo: 1 }),
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.data.quote).toMatchObject({ totalKobo: 800_000, total: '₦8,000.00', kind: 'SUBSCRIBE' });
    // Paystack was asked for exactly the server's amount, in kobo
    expect(paystackInit).toHaveBeenCalledWith(expect.objectContaining({ amount: 800_000 }));
    const payment = await prisma.paymentHistory.findFirstOrThrow({ where: { reference: res.body.data.reference } });
    expect(payment).toMatchObject({ expectedAmountKobo: 800_000, status: 'PENDING', provider: 'paystack', purpose: 'SUBSCRIPTION' });
    expect(Number(payment.amount)).toBe(8000);
  });

  it('re-prices when the plan or billing interval changes: monthly and annual give different, server-side amounts', async () => {
    const { assoc } = await tenant();
    const monthly = fakeRes();
    await controller.quote(req(assoc.id, { planId: planB, billingCycle: 'MONTHLY' }), monthly as never);
    const annual = fakeRes();
    await controller.quote(req(assoc.id, { planId: planB, billingCycle: 'ANNUAL' }), annual as never);
    expect(monthly.body.data.totalKobo).toBe(1_000_000);
    expect(annual.body.data.totalKobo).toBe(10_000_000);
    // quoting alone creates nothing
    expect(paystackInit).not.toHaveBeenCalled();
    expect(await prisma.paymentHistory.count({ where: { subscription: { associationId: assoc.id } } })).toBe(0);
  });

  it('rejects an invalid billing cycle and an unavailable plan with a clear message', async () => {
    const { assoc } = await tenant();
    const bad = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'WEEKLY' }), bad as never);
    expect(bad.statusCode).toBe(400);
    const missing = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: 99999999, billingCycle: 'MONTHLY' }), missing as never);
    expect(missing.statusCode).toBe(404);
    expect(missing.body.code).toBe('PLAN_UNAVAILABLE');
  });

  it('offers only Paystack for subscriptions until Nomba is switched on, and refuses a Nomba request', async () => {
    expect(checkout.subscriptionProviders()).toEqual(['paystack']);
    const plans = fakeRes();
    await controller.getPlans(req(1, {}), plans as never);
    expect(plans.body.data.providers).toEqual(['paystack']);

    const { assoc } = await tenant();
    const res = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'MONTHLY', provider: 'nomba' }), res as never);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('PROVIDER_UNAVAILABLE');
    expect(res.body.message).toMatch(/Paystack/);
    expect(await prisma.paymentHistory.count({ where: { subscription: { associationId: assoc.id } } })).toBe(0);
  });

  it('a failed payment does not activate anything and is recorded as failed', async () => {
    const { assoc, sub } = await tenant();
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'MONTHLY' }), init as never);
    const reference = init.body.data.reference;

    paystackVerify.mockResolvedValue({ status: true, data: { status: 'failed', gateway_response: 'Declined', amount: 800_000 } });
    const res = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference }), res as never);
    expect(res.statusCode).toBe(400);
    expect(res.body.data.status).toBe('FAILED');
    expect((await prisma.paymentHistory.findFirstOrThrow({ where: { reference } })).status).toBe('FAILED');
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('EXPIRED');
    access.invalidateAccessCache(assoc.id);
    expect((await access.getAssociationAccess(assoc.id)).allowed).toBe(false);
  });

  it('a payment still processing at the provider does not activate anything and says so', async () => {
    const { assoc, sub } = await tenant();
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'MONTHLY' }), init as never);
    paystackVerify.mockResolvedValue({ status: true, data: { status: 'ongoing', amount: 800_000 } });
    const res = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference: init.body.data.reference }), res as never);
    expect(res.statusCode).toBe(202);
    expect(res.body.data.status).toBe('PENDING');
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('EXPIRED');
  });

  it('a verified payment for the right amount activates, and verifying again (return page + webhook) is harmless', async () => {
    const { assoc, sub } = await tenant();
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'ANNUAL' }), init as never);
    const reference = init.body.data.reference;
    paystackVerify.mockResolvedValue({ status: true, data: { status: 'success', amount: 8_000_000, paid_at: new Date().toISOString() } });

    const first = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference }), first as never);
    expect(first.statusCode).toBe(200);
    expect(first.body.data).toMatchObject({ status: 'SUCCESS', outcome: 'ACTIVATED' });
    const second = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference }), second as never);
    expect(second.body.data.outcome).toBe('ALREADY_APPLIED');
    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row).toMatchObject({ status: 'ACTIVE', planId: planA, billingCycle: 'ANNUAL' });
    expect(await prisma.subscriptionTerm.count({ where: { subscriptionId: sub.id, kind: 'PURCHASE' } })).toBe(1);
  });

  it('a verified payment for the WRONG amount is held for review and activates nothing', async () => {
    const { assoc, sub } = await tenant();
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planB, billingCycle: 'MONTHLY' }), init as never);
    paystackVerify.mockResolvedValue({ status: true, data: { status: 'success', amount: 100, paid_at: new Date().toISOString() } });
    const res = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference: init.body.data.reference }), res as never);
    expect(res.body.data).toMatchObject({ status: 'REVIEW', outcome: 'NEEDS_REVIEW' });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('EXPIRED');
  });

  it('keeps a not-found reference a plain 404, not a crash', async () => {
    const res = fakeRes();
    await controller.verifyPayment(req(1, {}, { reference: 'SUB-NOT-A-REAL-ONE' }), res as never);
    expect(res.statusCode).toBe(404);
  });

  it('schedules a cheaper plan for the period end and takes no payment', async () => {
    const { assoc, sub } = await tenant();
    const paid = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planB, billingCycle: 'MONTHLY' }), paid as never);
    paystackVerify.mockResolvedValue({ status: true, data: { status: 'success', amount: 1_000_000, paid_at: new Date().toISOString() } });
    await controller.verifyPayment(req(assoc.id, {}, { reference: paid.body.data.reference }), fakeRes() as never);
    access.invalidateAccessCache(assoc.id);

    paystackInit.mockClear();
    const down = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId: planA, billingCycle: 'MONTHLY' }), down as never);
    expect(down.body.data).toMatchObject({ type: 'DEFERRED', requiresPayment: false });
    expect(paystackInit).not.toHaveBeenCalled();
    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(row).toMatchObject({ planId: planB, pendingPlanId: planA });

    // when the period ends, the move to the cheaper plan's latest version happens
    expect(await lifecycle.applyDueDeferredChanges(new Date(Date.now() + 40 * DAY))).toBeGreaterThanOrEqual(1);
    const moved = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(moved).toMatchObject({ planId: planA, pendingPlanId: null });
  });
});
