/**
 * AI use, paid for in units. Each association gets a free allowance every Lagos day (by plan) and can buy credits on top. A request holds
 * its units before the model is called, and gives them back if the model fails, so a failed request costs nothing.
 *
 * Concurrency: every change to an association's units happens under a lock on its balance row, so two requests at the same moment can
 * never both spend the last unit. A purchase is credited once, whoever notices the payment first (Paystack's webhook, or the buyer's app).
 */

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { AiCreditsError, allowanceFor, dayWindow, minimumCredits, paymentCovers, planSpend, quotePurchase, unitsFor, type AiKind, type AiSettings } from './ai-credits-rules';
import { aiSettingsService } from './ai-settings.service';
import { RateLimitError } from './tools/rate-limiter';
import type { RateLimitStatus } from './ai.types';
import { tenantBaseUrl } from '../../lib/tenant-url';

/** A request that has been paid for but whose model call is still running. After this long without finishing it is treated as lost. */
const HOLD_MINUTES = 10;

export type AiStatus = RateLimitStatus & {
  enabled: boolean;
  tier: string;
  allowancePerDay: number;
  allowanceUsed: number;
  allowanceLeft: number;
  credits: number;
  totalPurchased: number;
  weights: AiSettings['weights'];
  creditPriceNaira: number;
  minPurchaseNaira: number;
  minimumCredits: number;
  /** Whether a plain question could be asked right now. */
  canAsk: boolean;
};

export type Hold = { logId: number; associationId: number; kind: AiKind; units: number; allowance: number; credits: number };

type Db = Prisma.TransactionClient | typeof prisma;

const holdCutoff = (now: Date = new Date()) => new Date(now.getTime() - HOLD_MINUTES * 60_000);

/** The units of today's free allowance already used: finished requests, and ones still being worked on. */
async function allowanceUsedToday(db: Db, associationId: number, now: Date): Promise<number> {
  const { start } = dayWindow(now);
  const sums = await db.aIAuditLog.aggregate({
    where: {
      associationId,
      createdAt: { gte: start },
      OR: [{ status: 'success' }, { status: 'pending', createdAt: { gte: holdCutoff(now) } }],
    },
    _sum: { allowanceUnits: true },
  });
  return sums._sum.allowanceUnits ?? 0;
}

function toStatus(settings: AiSettings, tier: string, used: number, balance: { balance: number; totalPurchased: number }, now: Date): AiStatus {
  const perDay = allowanceFor(tier, settings);
  const left = Math.max(0, perDay - used);
  const canAsk = settings.enabled && left + balance.balance >= unitsFor('question', settings);
  return {
    enabled: settings.enabled,
    tier,
    allowancePerDay: perDay,
    allowanceUsed: used,
    allowanceLeft: left,
    credits: balance.balance,
    totalPurchased: balance.totalPurchased,
    weights: settings.weights,
    creditPriceNaira: settings.creditPriceNaira,
    minPurchaseNaira: settings.minPurchaseNaira,
    minimumCredits: minimumCredits(settings),
    canAsk,
    // The older fields other screens already read
    requestsUsed: used,
    requestsRemaining: left + balance.balance,
    tokensUsed: 0,
    tokensRemaining: 0,
    resetsAt: dayWindow(now).resetsAt,
    isLimited: !canAsk,
  };
}

async function tierOf(db: Db, associationId: number): Promise<string> {
  const association = await db.association.findUnique({ where: { id: associationId }, select: { tier: true } });
  return association?.tier ?? 'STARTER';
}

export const aiCredits = {
  /** What the association has left today, and what each kind of request costs. */
  async getStatus(associationId: number, now: Date = new Date()): Promise<AiStatus> {
    const [settings, tier, balance, used] = await Promise.all([
      aiSettingsService.get(),
      tierOf(prisma, associationId),
      prisma.aICreditBalance.findUnique({ where: { associationId }, select: { balance: true, totalPurchased: true } }),
      allowanceUsedToday(prisma, associationId, now),
    ]);
    return toStatus(settings, tier, used, balance ?? { balance: 0, totalPurchased: 0 }, now);
  },

  /**
   * Pays for a request before the model is called: the day's free allowance first, then credits. Refused (429) when neither can cover it,
   * with the status, so the screen can offer to buy credits. The units are held until `settle` or `release`.
   */
  async reserve(associationId: number, userId: number, kind: AiKind, promptType: string): Promise<Hold> {
    const settings = await aiSettingsService.get();
    if (!settings.enabled) throw new AiCreditsError('The AI assistant is switched off for now. Try again later.', 503, 'AI_DISABLED');
    const units = unitsFor(kind, settings);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // The balance row is the lock: it exists for every association that has ever asked, and nobody else changes units while it is held
      await tx.aICreditBalance.upsert({ where: { associationId }, create: { associationId }, update: {} });
      await tx.$queryRaw`SELECT id FROM ai_credit_balances WHERE association_id = ${associationId} FOR UPDATE`;

      // A request that never finished (the server stopped mid-way) gives back what it held
      const stale = await tx.aIAuditLog.findMany({ where: { associationId, status: 'pending', createdAt: { lt: holdCutoff(now) } }, select: { id: true, creditUnits: true } });
      for (const lost of stale) {
        await tx.aIAuditLog.updateMany({ where: { id: lost.id, status: 'pending' }, data: { status: 'error', errorMessage: 'The request did not finish.' } });
        if (lost.creditUnits > 0) await tx.aICreditBalance.update({ where: { associationId }, data: { balance: { increment: lost.creditUnits }, totalUsed: { decrement: lost.creditUnits } } });
      }

      const [tier, balance, used] = await Promise.all([
        tierOf(tx, associationId),
        tx.aICreditBalance.findUniqueOrThrow({ where: { associationId } }),
        allowanceUsedToday(tx, associationId, now),
      ]);
      const left = Math.max(0, allowanceFor(tier, settings) - used);
      const spend = planSpend(units, left, balance.balance);
      if (!spend) {
        const status = toStatus(settings, tier, used, balance, now);
        throw new RateLimitError(
          left + balance.balance === 0
            ? `You have used today's ${allowanceFor(tier, settings)} free requests and have no credits left. Buy credits to keep going, or wait until the allowance resets.`
            : `This needs ${units} ${units === 1 ? 'unit' : 'units'} and you have ${left + balance.balance} left. Buy credits to continue.`,
          status,
        );
      }

      if (spend.credits > 0) {
        await tx.aICreditBalance.update({ where: { associationId }, data: { balance: { decrement: spend.credits }, totalUsed: { increment: spend.credits } } });
      }
      const log = await tx.aIAuditLog.create({
        data: {
          associationId,
          userId,
          promptType,
          modelUsed: settings.model,
          status: 'pending',
          units,
          allowanceUnits: spend.allowance,
          creditUnits: spend.credits,
        },
      });
      return { logId: log.id, associationId, kind, units, allowance: spend.allowance, credits: spend.credits };
    });
  },

  /** The model answered: the held units are spent for good, and the request's tokens and cost are recorded. */
  async settle(hold: Hold, data: { modelUsed: string; tokensInput: number; tokensOutput: number; costUsd: number; outputSummary: string }): Promise<void> {
    try {
      await prisma.aIAuditLog.updateMany({
        where: { id: hold.logId, status: 'pending' },
        data: {
          status: 'success',
          modelUsed: data.modelUsed,
          tokensInput: data.tokensInput,
          tokensOutput: data.tokensOutput,
          costUsd: new Decimal(data.costUsd),
          outputSummary: data.outputSummary.slice(0, 500),
        },
      });
    } catch (error) {
      // The answer was already produced; a failure to write down its cost must not take it away from the officer
      console.error('Failed to settle an AI request:', error);
    }
  },

  /** The request failed: the units come back (credits to the balance, allowance to the day), and nothing is charged. */
  async release(hold: Hold, message: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.aIAuditLog.updateMany({ where: { id: hold.logId, status: 'pending' }, data: { status: 'error', errorMessage: message.slice(0, 500) } });
        if (count === 1 && hold.credits > 0) {
          await tx.aICreditBalance.update({ where: { associationId: hold.associationId }, data: { balance: { increment: hold.credits }, totalUsed: { decrement: hold.credits } } });
        }
      });
    } catch (error) {
      console.error('Failed to release an AI request:', error);
    }
  },

  /**
   * Runs one request: pays for it first, does the work, and either keeps the charge (the work returns what to record) or gives it back
   * (the work throws). The one place every AI feature goes through, so none of them can forget to charge or to refund.
   */
  async charged<T>(
    associationId: number,
    userId: number,
    kind: AiKind,
    promptType: string,
    work: (hold: Hold, settings: AiSettings) => Promise<{ value: T; usage: { modelUsed: string; tokensInput: number; tokensOutput: number; costUsd: number; outputSummary: string } }>,
  ): Promise<T> {
    const hold = await this.reserve(associationId, userId, kind, promptType);
    try {
      const { value, usage } = await work(hold, await aiSettingsService.get());
      await this.settle(hold, usage);
      return value;
    } catch (error) {
      await this.release(hold, error instanceof Error ? error.message : 'The request failed.');
      throw error;
    }
  },

  // ---------------------------------------------------------------- buying credits

  /** Starts a Paystack payment for this many credits. The purchase is recorded as pending until Paystack confirms it. */
  async startPurchase(associationId: number, userId: number, credits: unknown, platform: 'web' | 'mobile') {
    const settings = await aiSettingsService.get();
    const quote = quotePurchase(credits, settings);

    const { PaystackService } = await import('../payments/paystack/paystack.service');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) throw new AiCreditsError('Your account needs an email address to pay.', 400, 'EMAIL_REQUIRED');
    const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true, subdomain: true } });

    const reference = PaystackService.generateReference('AIC');
    const callbackUrl =
      platform === 'mobile'
        ? `${process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'https://api.societyledger.app'}/api/payments/mobile-return`
        : `${tenantBaseUrl(association?.subdomain)}/dashboard/ai/credits?reference=${reference}`;

    const paystack = new PaystackService();
    const init = await paystack.initializePayment({
      email: user.email,
      amount: PaystackService.nairaToKobo(quote.amount.toNumber()),
      reference,
      callback_url: callbackUrl,
      metadata: { type: 'ai_credits', associationId, userId, associationName: association?.name, credits: quote.credits, pricePerCredit: quote.pricePerCredit.toNumber() },
    });

    await prisma.aICreditPurchase.create({
      data: {
        associationId,
        userId,
        credits: quote.credits,
        pricePerCredit: quote.pricePerCredit,
        amount: quote.amount,
        reference,
        status: 'pending',
        metadata: { accessCode: init.data.access_code, authorizationUrl: init.data.authorization_url, platform },
      },
    });
    await prisma.auditLog.create({
      data: { associationId, userId, action: 'AI_CREDITS_PURCHASE_STARTED', tableName: 'ai_credit_purchases', newValues: { reference, credits: quote.credits, amount: quote.amount.toFixed(2) } },
    });

    return { reference, authorizationUrl: init.data.authorization_url, credits: quote.credits, amount: quote.amount.toNumber() };
  },

  /**
   * Adds the credits for a payment Paystack has confirmed — once. The purchase is claimed (pending to success) in the same step that adds
   * the credits, so two confirmations at the same moment (the webhook and the buyer's app) cannot both add them. A payment that does not
   * cover the price adds nothing. Returns whether credits were added by this call.
   */
  async creditPurchase(reference: string, paid: { amountKobo: unknown; currency?: unknown; paidAt?: unknown; raw?: unknown }): Promise<{ credited: boolean; reason?: 'unknown' | 'short' | 'already' }> {
    const purchase = await prisma.aICreditPurchase.findUnique({ where: { reference } });
    if (!purchase) return { credited: false, reason: 'unknown' };
    if (purchase.status === 'success') return { credited: false, reason: 'already' };
    if (!paymentCovers(purchase.amount, paid.amountKobo, paid.currency)) {
      console.error(`AI credits: payment for ${reference} does not cover ${purchase.amount.toString()} naira; nothing credited.`);
      return { credited: false, reason: 'short' };
    }

    const credited = await prisma.$transaction(async (tx) => {
      const claimed = await tx.aICreditPurchase.updateMany({
        where: { id: purchase.id, status: { not: 'success' } },
        data: { status: 'success', paidAt: paid.paidAt ? new Date(String(paid.paidAt)) : new Date(), paystackResponse: (paid.raw ?? null) as Prisma.InputJsonValue },
      });
      if (claimed.count !== 1) return false;
      await tx.aICreditBalance.upsert({
        where: { associationId: purchase.associationId },
        create: { associationId: purchase.associationId, balance: purchase.credits, totalPurchased: purchase.credits, lastTopUpAt: new Date() },
        update: { balance: { increment: purchase.credits }, totalPurchased: { increment: purchase.credits }, lastTopUpAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          associationId: purchase.associationId,
          userId: purchase.userId,
          action: 'AI_CREDITS_ADDED',
          tableName: 'ai_credit_balances',
          newValues: { reference, credits: purchase.credits, amount: purchase.amount.toFixed(2) },
        },
      });
      return true;
    });
    return credited ? { credited: true } : { credited: false, reason: 'already' };
  },

  /** The buyer's app asks whether a payment has gone through: ask Paystack, and credit it if it has (a webhook may have done so already). */
  async verifyPurchase(associationId: number, reference: string) {
    const purchase = await prisma.aICreditPurchase.findFirst({ where: { reference, associationId } });
    if (!purchase) throw new AiCreditsError('That purchase could not be found.', 404, 'PURCHASE_NOT_FOUND');
    if (purchase.status !== 'success') {
      const { PaystackService } = await import('../payments/paystack/paystack.service');
      const result = await new PaystackService().verifyPayment(reference);
      if (!result.status || result.data.status !== 'success') {
        return { status: result.data?.status === 'failed' ? 'failed' : 'pending', credits: purchase.credits };
      }
      await this.creditPurchase(reference, { amountKobo: result.data.amount, currency: result.data.currency, paidAt: result.data.paid_at, raw: result });
    }
    const after = await prisma.aICreditPurchase.findUnique({ where: { reference } });
    return { status: after?.status === 'success' ? 'success' : 'pending', credits: purchase.credits };
  },

  /** What this association has bought, newest first. */
  async purchases(associationId: number, limit = 20) {
    const rows = await prisma.aICreditPurchase.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' }, take: Math.min(100, limit) });
    return rows.map((p) => ({ id: p.id, reference: p.reference, credits: p.credits, amount: p.amount, status: p.status, paidAt: p.paidAt, createdAt: p.createdAt }));
  },
};
