/**
 * The website's pricing helpers, and a guard that keeps plans and prices out of the web source.
 *
 * Every public surface (landing page, homepage, pricing page, plan chooser, checkout) must read plans from the pricing API. If someone
 * pastes a plan card or a price back into one of those files, this fails.
 */
import fs from 'fs';
import path from 'path';
import { addonsForPlan, formatKobo, lowestMonthlyPrice, onboardingSentence, signupLabel } from '../../../web/src/lib/pricing-text';
import type { OnboardingInfo, PricingAddon, PricingPlan } from '../../../web/src/types/pricing';

const WEB_SRC = path.resolve(__dirname, '../../../web/src');
const read = (rel: string) => fs.readFileSync(path.join(WEB_SRC, rel), 'utf8');

const prices = (monthlyKobo: number, annualKobo: number) => ({
  monthlyKobo,
  annualKobo,
  monthly: formatKobo(monthlyKobo),
  annual: formatKobo(annualKobo),
  annualSavingsKobo: Math.max(0, monthlyKobo * 12 - annualKobo),
  annualSavings: formatKobo(Math.max(0, monthlyKobo * 12 - annualKobo)),
});
const plan = (code: string, monthly: number, annual: number): PricingPlan => ({
  id: 1, code, name: code, description: null, highlights: [], badgeLabel: null, isRecommended: false, sortOrder: 1, versionId: 1, version: 1,
  prices: prices(monthly, annual), limits: {}, modules: [], features: [],
});

describe('web money formatting', () => {
  it('writes amounts in full, never abbreviated', () => {
    expect(formatKobo(800_000)).toBe('₦8,000.00');
    expect(formatKobo(15_000_000)).toBe('₦150,000.00');
    expect(formatKobo(1_666_667)).toBe('₦16,666.67');
    expect(formatKobo(0)).toBe('₦0.00');
  });
});

describe('what a new association is told it gets', () => {
  const base = { days: 14, planCode: 'enterprise', planName: 'Enterprise' };
  it('follows the onboarding policy and its real length and plan', () => {
    expect(onboardingSentence({ ...base, policy: 'TRIAL' })).toBe('New associations start with a 14-day free trial of the Enterprise plan.');
    expect(onboardingSentence({ ...base, policy: 'COMPLIMENTARY', days: 30 })).toBe('New associations get 30 days of complimentary access to the Enterprise plan.');
    expect(onboardingSentence({ ...base, policy: 'BILLABLE' })).toBe('Choose a plan and pay to get started.');
    expect(onboardingSentence(null)).toBe('');
  });

  it('only promises a free trial when there is one', () => {
    const o = (policy: OnboardingInfo['policy']): OnboardingInfo => ({ ...base, policy });
    expect(signupLabel(o('TRIAL'))).toBe('Start Free Trial');
    expect(signupLabel(o('COMPLIMENTARY'))).toBe('Get Started');
    expect(signupLabel(o('BILLABLE'))).toBe('Get Started');
  });
});

describe('plan helpers', () => {
  it('finds the cheapest monthly price from the plans it is given', () => {
    expect(lowestMonthlyPrice([plan('b', 1_000_000, 10_000_000), plan('a', 800_000, 8_000_000)])?.monthly).toBe('₦8,000.00');
    expect(lowestMonthlyPrice([])).toBeNull();
  });

  it('offers an add-on to every plan when it names none, otherwise only to the ones it names', () => {
    const addon = (eligiblePlanCodes: string[]) => ({ id: 1, code: 'x', name: 'x', eligiblePlanCodes }) as unknown as PricingAddon;
    expect(addonsForPlan([addon([]), addon(['pro'])], 'starter')).toHaveLength(1);
    expect(addonsForPlan([addon([]), addon(['pro'])], 'pro')).toHaveLength(2);
  });
});

describe('no plan or price lives in the web source', () => {
  const surfaces = [
    'app/page.tsx',
    'app/pricing/page.tsx',
    'components/home/HomeContent.tsx',
    'components/pricing/PlanGrid.tsx',
    'components/pricing/PublicPlans.tsx',
    'components/pricing/PlanComparison.tsx',
    'components/pricing/AddonList.tsx',
    'components/pricing/BillingToggle.tsx',
    'app/dashboard/subscription/plans/page.tsx',
    'app/dashboard/subscription/checkout/page.tsx',
    'app/dashboard/subscription/page.tsx',
    'app/dashboard/subscription/addons/page.tsx',
  ];

  it.each(surfaces)('%s has no naira price written into it', (file) => {
    const source = read(file);
    // a ₦ followed by a digit would be a price typed into a page
    expect(source).not.toMatch(/₦\s?\d/);
  });

  it.each(surfaces)('%s has no hardcoded plan names or old price fields', (file) => {
    const source = read(file);
    expect(source).not.toMatch(/name:\s*'(Starter|Professional|Pro|Enterprise)'/);
    expect(source).not.toMatch(/\bpriceMonthly\b|\bpriceAnnual\b/);
  });

  it('every plan-showing surface goes through the shared components and the pricing API', () => {
    expect(read('app/page.tsx')).toContain('fetchPublicPricing');
    expect(read('app/pricing/page.tsx')).toContain('fetchPublicPricing');
    expect(read('components/pricing/PublicPlans.tsx')).toContain('PlanGrid');
    expect(read('app/dashboard/subscription/plans/page.tsx')).toContain('PlanGrid');
    expect(read('lib/pricing.ts')).toContain('/api/public/pricing');
    expect(read('lib/api/subscriptions.ts')).toContain('/quote');
  });

  it('checkout never works out an amount itself', () => {
    const checkout = read('app/dashboard/subscription/checkout/page.tsx');
    expect(checkout).not.toMatch(/\*\s*12|\/\s*12/);
    expect(checkout).toContain('subscriptionsApi.quote');
    expect(checkout).not.toMatch(/amount\s*:/);
  });

  it('offers a payment provider only when the server lists it', () => {
    const checkout = read('app/dashboard/subscription/checkout/page.tsx');
    expect(checkout).toContain('catalog?.providers');
    // the provider picker is driven by the server's list, so there is no hardcoded two-provider array
    expect(checkout).not.toMatch(/paymentProviders\s*=\s*\[/);
  });
});
