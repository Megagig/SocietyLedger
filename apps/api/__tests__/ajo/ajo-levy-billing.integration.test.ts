/**
 * The Ajo platform levy through the real billing checkout (T5.4): a quote that carries the levy as its own lines, a payment for the whole
 * amount, and a verified payment that applies the plan AND settles the levy in one transaction, with the levy kept out of the plan's price.
 * Paystack is stubbed; the database is a real, disposable one (same set-up as the billing checkout tests).
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-levy-billing --forceExit
 */

// This file is a module, so its names never clash with the other suites in the same test run.
export {};
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
}
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
if (TEST_DB) jest.setTimeout(60000);
const DAY = 24 * 60 * 60 * 1000;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const actor = { id: 9003, role: 'SUPER_ADMIN' };
const PLAN_KOBO = 800_000;
const LEVY_KOBO = 375_000; // the spec's worked example: ₦3,750.00

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
suite('Ajo levy on the billing checkout (database, Paystack stubbed)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let controller: typeof import('../../src/modules/subscription/subscription.controller').subscriptionController;
  let builder: typeof import('../../src/services/billing/plan-builder.service');
  let access: typeof import('../../src/services/subscription-access.service');
  let catalog: typeof import('../../src/services/billing/catalog.service');
  let planId: number;
  let n = 0;

  async function tenant() {
    n += 1;
    const sub = `lb${n}-${run}`.slice(0, 40);
    const assoc = await prisma.association.create({ data: { name: `Levy Billing ${n}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE' } });
    const plan = await catalog.getLatestPublishedPlan(planId);
    const row = await prisma.subscription.create({
      data: { associationId: assoc.id, planId, planVersionId: plan!.versionId, source: 'ONBOARDING', status: 'EXPIRED', billingCycle: 'MONTHLY', currentPeriodStart: new Date(Date.now() - 40 * DAY), currentPeriodEnd: new Date(Date.now() - 30 * DAY) },
    });
    access.invalidateAccessCache(assoc.id);
    return { assoc, sub: row };
  }
  /** The worked example's levy on one group: the cycle levy and ten participant levies. */
  async function owe(associationId: number, over: { cents?: bigint } = {}) {
    const group = await prisma.ajoGroup.create({ data: { associationId, name: `Market Circle ${++n}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: 500_000n, startDate: new Date('2027-03-01'), maxParticipants: 10 } });
    const rows = [{ kind: 'CYCLE' as const, amountKobo: 250_000n }, ...Array.from({ length: 10 }, () => ({ kind: 'PARTICIPANT' as const, amountKobo: 12_500n }))];
    const made = [];
    for (const r of rows) {
      made.push(await prisma.ajoLevyAssessment.create({ data: { associationId, groupId: group.id, kind: r.kind, dedupeKey: `bill:${run}:${++n}`, baseKobo: 0n, rateBps: 0, minKobo: 0n, maxKobo: 0n, amountKobo: over.cents ?? r.amountKobo, addonCode: 'ajo-growth', calculation: 'Worked example.' } }));
    }
    return { group, rows: made };
  }
  const req = (associationId: number, body: unknown, params: Record<string, string> = {}) => ({ user: { id: 55, email: 'owner@test.local', associationId, role: 'admin' }, body, params }) as never;
  const levyRows = (associationId: number) => prisma.ajoLevyAssessment.findMany({ where: { associationId, kind: { not: 'CREDIT' } }, orderBy: { id: 'asc' } });
  const ok = (amount: number) => ({ status: true, data: { status: 'success', amount, paid_at: new Date().toISOString() } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    controller = require('../../src/modules/subscription/subscription.controller').subscriptionController;
    builder = require('../../src/services/billing/plan-builder.service');
    access = require('../../src/services/subscription-access.service');
    catalog = require('../../src/services/billing/catalog.service');
    const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');
    jest.spyOn(PlatformSettingsService, 'getSettings').mockResolvedValue({
      maintenanceMode: false, maxAssociationsPerUser: 3, defaultTrialDays: 14, allowNewSignups: true, requireEmailVerification: true, requireAdminApproval: true,
      enforceSubscriptionAccess: true, onboardingPolicy: 'TRIAL', onboardingPlanCode: 'enterprise', gracePeriodDays: 3, expiryReminderDays: [7, 3, 1],
      defaultAssociationTier: 'STARTER', platformVersion: '1',
    });
    const mod = await prisma.platformModule.create({ data: { code: `lb-mod-${run}`, name: 'Mod' } });
    const plan = await builder.createPlan({ code: `lb-a-${run}`, name: 'Levy Billing Plan', priceMonthlyKobo: PLAN_KOBO, priceAnnualKobo: 8_000_000, moduleCodes: [mod.code], isPublic: true }, actor);
    await builder.publishDraft(plan.id, actor);
    planId = plan.id;
  }, 60_000);

  beforeEach(() => {
    paystackInit.mockReset();
    paystackVerify.mockReset();
    paystackInit.mockImplementation(async (args: { reference: string }) => ({
      status: true,
      data: { reference: args.reference, access_code: 'ac_test', authorization_url: `https://checkout.test/${args.reference}` },
    }));
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('shows the levy as its own lines beside the plan, and charges the whole amount', async () => {
    const { assoc } = await tenant();
    await owe(assoc.id);
    const q = fakeRes();
    await controller.quote(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), q as never);
    expect(q.body.data).toMatchObject({ totalKobo: PLAN_KOBO + LEVY_KOBO, total: '₦11,750.00' });
    const lines = q.body.data.lines as Array<{ type: string; label: string; amountKobo: number; amount: string }>;
    expect(lines[0]).toMatchObject({ type: 'PLAN', amountKobo: PLAN_KOBO });
    const levy = lines.filter((l) => l.type === 'LEVY');
    expect(levy).toHaveLength(1);
    expect(levy[0]).toMatchObject({ amountKobo: LEVY_KOBO, amount: '₦3,750.00', label: expect.stringContaining('Market Circle') });
    expect(q.body.data.levy.totalKobo).toBe(LEVY_KOBO);
    expect(paystackInit).not.toHaveBeenCalled(); // quoting only reads
    expect((await levyRows(assoc.id)).every((r) => r.status === 'ACCRUED')).toBe(true);

    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId, billingCycle: 'MONTHLY', amount: 1, levy: { totalKobo: 0 } }), init as never);
    expect(paystackInit).toHaveBeenCalledWith(expect.objectContaining({ amount: PLAN_KOBO + LEVY_KOBO }));
    const payment = await prisma.paymentHistory.findFirstOrThrow({ where: { reference: init.body.data.reference } });
    expect(payment.expectedAmountKobo).toBe(PLAN_KOBO + LEVY_KOBO);
    const rows = await levyRows(assoc.id);
    expect(rows.every((r) => r.status === 'BILLED' && r.billedPaymentId === payment.id)).toBe(true);
  });

  it('applies the plan and settles the levy together when the payment is verified, keeping the levy out of the plan’s price', async () => {
    const { assoc, sub } = await tenant();
    await owe(assoc.id);
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), init as never);
    const reference = init.body.data.reference;
    const payment = await prisma.paymentHistory.findFirstOrThrow({ where: { reference } });

    paystackVerify.mockResolvedValue(ok(PLAN_KOBO + LEVY_KOBO));
    const res = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference }), res as never);
    expect(res.body.data).toMatchObject({ status: 'SUCCESS', outcome: 'ACTIVATED' });

    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('ACTIVE');
    const term = await prisma.subscriptionTerm.findFirstOrThrow({ where: { subscriptionId: sub.id, kind: 'PURCHASE' } });
    expect(term.amountKobo).toBe(PLAN_KOBO); // the plan's term records the plan's price only
    const rows = await levyRows(assoc.id);
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => r.status === 'PAID' && r.paidPaymentId === payment.id)).toBe(true);

    // A repeat of the same verification neither re-applies the plan nor makes a credit.
    const again = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference }), again as never);
    expect(again.body.data.outcome).toBe('ALREADY_APPLIED');
    expect(await prisma.ajoLevyAssessment.count({ where: { associationId: assoc.id, kind: 'CREDIT' } })).toBe(0);
    expect(await prisma.subscriptionTerm.count({ where: { subscriptionId: sub.id, kind: 'PURCHASE' } })).toBe(1);
  });

  it('holds a payment that does not equal the quote, activating nothing and leaving the levy owed', async () => {
    const { assoc, sub } = await tenant();
    await owe(assoc.id);
    const init = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), init as never);
    paystackVerify.mockResolvedValue(ok(PLAN_KOBO)); // paid the plan, not the levy
    const res = fakeRes();
    await controller.verifyPayment(req(assoc.id, {}, { reference: init.body.data.reference }), res as never);
    expect(res.body.data).toMatchObject({ status: 'REVIEW', outcome: 'NEEDS_REVIEW' });
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('EXPIRED');
    expect((await levyRows(assoc.id)).every((r) => r.status === 'BILLED')).toBe(true); // billed, not paid
  });

  it('takes the levy again on the next checkout when the first is abandoned, and a late double payment becomes a credit', async () => {
    const { assoc } = await tenant();
    await owe(assoc.id);
    const first = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), first as never);
    const second = fakeRes();
    await controller.initializePayment(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), second as never);
    expect(paystackInit).toHaveBeenCalledTimes(2);
    expect(paystackInit.mock.calls[1][0]).toMatchObject({ amount: PLAN_KOBO + LEVY_KOBO }); // the levy rode on the second as well
    const secondPayment = await prisma.paymentHistory.findFirstOrThrow({ where: { reference: second.body.data.reference } });
    expect((await levyRows(assoc.id)).every((r) => r.billedPaymentId === secondPayment.id)).toBe(true);

    paystackVerify.mockResolvedValue(ok(PLAN_KOBO + LEVY_KOBO));
    await controller.verifyPayment(req(assoc.id, {}, { reference: second.body.data.reference }), fakeRes() as never);
    expect((await levyRows(assoc.id)).every((r) => r.status === 'PAID')).toBe(true);

    // The first checkout is paid after all. The levy is already settled, so the extra is kept as a credit, not lost.
    await controller.verifyPayment(req(assoc.id, {}, { reference: first.body.data.reference }), fakeRes() as never);
    const credits = await prisma.ajoLevyAssessment.findMany({ where: { associationId: assoc.id, kind: 'CREDIT' } });
    expect(credits).toHaveLength(11);
    expect(credits.reduce((s, c) => s + c.amountKobo, 0n)).toBe(-BigInt(LEVY_KOBO));
    expect((await levyRows(assoc.id)).every((r) => r.status === 'PAID')).toBe(true);

    // The next time levy is owed, the credit is taken off it.
    await owe(assoc.id);
    const q = fakeRes();
    await controller.quote(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), q as never);
    expect(q.body.data.lines.some((l: { type: string; label: string; amountKobo: number }) => l.type === 'LEVY' && l.label.includes('credit') && l.amountKobo === -LEVY_KOBO)).toBe(true);
    expect(q.body.data.levy.totalKobo).toBe(0);
    expect(q.body.data.totalKobo).toBe(PLAN_KOBO);
  });

  it('leaves a quote with no levy exactly as it was, and never shows one association’s levy to another', async () => {
    const owed = await tenant();
    await owe(owed.assoc.id);
    const clean = await tenant();
    const q = fakeRes();
    await controller.quote(req(clean.assoc.id, { planId, billingCycle: 'MONTHLY' }), q as never);
    expect(q.body.data.totalKobo).toBe(PLAN_KOBO);
    expect(q.body.data.lines.filter((l: { type: string }) => l.type === 'LEVY')).toHaveLength(0);
    expect(q.body.data.levy).toBeUndefined();
    const init = fakeRes();
    await controller.initializePayment(req(clean.assoc.id, { planId, billingCycle: 'MONTHLY' }), init as never);
    expect(paystackInit).toHaveBeenCalledWith(expect.objectContaining({ amount: PLAN_KOBO }));
    expect((await levyRows(owed.assoc.id)).every((r) => r.status === 'ACCRUED')).toBe(true);
  });

  it('does not charge a levy that staff waived', async () => {
    const { assoc } = await tenant();
    const { rows } = await owe(assoc.id);
    await prisma.ajoLevyAssessment.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'WAIVED' } });
    const q = fakeRes();
    await controller.quote(req(assoc.id, { planId, billingCycle: 'MONTHLY' }), q as never);
    expect(q.body.data.totalKobo).toBe(PLAN_KOBO);
  });
});
