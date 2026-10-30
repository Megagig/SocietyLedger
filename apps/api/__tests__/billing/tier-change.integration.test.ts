/**
 * Staff change of an add-on tier (T9): the pure rules, then the real thing against a disposable database.
 *
 * The database part needs BILLING_TEST_DATABASE_URL (a database whose name contains "test"), like billing.integration.test.ts; without it
 * only the pure rules run.
 *
 *   BILLING_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/billing/tier-change
 */
const TEST_DB = process.env.BILLING_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('BILLING_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
// Before anything loads Prisma: the pure rules import the service, and the service imports the client, which reads this when it loads.
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

import { decideTierChange } from '../../src/services/billing/tier-change.service';

const starter = { sortOrder: 1, name: 'Starter', contributorLimit: 30 };
const growth = { sortOrder: 2, name: 'Growth', contributorLimit: 150 };

describe('decideTierChange (pure)', () => {
  it('upgrades now, with nothing in the way', () => {
    expect(decideTierChange({ current: starter, target: growth, activeContributors: 30, paid: true })).toEqual({ direction: 'UPGRADE', timing: 'NOW', blockers: [] });
  });

  it('holds a paid downgrade until the period ends, and applies an unpaid one now', () => {
    expect(decideTierChange({ current: growth, target: starter, activeContributors: 10, paid: true })).toMatchObject({ direction: 'DOWNGRADE', timing: 'PERIOD_END', blockers: [] });
    expect(decideTierChange({ current: growth, target: starter, activeContributors: 10, paid: false })).toMatchObject({ direction: 'DOWNGRADE', timing: 'NOW', blockers: [] });
  });

  it('refuses a downgrade when the group is over the lower tier, and says by how many', () => {
    const d = decideTierChange({ current: growth, target: starter, activeContributors: 42, paid: true });
    expect(d.blockers).toHaveLength(1);
    expect(d.blockers[0]).toMatch(/30 active contributors/);
    expect(d.blockers[0]).toMatch(/remove 12/);
  });

  it('lets a group sit exactly at the lower limit, and never blocks an unlimited target', () => {
    expect(decideTierChange({ current: growth, target: starter, activeContributors: 30, paid: true }).blockers).toEqual([]);
    expect(decideTierChange({ current: { sortOrder: 5 }, target: { sortOrder: 4, name: 'Big', contributorLimit: null }, activeContributors: 9999, paid: true }).blockers).toEqual([]);
  });

  it('treats the same tier as no change, and a group with no tier as a new one', () => {
    expect(decideTierChange({ current: starter, target: starter, activeContributors: 1, paid: true }).direction).toBe('SAME');
    expect(decideTierChange({ current: null, target: starter, activeContributors: 1, paid: false })).toEqual({ direction: 'NEW', timing: 'NOW', blockers: [] });
  });
});

const suite = TEST_DB ? describe : describe.skip;
const DAY = 24 * 60 * 60 * 1000;
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const code = (s: string) => `${s}-${run}`;
const actor = { id: 9001, role: 'SUPER_ADMIN' };
const family = code('tierfam');

/* eslint-disable @typescript-eslint/no-var-requires */
suite('tier change (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let builder: typeof import('../../src/services/billing/plan-builder.service');
  let lifecycle: typeof import('../../src/services/billing/lifecycle.service');
  let quotes: typeof import('../../src/services/billing/quote.service');
  let catalog: typeof import('../../src/services/billing/catalog.service');
  let tiers: typeof import('../../src/services/billing/tier-change.service');
  let planId: number;
  let small: number;
  let big: number;

  async function addon(name: string, monthly: number, sortOrder: number, contributors: number) {
    const a = await builder.createAddon({ code: code(name), name, priceMonthlyKobo: monthly, priceAnnualKobo: monthly * 10, moduleCodes: [], limits: { ajoContributors: contributors }, isPublic: true, family, sortOrder } as never, actor);
    await builder.publishAddonDraft(a.id, actor);
    return a.id;
  }

  /** An association on a running paid subscription that holds the given tier (granted, then marked as paid for when asked). */
  async function groupOn(label: string, addonId: number, paid: boolean) {
    const sub = `${label}-${run}`.slice(0, 40);
    const assoc = await prisma.association.create({ data: { name: `Test ${label}`, slug: sub, subdomain: sub, tier: 'STARTER', status: 'ACTIVE' } });
    await lifecycle.activateManually({ associationId: assoc.id, planId, billingCycle: 'MONTHLY', days: 30, reason: 'Set up for a test', actor });
    await lifecycle.grantAddonManually({ associationId: assoc.id, addonId, reason: 'Set up for a test', actor });
    if (paid) await prisma.tenantAddon.updateMany({ where: { associationId: assoc.id }, data: { amountPaidKobo: 300_000 } });
    return assoc.id;
  }

  const input = (associationId: number, targetAddonId: number, activeContributors: number, reason: unknown = 'Customer asked to move to a different tier') => ({ associationId, family, targetAddonId, activeContributors, reason, actor });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    // Belt and braces: this suite creates plans, add-ons and associations, so it must never run against anything but a test database.
    const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (!/test/i.test(db)) throw new Error(`Refusing to run against "${db}": not a test database.`);
    builder = require('../../src/services/billing/plan-builder.service');
    lifecycle = require('../../src/services/billing/lifecycle.service');
    quotes = require('../../src/services/billing/quote.service');
    catalog = require('../../src/services/billing/catalog.service');
    tiers = require('../../src/services/billing/tier-change.service');
    const plan = await builder.createPlan({ code: code('plan'), name: 'T Tier Plan', priceMonthlyKobo: 500_000, priceAnnualKobo: 5_000_000, moduleCodes: [], featureCodes: [], limits: {}, isPublic: true } as never, actor);
    await builder.publishDraft(plan.id, actor);
    planId = plan.id;
    small = await addon('small', 300_000, 1, 30);
    big = await addon('big', 800_000, 2, 150);
    catalog.invalidateCatalogCache();
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('lists the published tiers of a family, smallest first, with their limits', async () => {
    const list = await tiers.listTierOptions(family);
    expect(list.map((t) => [t.code, t.contributorLimit, t.priceMonthlyKobo])).toEqual([
      [code('small'), 30, 300_000],
      [code('big'), 150, 800_000],
    ]);
  });

  it('upgrades now: the new tier replaces the old one and the move is in the Action log with the reason', async () => {
    const id = await groupOn('up', small, true);
    const r = await tiers.changeTier(input(id, big, 12));
    expect(r.applied).toBe('NOW');
    expect((await tiers.getHeldTier(id, family))!.code).toBe(code('big'));
    expect(await prisma.tenantAddon.count({ where: { associationId: id, status: 'ACTIVE', addonVersion: { addon: { family } } } })).toBe(1);
    const log = await prisma.platformActionLog.findFirst({ where: { associationId: id, actionType: 'AJO_TIER_CHANGED' } });
    expect(log).toMatchObject({ reason: 'Customer asked to move to a different tier', actorId: actor.id });
    expect(log?.afterState).toMatchObject({ tier: code('big') });
  });

  it('holds a paid downgrade until renewal, keeps the tier meanwhile, and the renewal quote charges the lower tier in full', async () => {
    const id = await groupOn('down', big, true);
    const r = await tiers.changeTier(input(id, small, 20));
    expect(r.applied).toBe('PERIOD_END');
    expect(r.effectiveAt).toBeInstanceOf(Date);

    const held = await tiers.getHeldTier(id, family);
    expect(held).toMatchObject({ code: code('big'), pendingAddonId: small });

    const quote = await quotes.quotePlanCheckout(id, { planId, billingCycle: 'MONTHLY' });
    expect(quote.kind).toBe('RENEW');
    const line = quote.addons.find((a) => a.addonId === small);
    expect(line).toBeDefined();
    expect(line!.prorated).toBe(false);
    expect(line!.amountKobo).toBe(300_000);
    expect(line!.replacesTenantAddonIds).toHaveLength(1);
    expect(quote.addons.find((a) => a.addonId === big)).toBeUndefined();
    expect(await prisma.platformActionLog.count({ where: { associationId: id, actionType: 'AJO_TIER_DOWNGRADE_SCHEDULED' } })).toBe(1);
  });

  it('applies a downgrade at once when the tier was never paid for', async () => {
    const id = await groupOn('unpaid', big, false);
    const r = await tiers.changeTier(input(id, small, 5));
    expect(r.applied).toBe('NOW');
    expect((await tiers.getHeldTier(id, family))!.code).toBe(code('small'));
  });

  it('refuses a downgrade when the group is over the lower tier, changes nothing, and logs nothing', async () => {
    const id = await groupOn('over', big, true);
    await expect(tiers.changeTier(input(id, small, 31))).rejects.toMatchObject({ code: 'TIER_BLOCKED', status: 409 });
    expect(await tiers.getHeldTier(id, family)).toMatchObject({ code: code('big'), pendingAddonId: null });
    expect(await prisma.platformActionLog.count({ where: { associationId: id, actionType: { startsWith: 'AJO_TIER' } } })).toBe(0);
  });

  it('cancels a waiting downgrade when staff pick the tier the group already has', async () => {
    const id = await groupOn('undo', big, true);
    await tiers.changeTier(input(id, small, 5));
    const r = await tiers.changeTier(input(id, big, 5));
    expect(r.applied).toBe('CLEARED');
    expect((await tiers.getHeldTier(id, family))!.pendingAddonId).toBeNull();
    await expect(tiers.changeTier(input(id, big, 5))).rejects.toMatchObject({ code: 'TIER_UNCHANGED' });
  });

  it('needs a reason, and a running subscription for an upgrade', async () => {
    const id = await groupOn('reason', small, true);
    await expect(tiers.changeTier(input(id, big, 5, '  '))).rejects.toBeDefined();
    expect((await tiers.getHeldTier(id, family))!.code).toBe(code('small'));

    await prisma.subscription.updateMany({ where: { associationId: id }, data: { currentPeriodEnd: new Date(Date.now() - DAY) } });
    await prisma.tenantAddon.updateMany({ where: { associationId: id }, data: { endsAt: new Date(Date.now() - DAY) } });
    await expect(tiers.changeTier(input(id, big, 5))).rejects.toMatchObject({ code: 'NO_ACTIVE_SUBSCRIPTION' });
  });
});
