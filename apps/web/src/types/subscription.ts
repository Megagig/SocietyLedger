import { Plan, Subscription, BillingCycle as PrismaBillingCycle } from '@prisma/client';

export type BillingCycle = PrismaBillingCycle;

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

export interface SubscriptionWithPlan extends Subscription {
  plan: PlanWithFeatures;
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
