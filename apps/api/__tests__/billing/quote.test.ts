/**
 * Server-side pricing rules: what a checkout costs, which version it is sold on, and what it never allows.
 */
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/modules/admin/platform-settings.service', () => ({ PlatformSettingsService: { getSettings: jest.fn() } }));
jest.mock('../../src/services/billing-override.service', () => ({ BillingOverrideService: { getBillingStatus: jest.fn() } }));

import { buildAddonQuote, buildPlanQuote, BillingError, type HeldAddon, type QuoteContext } from '../../src/services/billing/quote.service';
import { pricesOf, type CatalogAddon, type CatalogPlan } from '../../src/services/billing/catalog.service';

const NOW = new Date('2026-11-10T00:00:00.000Z');
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function plan(id: number, code: string, name: string, monthly: number, annual: number, extra: Partial<CatalogPlan> = {}): CatalogPlan {
  return {
    id,
    code,
    name,
    description: null,
    highlights: [],
    badgeLabel: null,
    isRecommended: false,
    isPublic: true,
    isActive: true,
    sortOrder: id,
    currency: 'NGN',
    versionId: id * 10,
    version: 1,
    prices: pricesOf(monthly, annual),
    limits: {},
    modules: [],
    features: [],
    ...extra,
  };
}

const STARTER = plan(1, 'starter', 'Starter', 800_000, 8_000_000);
const PRO = plan(2, 'professional', 'Pro', 1_000_000, 10_000_000);
const ENTERPRISE = plan(3, 'enterprise', 'Enterprise', 1_500_000, 15_000_000);

function addon(id: number, code: string, monthly: number, annual: number, eligiblePlanCodes: string[] = [], family: string | null = null): CatalogAddon {
  return {
    id,
    code,
    name: code,
    description: null,
    highlights: [],
    isPublic: true,
    isActive: true,
    sortOrder: id,
    family,
    versionId: id * 100,
    version: 1,
    prices: pricesOf(monthly, annual),
    limits: {},
    modules: [],
    features: [],
    eligiblePlanCodes,
  };
}

const SMS = addon(1, 'sms-pack', 300_000, 3_000_000);
const PRO_ONLY = addon(2, 'pro-only', 200_000, 2_000_000, ['professional']);

function ctx(over: Partial<QuoteContext> = {}): QuoteContext {
  return {
    now: NOW,
    subscription: null,
    heldPlan: null,
    hasRunningPeriod: false,
    subscriptionSource: null,
    currentTerm: null,
    heldAddons: [],
    purchasablePlans: [STARTER, PRO, ENTERPRISE],
    purchasableAddons: [SMS, PRO_ONLY],
    ...over,
  };
}

/** A tenant paying for Pro monthly with 20 of its 30 days left. */
function payingPro(over: Partial<QuoteContext> = {}): QuoteContext {
  return ctx({
    subscription: {
      id: 1,
      status: 'ACTIVE',
      planId: PRO.id,
      planCode: PRO.code,
      planVersionId: PRO.versionId,
      billingCycle: 'MONTHLY',
      currentPeriodEnd: day(20),
      trialEndsAt: null,
    },
    heldPlan: PRO,
    hasRunningPeriod: true,
    subscriptionSource: 'PURCHASE',
    currentTerm: { amountKobo: 1_000_000, startsAt: day(-10), endsAt: day(20) },
    ...over,
  });
}

describe('subscribing (no running paid period)', () => {
  it('charges the monthly price of the latest published version', () => {
    const q = buildPlanQuote(ctx(), { planId: STARTER.id, billingCycle: 'MONTHLY' });
    expect(q).toMatchObject({ kind: 'SUBSCRIBE', planVersionId: STARTER.versionId, totalKobo: 800_000, total: '₦8,000.00', extend: false });
  });

  it('switches to the annual price when the cycle changes', () => {
    const monthly = buildPlanQuote(ctx(), { planId: PRO.id, billingCycle: 'MONTHLY' });
    const annual = buildPlanQuote(ctx(), { planId: PRO.id, billingCycle: 'ANNUAL' });
    expect(monthly.totalKobo).toBe(1_000_000);
    expect(annual.totalKobo).toBe(10_000_000);
    expect(annual.periodEndsAt).toBe('2027-11-10T00:00:00.000Z');
    expect(monthly.periodEndsAt).toBe('2026-12-10T00:00:00.000Z');
  });

  it('starts a fresh term from today for an expired tenant even on the same plan', () => {
    const expired = ctx({
      subscription: {
        id: 1,
        status: 'EXPIRED',
        planId: PRO.id,
        planCode: PRO.code,
        planVersionId: 999,
        billingCycle: 'MONTHLY',
        currentPeriodEnd: day(-30),
        trialEndsAt: null,
      },
      heldPlan: { ...PRO, versionId: 999, prices: pricesOf(500_000, 5_000_000) },
      hasRunningPeriod: false,
    });
    const q = buildPlanQuote(expired, { planId: PRO.id, billingCycle: 'MONTHLY' });
    // The old version was cheaper, but a returning customer buys today's published terms.
    expect(q).toMatchObject({ kind: 'SUBSCRIBE', planVersionId: PRO.versionId, totalKobo: 1_000_000, extend: false });
  });

  it('treats a running free trial as a new purchase with no credit', () => {
    const trial = ctx({
      subscription: {
        id: 1,
        status: 'TRIALING',
        planId: ENTERPRISE.id,
        planCode: ENTERPRISE.code,
        planVersionId: ENTERPRISE.versionId,
        billingCycle: 'MONTHLY',
        currentPeriodEnd: day(8),
        trialEndsAt: day(8),
      },
      heldPlan: ENTERPRISE,
      hasRunningPeriod: true,
      subscriptionSource: 'ONBOARDING',
    });
    const q = buildPlanQuote(trial, { planId: STARTER.id, billingCycle: 'MONTHLY' });
    expect(q).toMatchObject({ kind: 'SUBSCRIBE', totalKobo: 800_000 });
    expect(q.lines.some((l) => l.type === 'CREDIT')).toBe(false);
  });

  it('refuses a plan that is hidden, deactivated, archived or unknown', () => {
    const open = ctx({ purchasablePlans: [STARTER] });
    expect(() => buildPlanQuote(open, { planId: PRO.id, billingCycle: 'MONTHLY' })).toThrow(BillingError);
    expect(() => buildPlanQuote(open, { planId: 999, billingCycle: 'MONTHLY' })).toThrow(/not available/);
  });

  it('refuses an invalid billing cycle', () => {
    expect(() => buildPlanQuote(ctx(), { planId: STARTER.id, billingCycle: 'WEEKLY' as never })).toThrow(/monthly or annual/);
  });
});

describe('renewing a running subscription', () => {
  it('adds the term after the current end and keeps the version the tenant already holds', () => {
    const heldCheaper = payingPro({ heldPlan: { ...PRO, versionId: 21, prices: pricesOf(700_000, 7_000_000) } });
    const q = buildPlanQuote(heldCheaper, { planId: PRO.id, billingCycle: 'MONTHLY' });
    expect(q).toMatchObject({ kind: 'RENEW', extend: true, planVersionId: 21, totalKobo: 700_000 });
    expect(q.periodEndsAt).toBe('2026-12-30T00:00:00.000Z'); // 20 days from now, plus one month
  });

  it('lets an existing customer renew a plan that has since been hidden from sale', () => {
    const q = buildPlanQuote(payingPro({ purchasablePlans: [STARTER] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
    expect(q.kind).toBe('RENEW');
  });

  it('carries held add-ons along at the price they were bought at', () => {
    const held: HeldAddon = {
      id: 5,
      addonId: SMS.id,
      addonVersionId: 77,
      code: SMS.code,
      name: SMS.name,
      family: null,
      prices: { priceMonthlyKobo: 250_000, priceAnnualKobo: 2_500_000 },
      startsAt: day(-10),
      endsAt: day(20),
      amountPaidKobo: 250_000,
      cancelAtPeriodEnd: false,
    };
    const q = buildPlanQuote(payingPro({ heldAddons: [held] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
    expect(q.totalKobo).toBe(1_000_000 + 250_000);
    expect(q.addons).toEqual([expect.objectContaining({ addonId: SMS.id, addonVersionId: 77, amountKobo: 250_000, tenantAddonId: 5, prorated: false })]);
  });

  it('does not carry an add-on that was already set to end', () => {
    const ending: HeldAddon = {
      id: 5,
      addonId: SMS.id,
      addonVersionId: 100,
      code: SMS.code,
      name: SMS.name,
      family: null,
      prices: { priceMonthlyKobo: 300_000, priceAnnualKobo: 3_000_000 },
      startsAt: day(-10),
      endsAt: day(20),
      amountPaidKobo: 300_000,
      cancelAtPeriodEnd: true,
    };
    const q = buildPlanQuote(payingPro({ heldAddons: [ending] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
    expect(q.addons).toHaveLength(0);
    expect(q.totalKobo).toBe(1_000_000);
  });
});

describe('changing plan', () => {
  it('upgrades with a credit for the unused part of what was paid', () => {
    // Paid 1,000,000 for a 30-day term with 20 days left -> credit floor(1,000,000 x 20 / 30) = 666,666.
    const q = buildPlanQuote(payingPro(), { planId: ENTERPRISE.id, billingCycle: 'MONTHLY' });
    expect(q).toMatchObject({ kind: 'CHANGE', deferred: false, planVersionId: ENTERPRISE.versionId, extend: false });
    expect(q.lines.find((l) => l.type === 'CREDIT')?.amountKobo).toBe(-666_666);
    expect(q.totalKobo).toBe(1_500_000 - 666_666);
  });

  it('gives no credit for a complimentary term, since nothing was paid', () => {
    const complimentary = payingPro({ subscriptionSource: 'COMPLIMENTARY', currentTerm: { amountKobo: 0, startsAt: day(-10), endsAt: day(20) } });
    const q = buildPlanQuote(complimentary, { planId: ENTERPRISE.id, billingCycle: 'MONTHLY' });
    expect(q.lines.some((l) => l.type === 'CREDIT')).toBe(false);
    expect(q.totalKobo).toBe(1_500_000);
  });

  it('schedules a cheaper plan for the end of the period and charges nothing now', () => {
    const q = buildPlanQuote(payingPro(), { planId: STARTER.id, billingCycle: 'MONTHLY' });
    expect(q).toMatchObject({ kind: 'CHANGE', deferred: true, totalKobo: 0 });
    expect(q.deferredEffectiveAt).toBe(day(20).toISOString());
  });

  it('drops a held add-on the new plan does not allow instead of failing', () => {
    const proOnly: HeldAddon = {
      id: 9,
      addonId: PRO_ONLY.id,
      addonVersionId: 200,
      code: PRO_ONLY.code,
      name: PRO_ONLY.name,
      family: null,
      prices: { priceMonthlyKobo: 200_000, priceAnnualKobo: 2_000_000 },
      startsAt: day(-10),
      endsAt: day(20),
      amountPaidKobo: 200_000,
      cancelAtPeriodEnd: false,
    };
    const q = buildPlanQuote(payingPro({ heldAddons: [proOnly] }), { planId: ENTERPRISE.id, billingCycle: 'MONTHLY' });
    expect(q.addons).toHaveLength(0);
  });

  it('refuses to add an add-on the chosen plan does not allow when it was asked for by name', () => {
    expect(() => buildPlanQuote(ctx(), { planId: STARTER.id, billingCycle: 'MONTHLY', addonIds: [PRO_ONLY.id] })).toThrow(/not available on the Starter plan/);
  });
});

describe('add-ons', () => {
  it('prorates to the renewal date: price x days left / days in the cycle', () => {
    // Pro monthly, 20 days left of a 30-day cycle (11 Dec -> 10 Jan? the cycle is the month ending on the renewal date).
    const q = buildAddonQuote(payingPro(), { addonIds: [SMS.id] });
    expect(q.kind).toBe('ADDON');
    expect(q.addons[0]?.prorated).toBe(true);
    expect(q.addons[0]?.amountKobo).toBeGreaterThan(0);
    expect(q.addons[0]?.amountKobo).toBeLessThan(300_000);
    expect(q.totalKobo).toBe(q.addons[0]?.amountKobo);
    expect(q.periodEndsAt).toBe(day(20).toISOString());
  });

  it('is cheaper the later in the cycle it is bought', () => {
    const early = buildAddonQuote(payingPro(), { addonIds: [SMS.id] });
    const late = buildAddonQuote(
      payingPro({
        subscription: { ...payingPro().subscription!, currentPeriodEnd: day(3) },
      }),
      { addonIds: [SMS.id] },
    );
    expect(late.totalKobo).toBeLessThan(early.totalKobo);
  });

  it('is refused without a running paid subscription', () => {
    expect(() => buildAddonQuote(ctx(), { addonIds: [SMS.id] })).toThrow(/active subscription/);
    const trial = payingPro({ subscription: { ...payingPro().subscription!, status: 'TRIALING' } });
    expect(() => buildAddonQuote(trial, { addonIds: [SMS.id] })).toThrow(BillingError);
  });

  it('is refused for a plan the add-on is not offered on, or one already held', () => {
    const onStarter = payingPro({ subscription: { ...payingPro().subscription!, planId: STARTER.id, planCode: STARTER.code } });
    expect(() => buildAddonQuote(onStarter, { addonIds: [PRO_ONLY.id] })).toThrow(/not available on your plan/);

    const held: HeldAddon = {
      id: 1,
      addonId: SMS.id,
      addonVersionId: 100,
      code: SMS.code,
      name: SMS.name,
      family: null,
      prices: { priceMonthlyKobo: 300_000, priceAnnualKobo: 3_000_000 },
      startsAt: day(-10),
      endsAt: day(20),
      amountPaidKobo: 300_000,
      cancelAtPeriodEnd: false,
    };
    expect(() => buildAddonQuote(payingPro({ heldAddons: [held] }), { addonIds: [SMS.id] })).toThrow(/already have/);
  });
});

describe('add-on tiers (one family)', () => {
  const STARTER_TIER = addon(10, 'ajo-starter', 300_000, 3_000_000, [], 'ajo');
  const GROWTH_TIER = addon(11, 'ajo-growth', 800_000, 8_000_000, [], 'ajo');

  const heldStarter = (over: Partial<HeldAddon> = {}): HeldAddon => ({
    id: 40,
    addonId: STARTER_TIER.id,
    addonVersionId: 1000,
    code: STARTER_TIER.code,
    name: STARTER_TIER.name,
    family: 'ajo',
    prices: { priceMonthlyKobo: 300_000, priceAnnualKobo: 3_000_000 },
    startsAt: day(-10),
    endsAt: day(20),
    amountPaidKobo: 300_000,
    cancelAtPeriodEnd: false,
    ...over,
  });

  const withTiers = (over: Partial<QuoteContext> = {}) => payingPro({ purchasableAddons: [SMS, STARTER_TIER, GROWTH_TIER], ...over });

  it('moves up a tier mid-term: charges the new tier for the days left and credits the unused part of the old one', () => {
    const q = buildAddonQuote(withTiers({ heldAddons: [heldStarter()] }), { addonIds: [GROWTH_TIER.id] });
    const charge = q.lines.find((l) => l.type === 'ADDON');
    const credit = q.lines.find((l) => l.type === 'CREDIT');
    expect(charge?.amountKobo).toBeGreaterThan(0);
    // 20 of 30 days left on the old tier => about two thirds of the 300,000 paid is given back.
    expect(credit?.amountKobo).toBe(-200_000);
    expect(q.totalKobo).toBe((charge?.amountKobo ?? 0) - 200_000);
    expect(q.addons[0]).toEqual(expect.objectContaining({ addonId: GROWTH_TIER.id, tenantAddonId: null, replacesTenantAddonIds: [40] }));
  });

  it('refuses a smaller tier mid-term, because the credit would be lost', () => {
    const heldGrowth = heldStarter({ id: 41, addonId: GROWTH_TIER.id, name: GROWTH_TIER.name, prices: { priceMonthlyKobo: 800_000, priceAnnualKobo: 8_000_000 }, amountPaidKobo: 800_000 });
    expect(() => buildAddonQuote(withTiers({ heldAddons: [heldGrowth] }), { addonIds: [STARTER_TIER.id] })).toThrow(/smaller tier when you renew/);
  });

  it('refuses two tiers of the same product in one checkout', () => {
    expect(() => buildPlanQuote(withTiers(), { planId: PRO.id, billingCycle: 'MONTHLY', addonIds: [STARTER_TIER.id, GROWTH_TIER.id] })).toThrow(/one tier/);
  });

  it('lets a renewal choose a different tier, replacing the held one', () => {
    const q = buildPlanQuote(withTiers({ heldAddons: [heldStarter()] }), { planId: PRO.id, billingCycle: 'MONTHLY', addonIds: [GROWTH_TIER.id] });
    expect(q.addons.map((a) => a.addonId)).toEqual([GROWTH_TIER.id]);
    expect(q.addons[0]?.replacesTenantAddonIds).toEqual([40]);
  });

  it('does not treat add-ons without a family as tiers of each other', () => {
    const q = buildAddonQuote(payingPro({ purchasableAddons: [SMS, PRO_ONLY], heldAddons: [] }), { addonIds: [SMS.id] });
    expect(q.addons[0]?.replacesTenantAddonIds).toBeUndefined();
  });

  describe('a downgrade staff scheduled for renewal', () => {
    const heldGrowth = (over: Partial<HeldAddon> = {}): HeldAddon =>
      heldStarter({ id: 41, addonId: GROWTH_TIER.id, code: GROWTH_TIER.code, name: GROWTH_TIER.name, prices: { priceMonthlyKobo: 800_000, priceAnnualKobo: 8_000_000 }, amountPaidKobo: 800_000, pendingAddonId: STARTER_TIER.id, ...over });

    it('renews as the lower tier, charged in full (not prorated), replacing the higher one', () => {
      const q = buildPlanQuote(withTiers({ heldAddons: [heldGrowth()] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
      expect(q.addons).toEqual([expect.objectContaining({ addonId: STARTER_TIER.id, amountKobo: 300_000, prorated: false, replacesTenantAddonIds: [41] })]);
      expect(q.totalKobo).toBe(1_000_000 + 300_000);
    });

    it('keeps the tier the group has when the lower tier can no longer be sold, never dropping it silently', () => {
      const q = buildPlanQuote(withTiers({ purchasableAddons: [SMS, GROWTH_TIER], heldAddons: [heldGrowth()] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
      expect(q.addons).toEqual([expect.objectContaining({ addonId: GROWTH_TIER.id, tenantAddonId: 41, prorated: false })]);
      expect(q.totalKobo).toBe(1_000_000 + 800_000);
    });

    it('does nothing to a tier whose downgrade was cancelled, or one the group set to end', () => {
      const q = buildPlanQuote(withTiers({ heldAddons: [heldGrowth({ pendingAddonId: null })] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
      expect(q.addons).toEqual([expect.objectContaining({ addonId: GROWTH_TIER.id })]);
      const ending = buildPlanQuote(withTiers({ heldAddons: [heldGrowth({ cancelAtPeriodEnd: true })] }), { planId: PRO.id, billingCycle: 'MONTHLY' });
      expect(ending.addons).toHaveLength(0);
    });
  });
});
