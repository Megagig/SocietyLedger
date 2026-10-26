/**
 * Starting a payment for a subscription or an add-on.
 *
 * The browser sends only WHAT it wants (plan, billing cycle, add-ons, provider). The price is computed here, stored with the pending
 * payment, and is the only amount a verified payment is allowed to match. Nothing the browser sends about money is ever used.
 */
import type { BillingCycle, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { PaystackService } from '../../modules/payments/paystack/paystack.service';
import { nombaService } from '../../modules/payments/nomba/nomba.service';
import { activateFreeQuote, scheduleDeferredChange } from './lifecycle.service';
import { BillingError, quoteAddonCheckout, quotePlanCheckout, type Quote } from './quote.service';
import { koboToNaira } from './money';
import { notifyBillingEvent } from './billing-notifications.service';

export type PaymentProviderId = 'paystack' | 'nomba';

/**
 * The providers an association may pay subscriptions with. Paystack always; Nomba only when it is both switched on for subscriptions
 * (SUBSCRIPTION_NOMBA_ENABLED=true) and configured. Turning Nomba back on later is that one setting, no code change.
 */
export function subscriptionProviders(): PaymentProviderId[] {
  const providers: PaymentProviderId[] = ['paystack'];
  if (process.env.SUBSCRIPTION_NOMBA_ENABLED === 'true' && nombaService.isConfigured()) providers.push('nomba');
  return providers;
}

export type CheckoutResult =
  | { type: 'PAYMENT'; provider: PaymentProviderId; reference: string; authorizationUrl: string; accessCode?: string; quote: Quote }
  | { type: 'ACTIVATED'; quote: Quote }
  | { type: 'DEFERRED'; quote: Quote };

interface Buyer {
  userId: number;
  email?: string;
}

export async function startPlanCheckout(input: {
  associationId: number;
  buyer: Buyer;
  planId: number;
  billingCycle: BillingCycle;
  addonIds?: number[];
  provider?: string;
}): Promise<CheckoutResult> {
  const provider = pickProvider(input.provider);
  const quote = await quotePlanCheckout(input.associationId, { planId: input.planId, billingCycle: input.billingCycle, addonIds: input.addonIds });

  if (quote.deferred) {
    const sub = await prisma.subscription.findFirst({ where: { associationId: input.associationId }, orderBy: { createdAt: 'desc' } });
    if (!sub) throw new BillingError('NO_SUBSCRIPTION', 'No subscription to change.', 404);
    await scheduleDeferredChange({ subscriptionId: sub.id, planId: quote.planId, billingCycle: quote.billingCycle, actorId: input.buyer.userId });
    void notifyBillingEvent({
      type: 'PLAN_CHANGED',
      associationId: input.associationId,
      planName: quote.planName,
      direction: 'scheduled',
      effectiveAt: quote.deferredEffectiveAt ? new Date(quote.deferredEffectiveAt) : undefined,
    });
    return { type: 'DEFERRED', quote };
  }

  const subscriptionId = await ensureSubscriptionRow(input.associationId, quote);
  return finishCheckout({ ...input, provider, quote, subscriptionId, purpose: quote.kind === 'CHANGE' ? 'PLAN_CHANGE' : 'SUBSCRIPTION' });
}

export async function startAddonCheckout(input: { associationId: number; buyer: Buyer; addonIds: number[]; provider?: string }): Promise<CheckoutResult> {
  const provider = pickProvider(input.provider);
  const quote = await quoteAddonCheckout(input.associationId, { addonIds: input.addonIds });
  const sub = await prisma.subscription.findFirst({ where: { associationId: input.associationId }, orderBy: { createdAt: 'desc' } });
  if (!sub) throw new BillingError('NO_ACTIVE_SUBSCRIPTION', 'Add-ons can be bought while you have an active subscription.', 403);
  return finishCheckout({ ...input, provider, quote, subscriptionId: sub.id, purpose: 'ADDON' });
}

function pickProvider(requested: string | undefined): PaymentProviderId {
  const available = subscriptionProviders();
  const wanted = (requested ?? 'paystack').toLowerCase();
  if (!available.includes(wanted as PaymentProviderId)) {
    throw new BillingError(
      'PROVIDER_UNAVAILABLE',
      wanted === 'nomba' ? 'Nomba is not available for subscriptions right now. Please pay with Paystack.' : 'That payment provider is not available.',
    );
  }
  return wanted as PaymentProviderId;
}

/**
 * Every payment hangs off a subscription row. An association that has none yet (an older tenant) gets an expired placeholder that the
 * verified payment then activates; nothing is granted by creating it.
 */
async function ensureSubscriptionRow(associationId: number, quote: Quote): Promise<number> {
  const existing = await prisma.subscription.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' } });
  const sub = existing.find((s) => ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(s.status)) ?? existing[0];
  if (sub) return sub.id;
  const now = new Date();
  const created = await prisma.subscription.create({
    data: {
      associationId,
      planId: quote.planId,
      planVersionId: quote.planVersionId,
      source: 'PURCHASE',
      status: 'EXPIRED',
      billingCycle: quote.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: now,
    },
  });
  return created.id;
}

async function finishCheckout(input: {
  associationId: number;
  buyer: Buyer;
  provider: PaymentProviderId;
  quote: Quote;
  subscriptionId: number;
  purpose: 'SUBSCRIPTION' | 'PLAN_CHANGE' | 'ADDON';
}): Promise<CheckoutResult> {
  const { quote, subscriptionId, provider } = input;

  // A change that costs nothing (a free plan, or credits that cover it) needs no payment, so it is applied straight away.
  if (quote.totalKobo === 0) {
    await activateFreeQuote({ subscriptionId, quote, actorId: input.buyer.userId });
    return { type: 'ACTIVATED', quote };
  }

  const association = await prisma.association.findUniqueOrThrow({ where: { id: input.associationId }, select: { id: true, name: true, subdomain: true } });
  const email = input.buyer.email || association.name;
  const callbackUrl = `${process.env.FRONTEND_URL}/subscription/verify`;
  const storedQuote = { ...quote, initiatedBy: input.buyer.userId } as unknown as Prisma.InputJsonValue;
  // Metadata sent to the gateway is for the receipt only. Activation never reads plan or amount from it.
  const metadata = { associationId: association.id, subscriptionId, subdomain: association.subdomain, purpose: input.purpose };

  if (provider === 'paystack') {
    const reference = PaystackService.generateReference(input.purpose === 'ADDON' ? 'ADDON' : input.purpose === 'PLAN_CHANGE' ? 'CHANGE' : 'SUB');
    const response = await new PaystackService().initializePayment({
      email,
      amount: quote.totalKobo,
      reference,
      callback_url: callbackUrl,
      metadata: { ...metadata, provider: 'paystack' },
    });
    if (!response.status) throw new BillingError('GATEWAY_ERROR', 'We could not start the payment. Please try again.', 502);

    await prisma.paymentHistory.create({
      data: {
        subscriptionId,
        amount: koboToNaira(quote.totalKobo),
        currency: 'NGN',
        status: 'PENDING',
        provider: 'paystack',
        reference: response.data.reference,
        accessCode: response.data.access_code,
        authorizationUrl: response.data.authorization_url,
        purpose: input.purpose,
        expectedAmountKobo: quote.totalKobo,
        quote: storedQuote,
      },
    });
    return {
      type: 'PAYMENT',
      provider,
      reference: response.data.reference,
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      quote,
    };
  }

  // Nomba (only reachable while SUBSCRIPTION_NOMBA_ENABLED=true)
  const reference = `NMB-SUB-${Date.now()}-${subscriptionId}`;
  const nomba = await nombaService.initializePayment({
    amount: nombaService.convertToKobo(koboToNaira(quote.totalKobo)),
    email: input.buyer.email || 'noemail@societyledger.com',
    reference,
    callbackUrl,
    metadata: { ...metadata, provider: 'nomba' },
  });
  await prisma.paymentHistory.create({
    data: {
      subscriptionId,
      amount: koboToNaira(quote.totalKobo),
      currency: 'NGN',
      status: 'PENDING',
      provider: 'nomba',
      reference,
      accessCode: nomba.data.orderReference,
      authorizationUrl: nomba.data.checkoutLink,
      purpose: input.purpose,
      expectedAmountKobo: quote.totalKobo,
      quote: storedQuote,
    },
  });
  return { type: 'PAYMENT', provider, reference, authorizationUrl: nomba.data.checkoutLink, quote };
}
