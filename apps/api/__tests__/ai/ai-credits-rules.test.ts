/** What an AI request costs, how the free day and bought credits are spent, and what a purchase costs. */
import { Decimal } from '@prisma/client/runtime/library';
import {
  AiCreditsError,
  aiSettingsSchema,
  allowanceFor,
  assertConsistent,
  dayWindow,
  DEFAULT_AI_SETTINGS,
  mergeAiSettings,
  minimumCredits,
  paymentCovers,
  planSpend,
  quotePurchase,
  unitsFor,
} from '../../src/modules/ai/ai-credits-rules';

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof AiCreditsError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
};

describe('the defaults', () => {
  it('give each plan its daily allowance, and make a report cost more than a question', () => {
    expect(allowanceFor('STARTER', DEFAULT_AI_SETTINGS)).toBe(10);
    expect(allowanceFor('PROFESSIONAL', DEFAULT_AI_SETTINGS)).toBe(30);
    expect(allowanceFor('ENTERPRISE', DEFAULT_AI_SETTINGS)).toBe(100);
    expect(unitsFor('question', DEFAULT_AI_SETTINGS)).toBe(1);
    expect(unitsFor('reminders', DEFAULT_AI_SETTINGS)).toBe(1);
    expect(unitsFor('report', DEFAULT_AI_SETTINGS)).toBe(5);
  });

  it('give an unknown plan the smallest allowance', () => {
    expect(allowanceFor('SOMETHING_ELSE', DEFAULT_AI_SETTINGS)).toBe(10);
    expect(allowanceFor(undefined, DEFAULT_AI_SETTINGS)).toBe(10);
  });
});

describe('the settings the owner saves', () => {
  it('accept a change to one thing, and leave the rest as it was', () => {
    const merged = mergeAiSettings({ model: 'deepseek/deepseek-chat-v4', allowances: { STARTER: 5 } });
    expect(merged.model).toBe('deepseek/deepseek-chat-v4');
    expect(merged.allowances).toEqual({ STARTER: 5, PROFESSIONAL: 30, ENTERPRISE: 100 });
    expect(merged.creditPriceNaira).toBe(20);
  });

  it('refuse a model that is not an OpenRouter id, and numbers outside sensible bounds', () => {
    expect(aiSettingsSchema.safeParse({ model: 'just a name' }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ model: 'deepseek/deepseek-chat' }).success).toBe(true);
    expect(aiSettingsSchema.safeParse({ creditPriceNaira: 0 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ creditPriceNaira: 20.555 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ maxOutputTokens: 10 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ allowances: { STARTER: -1 } }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ weights: { report: 0 } }).success).toBe(false);
  });

  it('refuse anything they do not know', () => {
    expect(aiSettingsSchema.safeParse({ apiKey: 'sk-secret' }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ allowances: { GOLD: 5 } }).success).toBe(false);
  });

  it('fall back to the defaults when what is stored is no longer valid, so the assistant is never switched off by a bad save', () => {
    expect(mergeAiSettings({ enabled: 'nope' })).toEqual(DEFAULT_AI_SETTINGS);
    expect(mergeAiSettings(null)).toEqual(DEFAULT_AI_SETTINGS);
    expect(mergeAiSettings('garbage')).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('must let the minimum purchase buy at least one credit', () => {
    expect(codeOf(() => assertConsistent({ ...DEFAULT_AI_SETTINGS, creditPriceNaira: 500, minPurchaseNaira: 200 }))).toBe('INVALID_AI_SETTINGS');
    expect(codeOf(() => assertConsistent(DEFAULT_AI_SETTINGS))).toBe('NO_ERROR');
  });
});

describe('the days', () => {
  it('reset at midnight in Lagos, an hour before UTC midnight', () => {
    const { start, resetsAt } = dayWindow(new Date('2026-10-24T15:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-23T23:00:00.000Z');
    expect(resetsAt.toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });

  it('counts 23:30 UTC as already the next day in Lagos', () => {
    const { start } = dayWindow(new Date('2026-10-24T23:30:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-24T23:00:00.000Z');
  });
});

describe('paying for a request', () => {
  it('uses the free allowance first', () => {
    expect(planSpend(1, 10, 50)).toEqual({ allowance: 1, credits: 0 });
    expect(planSpend(5, 5, 0)).toEqual({ allowance: 5, credits: 0 });
  });

  it('takes the rest from credits when the allowance runs short, so a report can straddle the two', () => {
    expect(planSpend(5, 3, 10)).toEqual({ allowance: 3, credits: 2 });
    expect(planSpend(1, 0, 10)).toEqual({ allowance: 0, credits: 1 });
  });

  it('refuses when the two together cannot cover it, and takes nothing', () => {
    expect(planSpend(5, 2, 2)).toBeNull();
    expect(planSpend(1, 0, 0)).toBeNull();
  });

  it('never treats a negative balance as money', () => {
    expect(planSpend(1, -3, 5)).toEqual({ allowance: 0, credits: 1 });
    expect(planSpend(1, 0, -5)).toBeNull();
  });
});

describe('buying credits', () => {
  it('prices them at the credit price, in exact naira', () => {
    const quote = quotePurchase(150, DEFAULT_AI_SETTINGS);
    expect(quote.amount.toString()).toBe('3000');
    expect(quote.pricePerCredit.toString()).toBe('20');
    expect(quotePurchase(1000, { ...DEFAULT_AI_SETTINGS, creditPriceNaira: 19.99 }).amount.toString()).toBe('19990');
  });

  it('refuses less than the minimum purchase, and says how many credits that is', () => {
    expect(codeOf(() => quotePurchase(149, DEFAULT_AI_SETTINGS))).toBe('BELOW_MINIMUM');
    expect(() => quotePurchase(100, DEFAULT_AI_SETTINGS)).toThrow('150 credits (₦3,000.00)');
    expect(minimumCredits(DEFAULT_AI_SETTINGS)).toBe(150);
  });

  it('refuses nonsense', () => {
    for (const bad of [0, -5, 1.5, '200', null, undefined, NaN, 2_000_000]) expect(codeOf(() => quotePurchase(bad, DEFAULT_AI_SETTINGS))).toBe('INVALID_CREDITS');
  });

  it('only counts a payment that covers the price, in naira, and never a shortfall or another currency', () => {
    expect(paymentCovers(new Decimal('3000'), 300000, 'NGN')).toBe(true);
    expect(paymentCovers(new Decimal('3000'), 300001, 'NGN')).toBe(true);
    expect(paymentCovers(new Decimal('3000'), 299999, 'NGN')).toBe(false);
    expect(paymentCovers(new Decimal('3000'), 300000, 'USD')).toBe(false);
    expect(paymentCovers(new Decimal('3000'), 'abc', 'NGN')).toBe(false);
    expect(paymentCovers(new Decimal('3000'), 300000, undefined)).toBe(true);
  });
});
