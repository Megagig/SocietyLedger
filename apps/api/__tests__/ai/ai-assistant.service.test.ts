/**
 * The assistant: every request is paid for first and refunded if the model fails, the model sees stand-ins and never names, phones or
 * emails, and the officer gets the real names back. The model, the books and the credits are replaced by stand-ins.
 */
import { Decimal } from '@prisma/client/runtime/library';

const chatMock = jest.fn();
jest.mock('../../src/lib/openrouter', () => ({
  __esModule: true,
  default: { chat: (...a: unknown[]) => chatMock(...a) },
  buildFinancialSystemPrompt: () => 'SYSTEM',
}));

const chargedKinds: string[] = [];
let spent = 0;
const SETTINGS = { model: 'deepseek/deepseek-chat', maxOutputTokens: 1500, weights: { question: 1, reminders: 1, report: 5 } };
jest.mock('../../src/modules/ai/ai-credits.service', () => ({
  aiCredits: {
    charged: jest.fn(async (_a: number, _u: number, kind: 'question' | 'reminders' | 'report', _p: string, work: (hold: unknown, s: unknown) => Promise<{ value: unknown }>) => {
      const units = SETTINGS.weights[kind];
      chargedKinds.push(kind);
      try {
        const { value } = await work({ units }, SETTINGS);
        spent += units;
        return value;
      } catch (error) {
        throw error; // nothing is charged for a request that failed
      }
    }),
    getStatus: jest.fn(async () => ({ allowanceLeft: 9, credits: 0 })),
  },
}));

const MEMBERS = [
  { id: 14, firstName: 'Ada', lastName: 'Obi' },
  { id: 15, firstName: 'Bola', lastName: 'Adeyemi' },
];
const buildFiguresMock = jest.fn();
jest.mock('../../src/modules/ai/ai-context', () => ({
  loadMemberNames: jest.fn(async () => MEMBERS),
  buildFigures: (...a: unknown[]) => buildFiguresMock(...a),
  naira: (v: Decimal.Value) => `₦${new Decimal(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
}));

const agingMock = jest.fn();
jest.mock('../../src/modules/reports/reports-core.service', () => ({
  generateAgingAnalysis: (...a: unknown[]) => agingMock(...a),
  chargeWhere: () => ({ isVoided: false }),
}));
const prismaMock: any = { association: { findUnique: jest.fn() }, transaction: { findMany: jest.fn() } };
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

import { assistantService, fillTemplate, readTemplates } from '../../src/modules/ai/ai-assistant.service';
import { Pseudonymizer } from '../../src/modules/ai/ai-privacy';
import { RateLimitError } from '../../src/modules/ai/tools/rate-limiter';

const answer = (content: string) => ({ content, model: 'deepseek/deepseek-chat', tokensUsed: { input: 1200, output: 150, total: 1350 }, finishReason: 'stop', costUsd: 0.001 });
const sentToModel = () => JSON.stringify(chatMock.mock.calls.map((c) => c[0]));

beforeEach(() => {
  jest.clearAllMocks();
  chargedKinds.length = 0;
  spent = 0;
  prismaMock.association.findUnique.mockResolvedValue({ name: 'Oko Youth Forum' });
  buildFiguresMock.mockImplementation((_id: number, options: { pseudo?: Pseudonymizer } = {}) => {
    const pseudo = options.pseudo ?? new Pseudonymizer();
    const bola = pseudo.alias(15, 'Bola Adeyemi');
    return Promise.resolve({
      prompt: `FIGURES\n- ${bola}: ₦45,000.00 owed`,
      tables: [{ id: 'owing', title: 'Who owes the most', columns: ['Member', 'Owes'], rows: [['Bola Adeyemi', '₦45,000.00']] }],
      pseudo,
      periodLabel: 'This month',
      confidence: 'high',
      dataUsed: [{ type: 'financial_summary', summary: 'Received ₦100.00' }],
    });
  });
});

describe('asking a question', () => {
  it('costs one unit, and the model sees stand-ins, never a name, a phone or an email', async () => {
    chatMock.mockResolvedValue(answer('Member 2 owes the most: ₦45,000.00.'));
    await assistantService.ask(7, 1, { question: 'Who owes the most? Is Ada Obi (ada@x.ng, 08031234567) fine?' });
    expect(chargedKinds).toEqual(['question']);
    expect(spent).toBe(1);
    const prompt = sentToModel();
    expect(prompt).not.toMatch(/Ada Obi|Bola Adeyemi|ada@x\.ng|08031234567/);
    expect(prompt).toContain('Member 1');
    expect(prompt).toContain('[email removed]');
  });

  it('gives the officer the real names back, and the figures as tables with real names', async () => {
    chatMock.mockResolvedValue(answer('Member 2 owes the most: ₦45,000.00.'));
    const result = await assistantService.ask(7, 1, { question: 'Who owes the most? Compare with Ada Obi' });
    expect(result.answer).toBe('Bola Adeyemi owes the most: ₦45,000.00.');
    expect(result.tables[0].rows[0][0]).toBe('Bola Adeyemi');
    expect(result.units).toBe(1);
    expect(result.usage).toMatchObject({ allowanceLeft: 9 });
  });

  it('uses the model and the answer length from the platform settings', async () => {
    chatMock.mockResolvedValue(answer('ok fine'));
    await assistantService.ask(7, 1, { question: 'How are we doing?' });
    expect(chatMock.mock.calls[0][1]).toMatchObject({ model: 'deepseek/deepseek-chat', maxTokens: 1500 });
  });

  it('keeps earlier turns, made safe the same way, and no more than the last six', async () => {
    chatMock.mockResolvedValue(answer('ok fine'));
    const history = Array.from({ length: 8 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `turn ${i} about Ada Obi` }));
    await assistantService.ask(7, 1, { question: 'And last month?', history, period: 'last_month' });
    const messages = chatMock.mock.calls[0][0] as { role: string; content: string }[];
    expect(messages.filter((m) => m.role !== 'system').length).toBe(7); // six turns and the question
    expect(JSON.stringify(messages)).not.toMatch(/Ada Obi/);
    expect(buildFiguresMock.mock.calls[0][1].range).toEqual({ period: 'last_month' });
  });

  it('works out the figures for the members named, under their stand-ins', async () => {
    chatMock.mockResolvedValue(answer('Member 1 owes nothing.'));
    await assistantService.ask(7, 1, { question: 'What does Ada Obi owe?' });
    expect(buildFiguresMock.mock.calls[0][1].asked).toEqual([14]);
  });

  it('costs nothing when the model fails', async () => {
    chatMock.mockRejectedValue(new Error('OpenRouter API error: down'));
    await expect(assistantService.ask(7, 1, { question: 'How are we doing?' })).rejects.toThrow('OpenRouter');
    expect(spent).toBe(0);
  });
});

describe('a report', () => {
  it('costs five units and gives the names back', async () => {
    chatMock.mockResolvedValue(answer('TITLE: October\nSUMMARY: Member 1 owes the most.\nSECTION: Money\nAll good.\nHIGHLIGHTS:\n- Member 1 owes ₦45,000.00'));
    const report = await assistantService.report(7, 1, { reportType: 'monthly_summary', includeRecommendations: false });
    expect(chargedKinds).toEqual(['report']);
    expect(spent).toBe(5);
    expect(report.title).toBe('October');
    expect(report.summary).toBe('Bola Adeyemi owes the most.');
    expect(report.period).toBe('This month');
    expect(sentToModel()).not.toMatch(/Bola Adeyemi/);
  });

  it('asks for the quarter or the year when the report is for one', async () => {
    chatMock.mockResolvedValue(answer('TITLE: Q'));
    await assistantService.report(7, 1, { reportType: 'quarterly_review' });
    expect(buildFiguresMock.mock.calls[0][1].range).toEqual({ period: 'this_quarter' });
    await assistantService.report(7, 1, { reportType: 'annual_report' });
    expect(buildFiguresMock.mock.calls[1][1].range).toEqual({ period: 'this_year' });
  });
});

describe('smart reminders', () => {
  const bucket = (members: { memberId: number; memberName: string; amount: number; daysOverdue: number }[]) => ({ members: members.map((m) => ({ ...m, amount: new Decimal(m.amount), oldestDueDate: new Date() })) });
  beforeEach(() => {
    const empty = bucket([]);
    agingMock.mockResolvedValue({
      buckets: {
        notYetDue: empty,
        current: bucket([{ memberId: 14, memberName: 'Ada Obi', amount: 20000, daysOverdue: 12 }]),
        days31to60: bucket([{ memberId: 15, memberName: 'Bola Adeyemi', amount: 45000, daysOverdue: 40 }]),
        days61to90: empty,
        over90: bucket([{ memberId: 14, memberName: 'Ada Obi', amount: 5000, daysOverdue: 120 }]),
      },
    });
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 501, memberId: 14 }, { id: 502, memberId: 15 }, { id: 503, memberId: 14 }]);
  });

  const templates = JSON.stringify({
    friendly: 'Dear {name}, a gentle reminder: you owe {amount} to {association}. Kindly pay soon. Thank you.',
    formal: 'Dear {name}, your {amount} is {days} days overdue to {association}. Please settle it. Thank you.',
    urgent: 'Dear {name}, {amount} is long overdue to {association}. Please pay today. Thank you.',
  });

  it('makes one request for all the members, and the model sees no member at all', async () => {
    chatMock.mockResolvedValue(answer(templates));
    await assistantService.reminders(7, 1, {});
    expect(chatMock).toHaveBeenCalledTimes(1);
    expect(chargedKinds).toEqual(['reminders']);
    expect(spent).toBe(1);
    expect(sentToModel()).not.toMatch(/Ada Obi|Bola|45,000|20000/);
  });

  it('fills each member’s own name, amount and days into the right tone, biggest debt first', async () => {
    chatMock.mockResolvedValue(answer(templates));
    const result = await assistantService.reminders(7, 1, {});
    expect(result.suggestions.map((s) => s.memberName)).toEqual(['Bola Adeyemi', 'Ada Obi']);
    const [bola, ada] = result.suggestions;
    expect(bola.suggestedTone).toBe('formal');
    expect(bola.suggestedMessage).toBe('Dear Bola Adeyemi, your ₦45,000.00 is 40 days overdue to Oko Youth Forum. Please settle it. Thank you.');
    // Ada's two buckets add up, and her oldest charge sets the tone
    expect(ada.outstandingAmount.toString()).toBe('25000');
    expect(ada.daysOverdue).toBe(120);
    expect(ada.suggestedTone).toBe('urgent');
    expect(ada.transactionIds).toEqual([501, 503]);
    expect(result.totalOwingMembers).toBe(2);
    expect(result.totalOutstanding.toString()).toBe('70000');
    expect(result.aiWritten).toBe(true);
  });

  it('still gives the list, in the built-in words and at no cost, when the model is down', async () => {
    chatMock.mockRejectedValue(new Error('OpenRouter API error: down'));
    const result = await assistantService.reminders(7, 1, {});
    expect(result.suggestions).toHaveLength(2);
    expect(result.aiWritten).toBe(false);
    expect(result.suggestions[0].suggestedMessage).toContain('Bola Adeyemi');
    expect(spent).toBe(0);
  });

  it('is refused, not hidden behind the built-in words, when there is nothing left to pay with', async () => {
    const { aiCredits } = jest.requireMock('../../src/modules/ai/ai-credits.service');
    aiCredits.charged.mockRejectedValueOnce(new RateLimitError('No credits left', {} as never));
    await expect(assistantService.reminders(7, 1, {})).rejects.toBeInstanceOf(RateLimitError);
  });

  it('skips members outside the days asked for, and honours the limit', async () => {
    chatMock.mockResolvedValue(answer(templates));
    expect((await assistantService.reminders(7, 1, { minDaysOverdue: 100 })).suggestions.map((s) => s.memberName)).toEqual(['Ada Obi']);
    expect((await assistantService.reminders(7, 1, { limit: 1 })).suggestions).toHaveLength(1);
  });

  it('costs nothing when nobody is overdue', async () => {
    agingMock.mockResolvedValue({ buckets: { notYetDue: bucket([]), current: bucket([]), days31to60: bucket([]), days61to90: bucket([]), over90: bucket([]) } });
    const result = await assistantService.reminders(7, 1, {});
    expect(result.suggestions).toEqual([]);
    expect(chatMock).not.toHaveBeenCalled();
    expect(spent).toBe(0);
  });
});

describe('the reminder templates', () => {
  it('fill in a member’s own words', () => {
    expect(fillTemplate('Dear {name}, {amount} for {days} days at {association}.', { name: 'Ada', amount: '₦1.00', days: 3, association: 'Oko' })).toBe('Dear Ada, ₦1.00 for 3 days at Oko.');
  });

  it('are kept only when they still have their name and amount, otherwise the built-in words are used', () => {
    const good = 'Dear {name}, you owe {amount}. Please pay at your earliest convenience.';
    const read = readTemplates(JSON.stringify({ friendly: good, formal: 'Please pay soon, thanks a lot.', urgent: 'x' }));
    expect(read.templates.friendly).toBe(good);
    expect(read.templates.formal).toContain('{name}'); // fell back
    expect(read.fromModel).toBe(1);
  });

  it('survive the model wrapping its answer in text or code fences, and refuse nonsense', () => {
    const good = 'Dear {name}, you owe {amount}. Please pay at your earliest convenience.';
    const fenced = '```json\n' + JSON.stringify({ friendly: good, formal: good, urgent: good }) + '\n```';
    expect(readTemplates(fenced).fromModel).toBe(3);
    expect(readTemplates('I cannot do that').fromModel).toBe(0);
    expect(readTemplates('{ not json }').fromModel).toBe(0);
  });
});
