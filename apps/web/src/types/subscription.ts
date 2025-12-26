import { Plan, Subscription, BillingCycle } from '@prisma/client';

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
