import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { PaystackService } from '../payments/paystack/paystack.service';
import { nombaService } from '../payments/nomba/nomba.service';
import { getAssociationAccess } from '../../services/subscription-access.service';
import { getPlanVersionTerms, listPurchasableAddons, listPurchasablePlans } from '../../services/billing/catalog.service';
import { activateFromPayment, cancelAddonAtPeriodEnd } from '../../services/billing/lifecycle.service';
import { startAddonCheckout, startPlanCheckout, subscriptionProviders } from '../../services/billing/checkout.service';
import { BillingError, quoteAddonCheckout, quotePlanCheckout } from '../../services/billing/quote.service';
import { notifyBillingEvent } from '../../services/billing/billing-notifications.service';
import { nairaToKobo } from '../../services/billing/money';
import { pickDecidingSubscription } from '../../services/subscription-access.service';

const cycleSchema = z.enum(['MONTHLY', 'ANNUAL']);
const planCheckoutSchema = z.object({
  planId: z.coerce.number().int().positive(),
  billingCycle: cycleSchema,
  addonIds: z.array(z.coerce.number().int().positive()).max(20).optional(),
  provider: z.string().optional(),
});
const addonCheckoutSchema = z.object({
  addonIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
  provider: z.string().optional(),
});

/** Turn a thrown BillingError / validation error into the API's usual failure shape. */
function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof BillingError) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, message: 'Please check what you selected and try again.', errors: error.issues });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

async function currentSubscriptionRow(associationId: number) {
  const subs = await prisma.subscription.findMany({
    where: { associationId },
    include: { plan: true },
  });
  return pickDecidingSubscription(subs);
}

export const subscriptionController = {
  /** The plans, add-ons and payment providers this association can buy right now (published, visible, purchasable only). */
  async getPlans(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const kind = associationId ? (await prisma.association.findUnique({ where: { id: associationId }, select: { kind: true } }))?.kind : undefined;
      const [plans, addons] = await Promise.all([listPurchasablePlans(kind ?? 'ASSOCIATION'), listPurchasableAddons()]);
      return res.status(200).json({ success: true, data: { plans, addons, providers: subscriptionProviders() } });
    } catch (error) {
      return fail(res, error, 'Failed to fetch plans');
    }
  },

  /** The association's subscription, the exact terms it is on, its add-ons, and whether it may use the app right now. */
  async getCurrentSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });

      const subscription = await currentSubscriptionRow(associationId);
      if (!subscription) return res.status(404).json({ success: false, message: 'No subscription found' });

      const [terms, access, payments, termHistory, addons, pendingPlan] = await Promise.all([
        getPlanVersionTerms(subscription.planVersionId),
        getAssociationAccess(associationId),
        prisma.paymentHistory.findMany({
          where: { subscriptionId: subscription.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, amount: true, currency: true, status: true, provider: true, reference: true, paidAt: true, purpose: true, createdAt: true, needsReview: true },
        }),
        prisma.subscriptionTerm.findMany({
          where: { subscriptionId: subscription.id },
          orderBy: { startsAt: 'desc' },
          take: 10,
          select: { id: true, kind: true, billingCycle: true, startsAt: true, endsAt: true, amountKobo: true, reason: true },
        }),
        prisma.tenantAddon.findMany({
          where: { associationId, subscriptionId: subscription.id, status: 'ACTIVE', endsAt: { gt: new Date() } },
          include: { addonVersion: { include: { addon: { select: { id: true, code: true, name: true } } } } },
        }),
        subscription.pendingPlanId ? prisma.plan.findUnique({ where: { id: subscription.pendingPlanId } }) : null,
      ]);

      return res.status(200).json({
        success: true,
        data: {
          ...subscription,
          terms,
          access,
          payments,
          termHistory,
          addons: addons.map((a) => ({
            id: a.id,
            addonId: a.addonVersion.addon.id,
            code: a.addonVersion.addon.code,
            name: a.addonVersion.addon.name,
            endsAt: a.endsAt,
            cancelAtPeriodEnd: a.cancelAtPeriodEnd,
            amountPaidKobo: a.amountPaidKobo,
          })),
          pendingPlan,
        },
      });
    } catch (error) {
      return fail(res, error, 'Failed to fetch subscription');
    }
  },

  /** Price a checkout without paying: the review step before payment. Always computed from the server's published terms. */
  async quote(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const input = planCheckoutSchema.parse(req.body);
      const quote = await quotePlanCheckout(associationId, input);
      return res.status(200).json({ success: true, data: quote });
    } catch (error) {
      return fail(res, error, 'Failed to price this subscription');
    }
  },

  /** Start paying for a plan (new, renewal or change). The amount comes from the server's own quote. */
  async initializePayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId || !req.user) return res.status(400).json({ success: false, message: 'Association ID is required' });
      // `change-plan` posts newPlanId; plain checkout posts planId. Either way only the plan, cycle and add-ons are read.
      const body = { ...req.body, planId: req.body?.planId ?? req.body?.newPlanId };
      const input = planCheckoutSchema.parse(body);
      const result = await startPlanCheckout({
        associationId,
        buyer: { userId: req.user.id, email: req.user.email },
        planId: input.planId,
        billingCycle: input.billingCycle,
        addonIds: input.addonIds,
        provider: input.provider,
      });
      return respondToCheckout(res, result);
    } catch (error) {
      return fail(res, error, 'Failed to initialize payment');
    }
  },

  async quoteAddons(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const input = addonCheckoutSchema.parse(req.body);
      return res.status(200).json({ success: true, data: await quoteAddonCheckout(associationId, input) });
    } catch (error) {
      return fail(res, error, 'Failed to price these add-ons');
    }
  },

  async initializeAddonPayment(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId || !req.user) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const input = addonCheckoutSchema.parse(req.body);
      const result = await startAddonCheckout({ associationId, buyer: { userId: req.user.id, email: req.user.email }, addonIds: input.addonIds, provider: input.provider });
      return respondToCheckout(res, result);
    } catch (error) {
      return fail(res, error, 'Failed to initialize payment');
    }
  },

  /** Stop an add-on renewing (it keeps working until its end date), or turn renewal back on. */
  async setAddonRenewal(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const id = z.coerce.number().int().positive().parse(req.params.id);
      const stop = z.object({ stop: z.boolean() }).parse(req.body).stop;
      const row = await cancelAddonAtPeriodEnd({ associationId, tenantAddonId: id, undo: !stop });
      return res.status(200).json({ success: true, message: stop ? 'This add-on will not renew.' : 'This add-on will renew with your plan.', data: row });
    } catch (error) {
      return fail(res, error, 'Failed to update the add-on');
    }
  },

  /** Confirm a payment with the gateway and, only if it is verified and matches the quote, activate it. Safe to call repeatedly. */
  async verifyPayment(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      if (!reference) return res.status(400).json({ success: false, message: 'Payment reference is required' });
      return reference.startsWith('NMB-') ? await verifyNombaPayment(res, reference) : await verifyPaystackPayment(res, reference);
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
  },

  /** A receipt for one paid subscription payment, built from what was stored at checkout (the quoted lines), never recalculated. */
  async getReceipt(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const id = Number(req.params.id);
      if (!associationId || !Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Payment id is required' });

      const payment = await prisma.paymentHistory.findFirst({
        where: { id, status: 'SUCCESS', needsReview: false, subscription: { associationId } },
        include: { subscription: { select: { association: { select: { name: true } } } } },
      });
      if (!payment) return res.status(404).json({ success: false, message: 'Receipt not found. Only confirmed payments have a receipt.' });

      const quote = (payment.quote ?? {}) as { planName?: string; billingCycle?: string; lines?: Array<{ label: string; amountKobo: number }>; periodEndsAt?: string };
      const totalKobo = payment.expectedAmountKobo ?? Math.round(Number(payment.amount) * 100);
      res.json({
        success: true,
        data: {
          receiptNumber: `SL-${String(payment.id).padStart(6, '0')}`,
          association: payment.subscription.association.name,
          reference: payment.reference,
          provider: payment.provider,
          currency: payment.currency,
          paidAt: payment.paidAt ?? payment.createdAt,
          purpose: payment.purpose,
          planName: quote.planName ?? null,
          billingCycle: quote.billingCycle ?? null,
          periodEndsAt: quote.periodEndsAt ?? null,
          lines: quote.lines ?? [],
          totalKobo,
        },
      });
    } catch (error) {
      console.error('Get receipt error:', error);
      res.status(500).json({ success: false, message: 'Failed to load the receipt' });
    }
  },

  // Cancel subscription (mark for cancellation at period end)
  async cancelSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const subscription = await prisma.subscription.findFirst({ where: { associationId, status: { in: ['ACTIVE', 'PAST_DUE'] } } });
      if (!subscription) return res.status(404).json({ success: false, message: 'No active subscription found' });
      await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true } });
      return res.status(200).json({ success: true, message: 'Subscription will be cancelled at the end of the billing period', data: subscription });
    } catch (error) {
      return fail(res, error, 'Failed to cancel subscription');
    }
  },

  // Reactivate subscription (remove cancellation flag)
  async reactivateSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const subscription = await prisma.subscription.findFirst({
        where: { associationId, status: { in: ['ACTIVE', 'PAST_DUE'] }, cancelAtPeriodEnd: true },
      });
      if (!subscription) return res.status(404).json({ success: false, message: 'No subscription marked for cancellation found' });
      await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: false } });
      return res.status(200).json({ success: true, message: 'Subscription reactivated successfully', data: subscription });
    } catch (error) {
      return fail(res, error, 'Failed to reactivate subscription');
    }
  },
};

function respondToCheckout(res: Response, result: Awaited<ReturnType<typeof startPlanCheckout>>) {
  if (result.type === 'DEFERRED') {
    return res.status(200).json({
      success: true,
      message: `Your move to ${result.quote.planName} is scheduled for the end of your current period. Nothing is charged now.`,
      data: { type: 'DEFERRED', requiresPayment: false, effectiveDate: result.quote.deferredEffectiveAt, quote: result.quote },
    });
  }
  if (result.type === 'ACTIVATED') {
    return res.status(200).json({ success: true, message: 'Your subscription has been updated.', data: { type: 'ACTIVATED', requiresPayment: false, quote: result.quote } });
  }
  return res.status(200).json({
    success: true,
    message: 'Payment initialized successfully',
    data: {
      type: 'PAYMENT',
      requiresPayment: true,
      provider: result.provider,
      reference: result.reference,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      checkoutLink: result.provider === 'nomba' ? result.authorizationUrl : undefined,
      quote: result.quote,
    },
  });
}

async function afterActivation(res: Response, outcome: Awaited<ReturnType<typeof activateFromPayment>>, gateway: unknown) {
  if (outcome.outcome === 'NOT_FOUND') return res.status(404).json({ success: false, message: 'Payment record not found' });
  const association = outcome.associationId
    ? await prisma.association.findUnique({ where: { id: outcome.associationId }, select: { subdomain: true, name: true } })
    : null;
  const subscription = outcome.subscriptionId
    ? await prisma.subscription.findUnique({ where: { id: outcome.subscriptionId }, include: { plan: true } })
    : null;

  if (outcome.outcome === 'NEEDS_REVIEW') {
    return res.status(200).json({
      success: true,
      message: 'We received your payment but need to check it before activating. We will contact you; please do not pay again.',
      data: { status: 'REVIEW', outcome: outcome.outcome, subscription, subdomain: association?.subdomain, associationName: association?.name },
    });
  }
  return res.status(200).json({
    success: true,
    message: outcome.outcome === 'ALREADY_APPLIED' ? 'Payment already verified' : 'Payment verified successfully',
    data: { status: 'SUCCESS', outcome: outcome.outcome, subscription, payment: gateway, subdomain: association?.subdomain, associationName: association?.name },
  });
}

async function markFailed(reference: string): Promise<number | null> {
  const payment = await prisma.paymentHistory.findUnique({ where: { reference }, include: { subscription: { select: { associationId: true } } } });
  if (!payment || payment.appliedAt || payment.status !== 'PENDING') return null;
  await prisma.paymentHistory.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  return payment.subscription.associationId;
}

async function verifyPaystackPayment(res: Response, reference: string) {
  const payment = await prisma.paymentHistory.findUnique({ where: { reference }, select: { id: true, appliedAt: true, subscription: { select: { associationId: true } } } });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });

  const verification = await new PaystackService().verifyPayment(reference);
  if (!verification.status) {
    return res.status(502).json({ success: false, message: 'We could not confirm this payment with the payment provider yet. Please try again shortly.' });
  }

  const gatewayStatus = verification.data.status;
  if (gatewayStatus === 'success') {
    const outcome = await activateFromPayment({
      reference,
      verifiedAmountKobo: Math.round(verification.data.amount),
      paidAt: verification.data.paid_at ? new Date(verification.data.paid_at) : undefined,
      gatewayPayload: verification.data,
    });
    return afterActivation(res, outcome, verification.data);
  }

  if (['failed', 'abandoned', 'reversed'].includes(gatewayStatus)) {
    const associationId = await markFailed(reference);
    if (associationId) void notifyBillingEvent({ type: 'PAYMENT_FAILED', associationId });
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed',
      data: { status: 'FAILED', gateway_status: gatewayStatus, gateway_response: verification.data?.gateway_response },
    });
  }

  // Still processing at the provider: nothing is activated, and the webhook will finish it when the provider confirms.
  return res.status(202).json({
    success: true,
    message: 'Your payment is still being processed. Your subscription is activated as soon as it is confirmed.',
    data: { status: 'PENDING', gateway_status: gatewayStatus },
  });
}

async function verifyNombaPayment(res: Response, reference: string) {
  const payment = await prisma.paymentHistory.findUnique({ where: { reference }, select: { id: true } });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });

  const verification = await nombaService.verifyPayment(reference);
  if (verification.data.status !== 'success') {
    return res.status(400).json({ success: false, message: 'Payment verification failed', data: { status: verification.data.status } });
  }
  const outcome = await activateFromPayment({
    reference,
    verifiedAmountKobo: nairaToKobo(nombaService.convertToNaira(verification.data.amount)),
    gatewayPayload: verification.data,
  });
  return afterActivation(res, outcome, verification.data);
}
