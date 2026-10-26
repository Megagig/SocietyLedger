import type { OnboardingInfo, PricingAddon, PricingPlan } from '../types/pricing';

/**
 * Pure helpers for showing prices and what a new association gets. No network and no framework imports, so they are easy to test.
 * (Fetching lives in ./pricing, which re-exports these.)
 */

/** Whole-kobo amount as "₦10,000.00" (always in full). Used for figures derived on the page, such as a per-month equivalent. */
export function formatKobo(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kobo));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${whole}.${(abs % 100).toString().padStart(2, '0')}`;
}

/** What a new association gets, in one sentence, from the configured onboarding policy. */
export function onboardingSentence(onboarding: OnboardingInfo | null | undefined): string {
  if (!onboarding) return '';
  const plan = onboarding.planName ?? 'our top plan';
  switch (onboarding.policy) {
    case 'TRIAL':
      return `New associations start with a ${onboarding.days}-day free trial of the ${plan} plan.`;
    case 'COMPLIMENTARY':
      return `New associations get ${onboarding.days} days of complimentary access to the ${plan} plan.`;
    case 'BILLABLE':
      return 'Choose a plan and pay to get started.';
    default:
      return '';
  }
}

/** The call to action on a marketing card. */
export function signupLabel(onboarding: OnboardingInfo | null | undefined): string {
  if (!onboarding) return 'Get Started';
  return onboarding.policy === 'TRIAL' ? 'Start Free Trial' : 'Get Started';
}

/** The cheapest monthly price among the plans on offer. */
export function lowestMonthlyPrice(plans: PricingPlan[]): PricingPlan['prices'] | null {
  if (plans.length === 0) return null;
  return [...plans].sort((a, b) => a.prices.monthlyKobo - b.prices.monthlyKobo)[0].prices;
}

/** The add-ons a plan may buy: those that name no plan (every plan) and those that name this one. */
export function addonsForPlan(addons: PricingAddon[], planCode: string): PricingAddon[] {
  return addons.filter((a) => a.eligiblePlanCodes.length === 0 || a.eligiblePlanCodes.includes(planCode));
}
