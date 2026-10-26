/**
 * The seeded default plans, end to end on a real database: seed the catalog and the plans, put an association on each plan, and check
 * which modules and features it can really use. This is the table the pricing cards show, so the two must never drift apart.
 *
 * Needs a disposable database (see billing.integration.test.ts). Skipped without BILLING_TEST_DATABASE_URL.
 */
const TEST_DB = process.env.BILLING_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('BILLING_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

jest.mock('../../src/lib/email', () => ({ sendEmail: jest.fn(async () => undefined) }));
jest.mock('../../src/services/billing/billing-notifications.service', () => ({ notifyBillingEvent: jest.fn(async () => undefined), sendBillingEmail: jest.fn() }));

const suite = TEST_DB ? describe : describe.skip;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* eslint-disable @typescript-eslint/no-var-requires */
suite('default plans (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let service: typeof import('../../src/services/module-feature.service').ModuleFeatureService;
  let entitlements: typeof import('../../src/services/billing/entitlements.service');
  const tenants: Record<string, number> = {};

  const MODULES = ['members', 'ledger', 'payments', 'notifications', 'reports', 'meetings', 'welfare', 'voting', 'sms', 'audit', 'accounting', 'cooperatives', 'ai'];
  const FEATURES = [
    'members.export', 'members.bulk_import', 'ledger.export',
    'reports.export_pdf', 'reports.export_excel', 'ledger.bulk_transactions', 'ledger.advanced_penalties', 'members.custom_roles',
    'reports.custom', 'ai.financial_assistant', 'ai.smart_reports',
  ];

  // what each plan must allow; anything not listed must be refused
  const EXPECT: Record<string, { modules: string[]; features: string[] }> = {
    starter: {
      modules: ['members', 'ledger', 'payments', 'notifications', 'reports', 'meetings'],
      features: ['members.export', 'members.bulk_import', 'ledger.export'],
    },
    professional: {
      modules: ['members', 'ledger', 'payments', 'notifications', 'reports', 'meetings', 'welfare', 'voting', 'sms', 'audit'],
      features: ['members.export', 'members.bulk_import', 'ledger.export', 'reports.export_pdf', 'reports.export_excel', 'ledger.bulk_transactions', 'ledger.advanced_penalties', 'members.custom_roles'],
    },
    enterprise: {
      modules: MODULES,
      features: FEATURES,
    },
  };

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    service = require('../../src/services/module-feature.service').ModuleFeatureService;
    entitlements = require('../../src/services/billing/entitlements.service');
    const { PlatformSettingsService } = require('../../src/modules/admin/platform-settings.service');
    jest.spyOn(PlatformSettingsService, 'getSettings').mockResolvedValue({ gracePeriodDays: 3, enforceSubscriptionAccess: true });

    await require('../../prisma/seeds/platform-modules.seed').seedPlatformModules();
    await require('../../prisma/seeds/plans.seed').seedDefaultPlans(prisma);

    for (const code of Object.keys(EXPECT)) {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { code } });
      const version = await prisma.planVersion.findFirstOrThrow({ where: { planId: plan.id, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
      const sub = `gate-${code}-${run}`.slice(0, 40);
      const assoc = await prisma.association.create({ data: { name: `Gate ${code}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE' } });
      await prisma.subscription.create({
        data: { associationId: assoc.id, planId: plan.id, planVersionId: version.id, source: 'PURCHASE', status: 'ACTIVE', billingCycle: 'MONTHLY', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000) },
      });
      tenants[code] = assoc.id;
    }
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.each(Object.keys(EXPECT))('%s can use exactly the modules it advertises', async (code) => {
    entitlements.invalidateEntitlements(tenants[code]);
    const allowed: string[] = [];
    for (const m of MODULES) if (await service.isModuleEnabled(tenants[code], m)) allowed.push(m);
    expect(allowed.sort()).toEqual([...EXPECT[code].modules].sort());
  });

  it.each(Object.keys(EXPECT))('%s can use exactly the features it advertises', async (code) => {
    entitlements.invalidateEntitlements(tenants[code]);
    const allowed: string[] = [];
    for (const f of FEATURES) if (await service.isFeatureEnabled(tenants[code], f)) allowed.push(f);
    expect(allowed.sort()).toEqual([...EXPECT[code].features].sort());
  });

  it('the retired features and the integrations module are gone from the catalog', async () => {
    expect(await prisma.platformFeature.count({ where: { code: { in: ['reports.scheduled', 'audit.export', 'audit.advanced', 'integrations.api_access', 'integrations.webhooks', 'ai.document_qa'] } } })).toBe(0);
    expect(await prisma.platformModule.count({ where: { code: 'integrations' } })).toBe(0);
  });

  it('seeding again changes nothing about a plan that already exists', async () => {
    await prisma.planVersion.updateMany({ where: { plan: { code: 'starter' } }, data: { priceMonthlyKobo: 999_900 } });
    const result = await require('../../prisma/seeds/plans.seed').seedDefaultPlans(prisma);
    expect(result.created).toEqual([]);
    const v = await prisma.planVersion.findFirstOrThrow({ where: { plan: { code: 'starter' } } });
    expect(v.priceMonthlyKobo).toBe(999_900);
  });
});
