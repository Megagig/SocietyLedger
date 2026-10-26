import { apiGet, apiPost } from '@/utils/api';
import type { BillingCycle, CheckoutQuote, PricingAddon, PricingPlan } from '@/types/pricing';

const base = () => `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions`;

export class SubscriptionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new SubscriptionApiError(body?.message || 'Something went wrong. Please try again.', body?.code, response.status);
  }
  return body.data as T;
}

export interface PurchasableCatalog {
  plans: PricingPlan[];
  addons: PricingAddon[];
  /** The payment providers the server lets this association use. */
  providers: Array<'paystack' | 'nomba'>;
}

export interface CurrentSubscription {
  id: number;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  source: 'ONBOARDING' | 'PURCHASE' | 'MANUAL' | 'COMPLIMENTARY';
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planId: number;
  plan: { id: number; name: string; code: string; description: string | null };
  terms: PricingPlan | null;
  access: { allowed: boolean; reason: string; inGrace: boolean; graceEndsAt: string | null; periodEndsAt: string | null; trialDaysLeft: number | null };
  payments: Array<{ id: number; amount: string | number; status: string; provider: string; reference: string | null; paidAt: string | null; purpose: string; createdAt: string; needsReview: boolean }>;
  termHistory: Array<{ id: number; kind: string; billingCycle: BillingCycle; startsAt: string; endsAt: string; amountKobo: number; reason: string | null }>;
  addons: Array<{ id: number; addonId: number; code: string; name: string; endsAt: string; cancelAtPeriodEnd: boolean; amountPaidKobo: number }>;
  pendingPlan: { id: number; name: string } | null;
}

export type CheckoutResult =
  | { type: 'PAYMENT'; requiresPayment: true; provider: string; reference: string; authorizationUrl: string; quote: CheckoutQuote }
  | { type: 'ACTIVATED'; requiresPayment: false; quote: CheckoutQuote }
  | { type: 'DEFERRED'; requiresPayment: false; effectiveDate: string | null; quote: CheckoutQuote };

export const subscriptionsApi = {
  catalog: async () => unwrap<PurchasableCatalog>(await apiGet(`${base()}/plans`)),

  /** 404 means the association has no subscription at all. */
  current: async (): Promise<CurrentSubscription | null> => {
    const response = await apiGet(`${base()}/current`);
    if (response.status === 404) return null;
    return unwrap<CurrentSubscription>(response);
  },

  quote: async (input: { planId: number; billingCycle: BillingCycle; addonIds?: number[] }) => unwrap<CheckoutQuote>(await apiPost(`${base()}/quote`, input)),

  pay: async (input: { planId: number; billingCycle: BillingCycle; addonIds?: number[]; provider?: string }) => unwrap<CheckoutResult>(await apiPost(`${base()}/initialize`, input)),

  quoteAddons: async (addonIds: number[]) => unwrap<CheckoutQuote>(await apiPost(`${base()}/addons/quote`, { addonIds })),

  payAddons: async (input: { addonIds: number[]; provider?: string }) => unwrap<CheckoutResult>(await apiPost(`${base()}/addons/initialize`, input)),

  setAddonRenewal: async (tenantAddonId: number, stop: boolean) => unwrap<unknown>(await apiPost(`${base()}/addons/${tenantAddonId}/renewal`, { stop })),

  receipt: async (paymentId: number) => unwrap<PaymentReceipt>(await apiGet(`${base()}/payments/${paymentId}/receipt`)),

  cancel: async () => unwrap<unknown>(await apiPost(`${base()}/cancel`)),
  reactivate: async () => unwrap<unknown>(await apiPost(`${base()}/reactivate`)),
};

export interface PaymentReceipt {
  receiptNumber: string;
  association: string;
  reference: string | null;
  provider: string;
  currency: string;
  paidAt: string;
  purpose: string;
  planName: string | null;
  billingCycle: string | null;
  periodEndsAt: string | null;
  lines: Array<{ label: string; amountKobo: number }>;
  totalKobo: number;
}

export interface VerifyOutcome {
  state: 'success' | 'review' | 'pending' | 'failed' | 'error';
  message: string;
  subdomain?: string;
}

/** Ask the API to confirm a payment. Safe to call again and again: it activates at most once. */
export async function verifySubscriptionPayment(reference: string): Promise<VerifyOutcome> {
  try {
    const response = await fetch(`${base()}/verify/${encodeURIComponent(reference)}`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (response.status === 202 || body?.data?.status === 'PENDING') {
      return { state: 'pending', message: body?.message || 'Your payment is still being processed.' };
    }
    if (response.ok && body?.success) {
      if (body.data?.status === 'REVIEW') return { state: 'review', message: body.message, subdomain: body.data?.subdomain };
      return { state: 'success', message: 'Payment verified. Your subscription is active.', subdomain: body.data?.subdomain };
    }
    if (body?.data?.status === 'FAILED') return { state: 'failed', message: 'The payment did not go through, so nothing was charged to your subscription.' };
    return { state: 'error', message: body?.message || 'We could not verify this payment.' };
  } catch {
    return { state: 'error', message: 'We could not reach the server to verify this payment. Please try again.' };
  }
}
