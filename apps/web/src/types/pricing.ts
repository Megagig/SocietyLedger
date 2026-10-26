/**
 * Shapes returned by the pricing and subscription APIs. Prices are whole kobo plus ready-formatted strings, so no page ever does its own
 * money maths or formatting, and no page ever holds a plan definition of its own: everything comes from the server.
 */
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export interface PlanPrices {
  monthlyKobo: number;
  annualKobo: number;
  /** Already formatted in full, e.g. "₦10,000.00". */
  monthly: string;
  annual: string;
  annualSavingsKobo: number;
  annualSavings: string;
}

export interface CatalogModule {
  code: string;
  name: string;
  isCore: boolean;
}

export interface CatalogFeature {
  code: string;
  name: string;
  moduleCode: string;
}

export interface PricingPlan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[];
  badgeLabel: string | null;
  isRecommended: boolean;
  sortOrder: number;
  versionId: number;
  version: number;
  prices: PlanPrices;
  limits: { members?: number | null };
  modules: CatalogModule[];
  features: CatalogFeature[];
}

export interface PricingAddon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[];
  versionId: number;
  prices: PlanPrices;
  limits: { members?: number | null };
  modules: CatalogModule[];
  features: CatalogFeature[];
  /** Empty = every plan can buy it. */
  eligiblePlanCodes: string[];
}

export interface OnboardingInfo {
  policy: 'TRIAL' | 'COMPLIMENTARY' | 'BILLABLE';
  days: number;
  planCode: string;
  planName: string | null;
}

export interface PublicPricing {
  currency: string;
  plans: PricingPlan[];
  addons: PricingAddon[];
  onboarding: OnboardingInfo;
}

export interface QuoteLine {
  type: 'PLAN' | 'ADDON' | 'CREDIT';
  label: string;
  amountKobo: number;
  amount: string;
  addonId?: number;
}

export interface CheckoutQuote {
  kind: 'SUBSCRIBE' | 'RENEW' | 'CHANGE' | 'ADDON';
  planId: number;
  planCode: string;
  planName: string;
  planVersionId: number;
  billingCycle: BillingCycle;
  extend: boolean;
  addons: { addonId: number; code: string; amountKobo: number; prorated: boolean }[];
  lines: QuoteLine[];
  totalKobo: number;
  total: string;
  periodEndsAt: string;
  deferred: boolean;
  deferredEffectiveAt: string | null;
}
