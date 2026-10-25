/**
 * Paying for AI requests: the free day first, then credits; a failed request costs nothing; a purchase is credited once and only when
 * Paystack's payment covers it. The database is replaced by a small in-memory stand-in so the rules themselves are what is tested.
 */
import { Decimal } from '@prisma/client/runtime/library';

type Log = { id: number; associationId: number; userId: number; status: string; units: number; allowanceUnits: number; creditUnits: number; createdAt: Date; errorMessage?: string; [k: string]: unknown };
type Purchase = { id: number; associationId: number; userId: number; credits: number; amount: Decimal; reference: string; status: string; paidAt?: Date | null };

let balance: { balance: number; totalPurchased: number; totalUsed: number } | null = null;
let logs: Log[] = [];
let purchases: Purchase[] = [];
let tier = 'STARTER';
let nextId = 1;

const m = (...names: string[]) => Object.fromEntries(names.map((n) => [n, jest.fn()]));
const prismaMock: any = {
  aICreditBalance: m('upsert', 'findUnique', 'findUniqueOrThrow', 'update'),
  aIAuditLog: m('create', 'aggregate', 'findMany', 'updateMany'),
  aICreditPurchase: m('findUnique', 'findFirst', 'updateMany', 'create'),
  association: m('findUnique'),
  auditLog: m('create'),
  user: m('findUnique'),
  $queryRaw: jest.fn().mockResolvedValue([]),
  $transaction: jest.fn((run: (c: unknown) => unknown) => run(prismaMock)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));
jest.mock('../../src/modules/ai/ai-settings.service', () => {
  const actual = jest.requireActual('../../src/modules/ai/ai-credits-rules');
  return { aiSettingsService: { get: jest.fn(() => Promise.resolve(actual.DEFAULT_AI_SETTINGS)) } };
});

import { aiCredits } from '../../src/modules/ai/ai-credits.service';
import { RateLimitError } from '../../src/modules/ai/tools/rate-limiter';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const usage = { modelUsed: 'deepseek/deepseek-chat', tokensInput: 1000, tokensOutput: 200, costUsd: 0.001, outputSummary: 'ok' };

const todays = (over: Partial<Log>): Log => ({ id: nextId++, associationId: 7, userId: 1, status: 'success', units: 1, allowanceUnits: 1, creditUnits: 0, createdAt: NOW, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  balance = { balance: 0, totalPurchased: 0, totalUsed: 0 };
  logs = [];
  purchases = [];
  tier = 'STARTER';
  nextId = 1;
  prismaMock.association.findUnique.mockImplementation(() => Promise.resolve({ tier }));
  prismaMock.aICreditBalance.upsert.mockImplementation(({ create, update }: any) => {
    if (!balance) balance = { balance: 0, totalPurchased: 0, totalUsed: 0 };
    if (update?.balance?.increment) {
      balance.balance += update.balance.increment;
      balance.totalPurchased += update.totalPurchased.increment;
    }
    void create;
    return Promise.resolve(balance);
  });
  prismaMock.aICreditBalance.findUnique.mockImplementation(() => Promise.resolve(balance));
  prismaMock.aICreditBalance.findUniqueOrThrow.mockImplementation(() => Promise.resolve(balance));
  prismaMock.aICreditBalance.update.mockImplementation(({ data }: any) => {
    if (data.balance?.decrement) balance!.balance -= data.balance.decrement;
    if (data.balance?.increment) balance!.balance += data.balance.increment;
    if (data.totalUsed?.increment) balance!.totalUsed += data.totalUsed.increment;
    if (data.totalUsed?.decrement) balance!.totalUsed -= data.totalUsed.decrement;
    return Promise.resolve(balance);
  });
  prismaMock.aIAuditLog.aggregate.mockImplementation(({ where }: any) => {
    const start = where.createdAt.gte as Date;
    const used = logs.filter((l) => l.associationId === where.associationId && l.createdAt >= start && (l.status === 'success' || l.status === 'pending')).reduce((s, l) => s + l.allowanceUnits, 0);
    return Promise.resolve({ _sum: { allowanceUnits: used } });
  });
  prismaMock.aIAuditLog.findMany.mockImplementation(({ where }: any) => Promise.resolve(logs.filter((l) => l.status === where.status && l.createdAt < where.createdAt.lt)));
  prismaMock.aIAuditLog.create.mockImplementation(({ data }: any) => {
    const row = { id: nextId++, createdAt: new Date(), ...data };
    logs.push(row);
    return Promise.resolve(row);
  });
  prismaMock.aIAuditLog.updateMany.mockImplementation(({ where, data }: any) => {
    const hit = logs.filter((l) => l.id === where.id && (!where.status || l.status === where.status));
    hit.forEach((l) => Object.assign(l, data));
    return Promise.resolve({ count: hit.length });
  });
  prismaMock.aICreditPurchase.findUnique.mockImplementation(({ where }: any) => Promise.resolve(purchases.find((p) => p.reference === where.reference) ?? null));
  prismaMock.aICreditPurchase.updateMany.mockImplementation(({ where, data }: any) => {
    const hit = purchases.filter((p) => p.id === where.id && p.status !== where.status.not);
    hit.forEach((p) => Object.assign(p, data));
    return Promise.resolve({ count: hit.length });
  });
});
afterEach(() => jest.useRealTimers());

describe('what is left today', () => {
  it('shows the plan’s allowance, what is used and the credits', async () => {
    logs = [todays({}), todays({})];
    balance = { balance: 40, totalPurchased: 100, totalUsed: 60 };
    const status = await aiCredits.getStatus(7, NOW);
    expect(status).toMatchObject({ allowancePerDay: 10, allowanceUsed: 2, allowanceLeft: 8, credits: 40, totalPurchased: 100, canAsk: true, isLimited: false });
    expect(status.weights).toEqual({ question: 1, reminders: 1, report: 5 });
  });

  it('follows the plan', async () => {
    tier = 'ENTERPRISE';
    expect((await aiCredits.getStatus(7, NOW)).allowancePerDay).toBe(100);
    tier = 'PROFESSIONAL';
    expect((await aiCredits.getStatus(7, NOW)).allowancePerDay).toBe(30);
  });

  it('does not count yesterday, which in Lagos ends an hour before UTC midnight', async () => {
    logs = [todays({ createdAt: new Date('2026-10-23T22:59:00.000Z') }), todays({ createdAt: new Date('2026-10-23T23:30:00.000Z') })];
    expect((await aiCredits.getStatus(7, NOW)).allowanceUsed).toBe(1);
  });

  it('says it cannot ask when nothing is left', async () => {
    logs = Array.from({ length: 10 }, () => todays({}));
    const status = await aiCredits.getStatus(7, NOW);
    expect(status.allowanceLeft).toBe(0);
    expect(status.canAsk).toBe(false);
    expect(status.isLimited).toBe(true);
  });
});

describe('paying for a request', () => {
  it('takes the free allowance first and leaves the credits alone', async () => {
    balance = { balance: 50, totalPurchased: 50, totalUsed: 0 };
    const hold = await aiCredits.reserve(7, 1, 'question', 'chat');
    expect(hold).toMatchObject({ units: 1, allowance: 1, credits: 0 });
    expect(balance.balance).toBe(50);
  });

  it('takes credits once the allowance is used up', async () => {
    logs = Array.from({ length: 10 }, () => todays({}));
    balance = { balance: 50, totalPurchased: 50, totalUsed: 0 };
    const hold = await aiCredits.reserve(7, 1, 'question', 'chat');
    expect(hold).toMatchObject({ allowance: 0, credits: 1 });
    expect(balance).toMatchObject({ balance: 49, totalUsed: 1 });
  });

  it('lets a report straddle the two: the rest of the day, then credits', async () => {
    logs = Array.from({ length: 8 }, () => todays({}));
    balance = { balance: 10, totalPurchased: 10, totalUsed: 0 };
    const hold = await aiCredits.reserve(7, 1, 'report', 'report_monthly_summary');
    expect(hold).toMatchObject({ units: 5, allowance: 2, credits: 3 });
    expect(balance.balance).toBe(7);
  });

  it('is refused, with the status, when neither can cover it, and takes nothing', async () => {
    logs = Array.from({ length: 10 }, () => todays({}));
    await expect(aiCredits.reserve(7, 1, 'question', 'chat')).rejects.toBeInstanceOf(RateLimitError);
    await expect(aiCredits.reserve(7, 1, 'question', 'chat')).rejects.toThrow('no credits left');
    expect(balance!.balance).toBe(0);
    expect(logs.filter((l) => l.status === 'pending')).toHaveLength(0);
  });

  it('says how much a report needs when only part of it can be paid', async () => {
    logs = Array.from({ length: 8 }, () => todays({}));
    await expect(aiCredits.reserve(7, 1, 'report', 'report')).rejects.toThrow('needs 5 units and you have 2 left');
  });

  it('counts a request that is still running as used, so two at once cannot both take the last unit', async () => {
    logs = Array.from({ length: 9 }, () => todays({}));
    await aiCredits.reserve(7, 1, 'question', 'chat');
    await expect(aiCredits.reserve(7, 1, 'question', 'chat')).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe('a request that works, and one that fails', () => {
  it('keeps the charge and records the tokens and cost when the model answers', async () => {
    const value = await aiCredits.charged(7, 1, 'question', 'chat', async () => ({ value: 'answer', usage }));
    expect(value).toBe('answer');
    expect(logs[0]).toMatchObject({ status: 'success', tokensInput: 1000, tokensOutput: 200, allowanceUnits: 1 });
  });

  it('gives the credits back when the model fails, and charges nothing', async () => {
    logs = Array.from({ length: 10 }, () => todays({}));
    balance = { balance: 5, totalPurchased: 5, totalUsed: 0 };
    await expect(
      aiCredits.charged(7, 1, 'question', 'chat', async () => {
        throw new Error('OpenRouter is down');
      }),
    ).rejects.toThrow('OpenRouter is down');
    expect(balance).toMatchObject({ balance: 5, totalUsed: 0 });
    expect(logs[logs.length - 1]).toMatchObject({ status: 'error', errorMessage: 'OpenRouter is down' });
  });

  it('gives the allowance back too, because a failed request is not counted as used', async () => {
    await expect(
      aiCredits.charged(7, 1, 'question', 'chat', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect((await aiCredits.getStatus(7, NOW)).allowanceUsed).toBe(0);
  });

  it('gives back what a request lost when the server stopped before it finished', async () => {
    logs = [todays({ status: 'pending', allowanceUnits: 0, creditUnits: 3, createdAt: new Date(NOW.getTime() - 15 * 60_000) })];
    balance = { balance: 2, totalPurchased: 5, totalUsed: 3 };
    await aiCredits.reserve(7, 1, 'question', 'chat');
    expect(balance.balance).toBe(5);
    expect(logs[0].status).toBe('error');
  });
});

describe('crediting a purchase', () => {
  const buy = (over: Partial<Purchase> = {}): Purchase => ({ id: 1, associationId: 7, userId: 1, credits: 150, amount: new Decimal('3000'), reference: 'AIC-1', status: 'pending', ...over });

  it('adds the credits when the payment covers the price', async () => {
    purchases = [buy()];
    const result = await aiCredits.creditPurchase('AIC-1', { amountKobo: 300000, currency: 'NGN' });
    expect(result).toEqual({ credited: true });
    expect(balance).toMatchObject({ balance: 150, totalPurchased: 150 });
    expect(purchases[0].status).toBe('success');
  });

  it('adds them once, however many times it is told', async () => {
    purchases = [buy()];
    await aiCredits.creditPurchase('AIC-1', { amountKobo: 300000, currency: 'NGN' });
    const again = await aiCredits.creditPurchase('AIC-1', { amountKobo: 300000, currency: 'NGN' });
    expect(again).toEqual({ credited: false, reason: 'already' });
    expect(balance!.balance).toBe(150);
  });

  it('adds nothing when the payment falls short, or is in another currency', async () => {
    purchases = [buy()];
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await aiCredits.creditPurchase('AIC-1', { amountKobo: 100000, currency: 'NGN' })).toEqual({ credited: false, reason: 'short' });
    expect(await aiCredits.creditPurchase('AIC-1', { amountKobo: 300000, currency: 'USD' })).toEqual({ credited: false, reason: 'short' });
    quiet.mockRestore();
    expect(balance!.balance).toBe(0);
    expect(purchases[0].status).toBe('pending');
  });

  it('ignores a reference it does not know', async () => {
    expect(await aiCredits.creditPurchase('AIC-NOPE', { amountKobo: 300000, currency: 'NGN' })).toEqual({ credited: false, reason: 'unknown' });
  });
});
