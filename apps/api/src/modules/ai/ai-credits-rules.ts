/**
 * The rules of AI use: how many requests an association gets free each day, what a request costs, how bought credits are spent and what
 * a purchase costs. Kept free of the database so each rule can be tested on its own.
 *
 * Every number here is a default. The platform owner changes the real ones in the admin console (`platform.ai`), so nothing below is
 * a promise to customers: it is only what is used until the owner sets otherwise.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';
import { RuleError } from '../finance/rule-error';
import { lagosDayEnd, lagosDayKey, lagosDayStart } from '../accounting/accounting-rules';

export class AiCreditsError extends RuleError {}

export type AiKind = 'question' | 'reminders' | 'report';
export type AiTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export const AI_TIERS: AiTier[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
export const AI_KINDS: AiKind[] = ['question', 'reminders', 'report'];

export type AiSettings = {
  /** Switches the assistant off for every association (an emergency stop, or an unpaid provider bill). */
  enabled: boolean;
  /** The OpenRouter model id, for example "deepseek/deepseek-chat". */
  model: string;
  /** The most the model may write in one answer. It is what keeps a request's cost bounded. */
  maxOutputTokens: number;
  /** What one credit costs, in naira. */
  creditPriceNaira: number;
  /** The least an association can pay for credits in one purchase, in naira (keeps Paystack's fee small). */
  minPurchaseNaira: number;
  /** Requests each association gets free every day, by plan. */
  allowances: Record<AiTier, number>;
  /** What each kind of request costs, in units. */
  weights: Record<AiKind, number>;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  model: 'deepseek/deepseek-chat',
  maxOutputTokens: 1500,
  creditPriceNaira: 20,
  minPurchaseNaira: 3000,
  allowances: { STARTER: 10, PROFESSIONAL: 30, ENTERPRISE: 100 },
  weights: { question: 1, reminders: 1, report: 5 },
};

const whole = (label: string, min: number, max: number) =>
  z.number({ invalid_type_error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} cannot be less than ${min}.`).max(max, `${label} cannot be more than ${max}.`);
const naira = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label} must be a number.` })
    .min(min, `${label} cannot be less than ₦${min}.`)
    .max(max, `${label} cannot be more than ₦${max.toLocaleString('en-NG')}.`)
    .refine((v) => Math.round(v * 100) === v * 100, `${label} can have at most two decimal places.`);

/** What the owner may save in the admin console: every field optional, nothing unknown, every number inside sensible bounds. */
export const aiSettingsSchema = z
  .object({
    enabled: z.boolean(),
    model: z
      .string()
      .trim()
      .max(100, 'The model name is too long.')
      .regex(/^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Use the model id from OpenRouter, like deepseek/deepseek-chat.'),
    maxOutputTokens: whole('The answer length', 200, 8000),
    creditPriceNaira: naira('The credit price', 1, 100_000),
    minPurchaseNaira: naira('The minimum purchase', 100, 10_000_000),
    allowances: z.object({ STARTER: whole('The Starter allowance', 0, 100_000), PROFESSIONAL: whole('The Pro allowance', 0, 100_000), ENTERPRISE: whole('The Enterprise allowance', 0, 100_000) }).partial().strict(),
    weights: z.object({ question: whole('The question cost', 1, 100), reminders: whole('The reminders cost', 1, 100), report: whole('The report cost', 1, 100) }).partial().strict(),
  })
  .partial()
  .strict();

/** The stored settings laid over the defaults. A stored value that is no longer valid is ignored, so a bad save can never switch the assistant off by accident. */
export function mergeAiSettings(stored: unknown): AiSettings {
  const base: AiSettings = { ...DEFAULT_AI_SETTINGS, allowances: { ...DEFAULT_AI_SETTINGS.allowances }, weights: { ...DEFAULT_AI_SETTINGS.weights } };
  const parsed = aiSettingsSchema.safeParse(stored && typeof stored === 'object' ? stored : {});
  if (!parsed.success) return base;
  const v = parsed.data;
  return {
    enabled: v.enabled ?? base.enabled,
    model: v.model ?? base.model,
    maxOutputTokens: v.maxOutputTokens ?? base.maxOutputTokens,
    creditPriceNaira: v.creditPriceNaira ?? base.creditPriceNaira,
    minPurchaseNaira: v.minPurchaseNaira ?? base.minPurchaseNaira,
    allowances: { ...base.allowances, ...v.allowances },
    weights: { ...base.weights, ...v.weights },
  };
}

/** Whether the settings as a whole make sense together: the minimum purchase must buy at least one credit. */
export function assertConsistent(settings: AiSettings): void {
  if (settings.minPurchaseNaira < settings.creditPriceNaira) {
    throw new AiCreditsError('The minimum purchase cannot be less than the price of one credit.', 400, 'INVALID_AI_SETTINGS');
  }
}

/** The plan's free requests per day. An unknown plan gets the smallest. */
export function allowanceFor(tier: string | null | undefined, settings: AiSettings): number {
  return settings.allowances[(AI_TIERS as string[]).includes(tier ?? '') ? (tier as AiTier) : 'STARTER'];
}

export const unitsFor = (kind: AiKind, settings: AiSettings): number => settings.weights[kind];

/** The Lagos day a moment falls in: when it began and when the allowance next resets. */
export function dayWindow(now: Date = new Date()): { start: Date; resetsAt: Date } {
  const key = lagosDayKey(now);
  return { start: lagosDayStart(key), resetsAt: new Date(lagosDayEnd(key).getTime() + 1) };
}

export type Spend = { allowance: number; credits: number };

/**
 * How a request is paid for. The day's free allowance first (it is about to disappear anyway), then bought credits for whatever is left,
 * so a report that costs 5 with 3 free left takes 3 free and 2 credits. Null when the two together cannot cover it.
 */
export function planSpend(units: number, allowanceLeft: number, credits: number): Spend | null {
  const free = Math.max(0, allowanceLeft);
  const bought = Math.max(0, credits);
  if (free + bought < units) return null;
  const fromAllowance = Math.min(units, free);
  return { allowance: fromAllowance, credits: units - fromAllowance };
}

export type PurchaseQuote = { credits: number; pricePerCredit: Decimal; amount: Decimal };

/** What buying this many credits costs, or a plain refusal when it is below the minimum or not a sensible number. */
export function quotePurchase(credits: unknown, settings: AiSettings): PurchaseQuote {
  if (typeof credits !== 'number' || !Number.isInteger(credits) || credits <= 0) {
    throw new AiCreditsError('Choose how many credits to buy.', 400, 'INVALID_CREDITS');
  }
  if (credits > 1_000_000) throw new AiCreditsError('That is more credits than can be bought at once.', 400, 'INVALID_CREDITS');
  const pricePerCredit = new Decimal(settings.creditPriceNaira);
  const amount = pricePerCredit.times(credits);
  if (amount.lt(settings.minPurchaseNaira)) {
    const least = Math.ceil(new Decimal(settings.minPurchaseNaira).dividedBy(pricePerCredit).toNumber());
    throw new AiCreditsError(`The least you can buy is ${least.toLocaleString('en-NG')} credits (₦${new Decimal(settings.minPurchaseNaira).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}).`, 400, 'BELOW_MINIMUM');
  }
  return { credits, pricePerCredit, amount };
}

/** The fewest credits a purchase can be. */
export const minimumCredits = (settings: AiSettings): number => Math.ceil(new Decimal(settings.minPurchaseNaira).dividedBy(settings.creditPriceNaira).toNumber());

/** Whether what Paystack says was paid covers the purchase, in kobo and in naira. A shortfall must never add credits. */
export function paymentCovers(purchaseAmount: Decimal.Value, paidKobo: unknown, currency: unknown): boolean {
  if (currency !== undefined && currency !== null && String(currency).toUpperCase() !== 'NGN') return false;
  const paid = typeof paidKobo === 'number' ? paidKobo : Number(paidKobo);
  if (!Number.isFinite(paid)) return false;
  return new Decimal(paid).gte(new Decimal(purchaseAmount).times(100));
}
