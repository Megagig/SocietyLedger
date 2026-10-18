// Frontend types for subscription data (not importing from Prisma)
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export type SubscriptionStatus = 
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Plan {
  id: number;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceAnnual: number;
  memberLimit: number | null;
  features: any;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PlanWithFeatures extends Plan {
  features: {
    memberLimit?: number;
    advancedReporting?: boolean;
    customBranding?: boolean;
    prioritySupport?: boolean;
    apiAccess?: boolean;
    multipleAdmins?: boolean;
    [key: string]: any;
  };
}

// Reconciled against the real Prisma Subscription model (G84) — cancelledAt, trialStart,
// paystackCustomerCode and paystackSubscriptionCode never existed on the real model;
// trialEnd is really trialEndsAt (silently masked by currentPeriodEnd being set to the
// same value during a trial, so this never surfaced as a visible UI bug); renewalDate
// was missing entirely.
export interface Subscription {
  id: number;
  associationId: number;
  planId: number;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: Date | string | null;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  cancelAtPeriodEnd: boolean;
  renewalDate: Date | string | null;
  pendingPlanId: number | null;
  pendingBillingCycle: BillingCycle | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SubscriptionWithPlan extends Subscription {
  plan: PlanWithFeatures;
  pendingPlan?: Plan | null;
  payments?: any[]; // Payment history
}

export interface PaymentInitializationData {
  planId: number;
  billingCycle: BillingCycle;
}

export interface PaystackResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}
