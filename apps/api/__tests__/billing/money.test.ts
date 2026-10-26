import {
  addMonthsUtc,
  addonProrationKobo,
  creditKobo,
  cycleDaysLeft,
  formatNaira,
  nairaToKobo,
  periodDays,
  periodEndFor,
  prorateKobo,
} from '../../src/services/billing/money';

describe('billing money', () => {
  it('converts naira to whole kobo without float drift', () => {
    expect(nairaToKobo(10000)).toBe(1_000_000);
    expect(nairaToKobo('12345.67')).toBe(1_234_567);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
  });

  it('formats amounts in full with the naira sign', () => {
    expect(formatNaira(1_000_000)).toBe('₦10,000.00');
    expect(formatNaira(15_000_000)).toBe('₦150,000.00');
    expect(formatNaira(5)).toBe('₦0.05');
    expect(formatNaira(0)).toBe('₦0.00');
  });
});

describe('period maths', () => {
  it('clamps month ends instead of rolling into the next month', () => {
    expect(addMonthsUtc(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonthsUtc(new Date('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z');
    expect(addMonthsUtc(new Date('2026-10-15T00:00:00Z'), 12).toISOString()).toBe('2027-10-15T00:00:00.000Z');
  });

  it('sets a monthly and an annual period end', () => {
    const start = new Date('2026-03-10T00:00:00Z');
    expect(periodEndFor(start, 'MONTHLY').toISOString()).toBe('2026-04-10T00:00:00.000Z');
    expect(periodEndFor(start, 'ANNUAL').toISOString()).toBe('2027-03-10T00:00:00.000Z');
  });

  it('counts whole days left in the period', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T00:00:00Z'); // 30 days
    expect(periodDays(start, end, new Date('2026-01-01T00:00:00Z'))).toEqual({ totalDays: 30, remainingDays: 30 });
    expect(periodDays(start, end, new Date('2026-01-21T00:00:00Z'))).toEqual({ totalDays: 30, remainingDays: 10 });
    // part of a day left still counts as a day
    expect(periodDays(start, end, new Date('2026-01-30T12:00:00Z'))).toEqual({ totalDays: 30, remainingDays: 1 });
    expect(periodDays(start, end, new Date('2026-02-05T00:00:00Z'))).toEqual({ totalDays: 30, remainingDays: 0 });
  });
});

describe('proration', () => {
  it('charges price x remaining / total rounded up to the kobo', () => {
    expect(prorateKobo(1_000_000, 15, 30)).toBe(500_000);
    expect(prorateKobo(1_000_000, 10, 30)).toBe(333_334); // 333,333.33 -> up
    expect(prorateKobo(1_000_000, 30, 30)).toBe(1_000_000);
  });

  it('never charges more than the full price or less than nothing', () => {
    expect(prorateKobo(1_000_000, 45, 30)).toBe(1_000_000);
    expect(prorateKobo(1_000_000, 0, 30)).toBe(0);
    expect(prorateKobo(0, 10, 30)).toBe(0);
  });

  it('credits the unused part rounded down, so a credit cannot exceed what was paid', () => {
    expect(creditKobo(1_000_000, 10, 30)).toBe(333_333);
    expect(creditKobo(1_000_000, 30, 30)).toBe(1_000_000);
    expect(creditKobo(1_000_000, 0, 30)).toBe(0);
  });

  it('prorates an add-on against the cycle ending on the plan renewal date', () => {
    const end = new Date('2026-04-10T00:00:00Z'); // the monthly cycle is 10 Mar -> 10 Apr = 31 days
    expect(cycleDaysLeft(end, 'MONTHLY', new Date('2026-04-10T00:00:00Z'))).toEqual({ remainingDays: 0, totalDays: 31 });
    expect(addonProrationKobo(310_000, end, 'MONTHLY', new Date('2026-03-10T00:00:00Z'))).toBe(310_000); // a full cycle left
    expect(addonProrationKobo(310_000, end, 'MONTHLY', new Date('2026-03-26T00:00:00Z'))).toBe(150_000); // 15 of 31 days
    expect(addonProrationKobo(310_000, end, 'MONTHLY', new Date('2026-04-10T00:00:00Z'))).toBe(0);
  });

  it('charges more than one cycle for an add-on riding on an extended period', () => {
    const end = new Date('2026-05-10T00:00:00Z'); // plan renewed early: 61 days remain, cycle is 30 days (10 Apr -> 10 May)
    const now = new Date('2026-03-10T00:00:00Z');
    expect(addonProrationKobo(300_000, end, 'MONTHLY', now)).toBe(Math.ceil((300_000 * 61) / 30));
  });

  it('charge and credit for the same days never add up to more than the price', () => {
    for (const days of [1, 7, 13, 29]) {
      const charge = prorateKobo(999_999, days, 30);
      const credit = creditKobo(999_999, 30 - days, 30);
      expect(charge + credit).toBeGreaterThanOrEqual(999_999);
      expect(charge + credit).toBeLessThanOrEqual(1_000_000);
    }
  });
});
