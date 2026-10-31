/**
 * @jest-environment jsdom
 *
 * The Plans page for a standalone thrift group. It has one free plan, and what the group really chooses is an Ajo tier, so the tiers are shown
 * on the page, each leading to checkout with that tier already ticked. An association keeps its page as it was. While on a trial the plan's
 * button says "Subscribe", not "Renew".
 */
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), useSearchParams: () => new URLSearchParams() }));

let mockThriftOnly = true;
jest.mock('@/lib/ajo/useAjoNav', () => ({ useAjoNav: () => ({ thriftOnly: mockThriftOnly }) }));

const price = (m: string, a: string) => ({ monthly: m, annual: a, monthlyKobo: 0, annualKobo: 0 });
const thriftPlan = { id: 5, code: 'thrift-group', name: 'Thrift group', description: 'The base for a standalone thrift group.', prices: price('₦0.00', '₦0.00'), highlights: [], limits: {}, modules: [], features: [], isPublic: true, versionId: 1 };
const proPlan = { ...thriftPlan, id: 2, code: 'professional', name: 'Pro', prices: price('₦10,000.00', '₦100,000.00') };
const tier = (id: number, name: string, m: string, a: string, eligible: string[] = ['thrift-group']) => ({ id, code: name.toLowerCase().replace(/ /g, '-'), name, description: `${name} tools`, highlights: [], versionId: 1, prices: price(m, a), limits: {}, modules: [], features: [], eligiblePlanCodes: eligible });

let mockCatalog: { plans: unknown[]; addons: unknown[]; providers: string[] };
let mockCurrent: unknown;
jest.mock('@/lib/api/subscriptions', () => ({
  subscriptionsApi: { catalog: async () => mockCatalog, current: async () => mockCurrent },
}));

import PlansPage from '@/app/dashboard/subscription/plans/page';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const trial = { status: 'TRIALING', planId: 5, billingCycle: 'MONTHLY', access: { allowed: true, inGrace: false }, plan: { code: 'thrift-group' }, addons: [] };

async function show() {
  await act(async () => { root.render(<PlansPage />); });
  await act(async () => { await settle(30); });
}
const text = () => host.textContent ?? '';
const buttons = () => Array.from(host.querySelectorAll('button'));

beforeEach(() => {
  mockPush.mockClear();
  mockThriftOnly = true;
  mockCurrent = trial;
  mockCatalog = {
    plans: [thriftPlan],
    addons: [tier(1, 'Ajo Starter', '₦3,000.00', '₦30,000.00'), tier(2, 'Ajo Growth', '₦8,000.00', '₦80,000.00'), tier(3, 'Ajo Business', '₦20,000.00', '₦200,000.00'), tier(9, 'Ajo for associations only', '₦1.00', '₦1.00', ['professional'])],
    providers: ['paystack'],
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('a standalone thrift group', () => {
  it('sees the Ajo tiers it can choose, with prices, and not tiers meant for other plans', async () => {
    await show();
    const section = host.querySelector('[data-testid="ajo-tiers"]');
    expect(section).not.toBeNull();
    expect(text()).toContain('Choose your Ajo tier');
    for (const name of ['Ajo Starter', 'Ajo Growth', 'Ajo Business']) expect(section!.textContent).toContain(name);
    expect(section!.textContent).toContain('₦8,000.00/month');
    expect(section!.textContent).not.toContain('associations only');
  });

  it('goes to checkout with the chosen tier already ticked, on the chosen billing cycle', async () => {
    await show();
    await act(async () => { buttons().find((b) => b.textContent?.includes('Choose Ajo Growth'))!.click(); });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/subscription/checkout?planId=5&billingCycle=MONTHLY&addons=2');
  });

  it('says Subscribe, not Renew, on the plan while it is only a trial', async () => {
    await show();
    const planButton = buttons().find((b) => /Subscribe|Renew/.test(b.textContent ?? ''))!;
    expect(planButton.textContent).toBe('Subscribe');
    await act(async () => { planButton.click(); });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/subscription/checkout?planId=5&billingCycle=MONTHLY');
  });

  it('shows no tier section when there are no tiers for its plan', async () => {
    mockCatalog.addons = [tier(9, 'Ajo for associations only', '₦1.00', '₦1.00', ['professional'])];
    await show();
    expect(host.querySelector('[data-testid="ajo-tiers"]')).toBeNull();
  });
});

describe('an association', () => {
  it('keeps the page as it was: plans only, no tier section', async () => {
    mockThriftOnly = false;
    mockCatalog.plans = [proPlan];
    mockCurrent = { ...trial, planId: 2, plan: { code: 'professional' } };
    await show();
    expect(host.querySelector('[data-testid="ajo-tiers"]')).toBeNull();
    expect(text()).toContain('Pro');
  });
});
