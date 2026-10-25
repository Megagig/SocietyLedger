import { ApiError } from '@/api/errors';
import { aiErrorMessage, allowanceLine, canAfford, costWords, isOutOfRequests, packsFor, priceOf } from './labels';
import { historyFor, type ChatMessage } from './history';
import { waitForCredit } from './purchase';
import { reportShareText } from './reportText';

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), setObject: jest.fn(), remove: jest.fn() }));

const status = { allowanceLeft: 7, credits: 80, allowancePerDay: 10, weights: { question: 1, reminders: 1, report: 5 }, creditPriceNaira: 20, minimumCredits: 150 };

describe('what is left', () => {
  it('reads "7 left today · 80 credits", leaving out what does not apply', () => {
    expect(allowanceLine(status)).toBe('7 left today · 80 credits');
    expect(allowanceLine({ ...status, credits: 0 })).toBe('7 left today');
    expect(allowanceLine({ allowanceLeft: 0, allowancePerDay: 10, credits: 0 })).toBe('0 left today');
    expect(allowanceLine({ allowanceLeft: 0, allowancePerDay: 0, credits: 1 })).toBe('1 credit');
  });

  it('knows whether a report can be paid for, free requests and credits together', () => {
    expect(canAfford(status, 'report')).toBe(true);
    expect(canAfford({ ...status, allowanceLeft: 2, credits: 2 }, 'report')).toBe(false);
    expect(canAfford({ ...status, allowanceLeft: 2, credits: 3 }, 'report')).toBe(true);
  });

  it('writes costs and prices in full', () => {
    expect(costWords(1)).toBe('1 request');
    expect(costWords(5)).toBe('5 requests');
    expect(priceOf(150, status)).toBe('₦3,000.00');
    expect(packsFor(status)).toEqual([150, 300, 600, 1500]);
  });
});

describe('why a request failed', () => {
  it('speaks plainly and recognises running out', () => {
    const out = new ApiError({ status: 429, code: 'AI_ALLOWANCE_EXHAUSTED', message: 'x' });
    expect(isOutOfRequests(out)).toBe(true);
    expect(aiErrorMessage(out)).toMatch(/Buy credits/);
    expect(aiErrorMessage(new ApiError({ status: 503, message: 'x' }))).toMatch(/Nothing was used/);
    expect(aiErrorMessage(new ApiError({ status: 400, message: 'Too long' }))).toBe('Too long');
    expect(isOutOfRequests(new Error('x'))).toBe(false);
  });
});

describe('the conversation sent with a follow-up', () => {
  it('keeps the last six turns, without failures', () => {
    const at = '2026-10-26T00:00:00Z';
    const messages: ChatMessage[] = Array.from({ length: 9 }, (_, i) => ({ id: String(i), role: i % 2 ? 'assistant' : 'user', content: `turn ${i}`, at }));
    messages.push({ id: 'f', role: 'assistant', content: 'broke', failed: true, at });
    const sent = historyFor(messages);
    expect(sent).toHaveLength(6);
    expect(sent.map((t) => t.content)).toEqual(['turn 3', 'turn 4', 'turn 5', 'turn 6', 'turn 7', 'turn 8']);
  });
});

describe('waiting for credits after paying', () => {
  const sleep = jest.fn(async () => undefined);
  beforeEach(() => sleep.mockClear());

  it('stops as soon as the credits are in', async () => {
    const verify = jest.fn().mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: 'success' });
    expect(await waitForCredit(verify, { sleep })).toBe('success');
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it('stops on a failed payment, and keeps trying through errors', async () => {
    expect(await waitForCredit(jest.fn().mockResolvedValue({ status: 'failed' }), { sleep })).toBe('failed');
    const verify = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ status: 'success' });
    expect(await waitForCredit(verify, { sleep })).toBe('success');
  });

  it('gives up as pending after every try', async () => {
    const verify = jest.fn().mockResolvedValue({ status: 'pending' });
    expect(await waitForCredit(verify, { tries: 3, sleep })).toBe('pending');
    expect(verify).toHaveBeenCalledTimes(3);
  });
});

describe('a report to share', () => {
  it('has the title, sections, highlights and a reminder to check the figures', () => {
    const text = reportShareText({ title: 'October', summary: 'Good month.', sections: [{ heading: 'Money', content: 'Received ₦100.00' }], highlights: ['Up'], recommendations: ['Chase dues'], generatedAt: '', period: 'This month', units: 5, usage: {} as never }, 'Oko Youth');
    expect(text).toContain('Oko Youth · This month');
    expect(text).toContain('MONEY\nReceived ₦100.00');
    expect(text).toContain('• Chase dues');
    expect(text).toMatch(/check the figures/);
  });
});
