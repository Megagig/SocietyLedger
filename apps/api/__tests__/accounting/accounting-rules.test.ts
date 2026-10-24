/** The rules of the books: exact amounts, Lagos days, cash flow groups and budget maths. */
import { Decimal } from '@prisma/client/runtime/library';
import {
  AccountingRuleError,
  balanceOf,
  cashFlowGroup,
  cleanEntryLines,
  defaultNormalBalance,
  lagosDayEnd,
  lagosDayKey,
  lagosDayStart,
  periodCovers,
  periodsOverlap,
  proratedBudget,
  toMoney,
  varianceStatus,
} from '../../src/modules/accounting/accounting-rules';

const refusal = (run: () => unknown): AccountingRuleError => {
  try {
    run();
  } catch (error) {
    if (error instanceof AccountingRuleError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
};

describe('toMoney', () => {
  it('keeps whole kobo and refuses anything finer', () => {
    expect(toMoney(1500.5)?.toFixed(2)).toBe('1500.50');
    expect(toMoney(0.1 + 0.2)).toBeNull(); // 0.30000000000000004
    expect(toMoney(10.005)).toBeNull();
    expect(toMoney(undefined)?.toNumber()).toBe(0);
    expect(toMoney(Number.NaN)).toBeNull();
    expect(toMoney(Infinity)).toBeNull();
  });
});

describe('cleanEntryLines', () => {
  const dr = (accountId: number, debitAmount: number) => ({ accountId, debitAmount });
  const cr = (accountId: number, creditAmount: number) => ({ accountId, creditAmount });

  it('accepts a balanced entry and returns exact totals', () => {
    const { lines, total } = cleanEntryLines([dr(1, 1000.1), dr(2, 0.2), cr(3, 1000.3)]);
    expect(total.toFixed(2)).toBe('1000.30');
    expect(lines).toHaveLength(3);
  });

  it('refuses an entry out by a single kobo, which the old check let through', () => {
    const error = refusal(() => cleanEntryLines([dr(1, 1000), cr(2, 999.99)]));
    expect(error.code).toBe('UNBALANCED');
    expect(error.message).toContain('0.01');
  });

  it('refuses a line that is both a debit and a credit, or neither', () => {
    expect(refusal(() => cleanEntryLines([{ accountId: 1, debitAmount: 5, creditAmount: 5 }, cr(2, 5)])).code).toBe('INVALID_LINE');
    expect(refusal(() => cleanEntryLines([{ accountId: 1 }, cr(2, 5)])).code).toBe('INVALID_LINE');
  });

  it('refuses fewer than two lines, only debits, negatives and amounts finer than a kobo', () => {
    expect(refusal(() => cleanEntryLines([dr(1, 5)])).code).toBe('TOO_FEW_LINES');
    expect(refusal(() => cleanEntryLines([dr(1, 5), dr(2, 5)])).code).toBe('UNBALANCED');
    expect(refusal(() => cleanEntryLines([dr(1, -5), cr(2, -5)])).code).toBe('INVALID_AMOUNT');
    expect(refusal(() => cleanEntryLines([dr(1, 10.001), cr(2, 10.001)])).code).toBe('INVALID_AMOUNT');
  });

  it('refuses a total beyond any real entry', () => {
    expect(refusal(() => cleanEntryLines([dr(1, 2e11), cr(2, 2e11)])).code).toBe('INVALID_AMOUNT');
  });

  it('trims line descriptions and clears blank ones', () => {
    const { lines } = cleanEntryLines([{ accountId: 1, debitAmount: 5, description: '  Chairs ' }, { accountId: 2, creditAmount: 5, description: ' ' }]);
    expect(lines.map((l) => l.description)).toEqual(['Chairs', null]);
  });
});

describe('balances', () => {
  it('follows the side an account normally grows on', () => {
    expect(defaultNormalBalance('ASSET')).toBe('DEBIT');
    expect(defaultNormalBalance('EXPENSE')).toBe('DEBIT');
    expect(defaultNormalBalance('INCOME')).toBe('CREDIT');
    expect(defaultNormalBalance('LIABILITY')).toBe('CREDIT');
    expect(defaultNormalBalance('EQUITY')).toBe('CREDIT');
    expect(balanceOf('DEBIT', 100, 30).toNumber()).toBe(70);
    expect(balanceOf('CREDIT', 100, 30).toNumber()).toBe(-70);
  });
});

describe('Lagos days and periods', () => {
  it('puts a late evening UTC moment on the next Lagos day', () => {
    expect(lagosDayKey(new Date('2026-10-31T23:30:00.000Z'))).toBe('2026-11-01');
    expect(lagosDayKey(new Date('2026-10-31T22:59:00.000Z'))).toBe('2026-10-31');
  });

  it('starts a day at 23:00 UTC the evening before and ends it a millisecond before the next', () => {
    expect(lagosDayStart('2026-10-24').toISOString()).toBe('2026-10-23T23:00:00.000Z');
    expect(lagosDayEnd('2026-10-24').toISOString()).toBe('2026-10-24T22:59:59.999Z');
  });

  it('counts the whole last day of a period, even for a period saved to end at midnight', () => {
    const october = { startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') };
    expect(periodCovers(october, new Date('2026-10-31T15:00:00.000Z'))).toBe(true);
    expect(periodCovers(october, new Date('2026-10-31T22:30:00.000Z'))).toBe(true); // 23:30 on the 31st in Lagos
    expect(periodCovers(october, new Date('2026-11-01T00:00:00.000Z'))).toBe(false); // already 01:00 on 1 November in Lagos
    const legacy = { startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2026-10-31T00:00:00.000Z') };
    expect(periodCovers(legacy, new Date('2026-10-31T15:00:00.000Z'))).toBe(true);
    expect(periodCovers(legacy, new Date('2026-11-02T10:00:00.000Z'))).toBe(false);
    expect(periodCovers(legacy, new Date('2026-09-29T10:00:00.000Z'))).toBe(false);
  });

  it('sees periods that share a day as overlapping', () => {
    const a = { startDate: lagosDayStart('2026-10-01'), endDate: lagosDayEnd('2026-10-31') };
    expect(periodsOverlap(a, { startDate: lagosDayStart('2026-10-31'), endDate: lagosDayEnd('2026-11-30') })).toBe(true);
    expect(periodsOverlap(a, { startDate: lagosDayStart('2026-11-01'), endDate: lagosDayEnd('2026-11-30') })).toBe(false);
  });
});

describe('cashFlowGroup', () => {
  it('sorts cash movements by what is on the other side', () => {
    expect(cashFlowGroup([{ type: 'ASSET', subType: 'fixed_asset' }])).toBe('investing');
    expect(cashFlowGroup([{ type: 'LIABILITY', subType: 'long_term_liability' }])).toBe('financing');
    expect(cashFlowGroup([{ type: 'EQUITY', subType: null }])).toBe('financing');
    expect(cashFlowGroup([{ type: 'INCOME', subType: 'operating_income' }])).toBe('operating');
    expect(cashFlowGroup([])).toBe('operating');
  });

  it('looks at every other line, not only the first', () => {
    expect(cashFlowGroup([{ type: 'INCOME', subType: null }, { type: 'ASSET', subType: 'fixed_asset' }])).toBe('investing');
  });
});

describe('budget maths', () => {
  it('calls actual over, under or on track against the plan', () => {
    expect(varianceStatus(1000, 1200)).toBe('over');
    expect(varianceStatus(1000, 850)).toBe('under');
    expect(varianceStatus(1000, 1050)).toBe('on_track');
    expect(varianceStatus(0, 0)).toBe('on_track');
    expect(varianceStatus(0, 10)).toBe('over');
  });

  it('gives a narrower stretch its share of the year, by days', () => {
    const start = lagosDayStart('2026-01-01');
    const end = lagosDayEnd('2026-12-31');
    expect(proratedBudget(365000, start, end, start, end).toNumber()).toBe(365000);
    expect(proratedBudget(365000, start, end, lagosDayStart('2026-01-01'), lagosDayEnd('2026-01-31')).toNumber()).toBe(31000);
    expect(proratedBudget(365000, start, end, lagosDayStart('2025-01-01'), lagosDayEnd('2027-12-31')).toNumber()).toBe(365000);
    expect(proratedBudget(365000, start, end, lagosDayStart('2027-02-01'), lagosDayEnd('2027-02-28')).toNumber()).toBe(0);
    expect(new Decimal(proratedBudget(100, start, end, lagosDayStart('2026-01-01'), lagosDayEnd('2026-01-01'))).toFixed(2)).toBe('0.27');
  });
});
