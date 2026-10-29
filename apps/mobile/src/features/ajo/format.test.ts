import { cadenceWords, formatDay, formatKobo, frequencyText, koboNegative, koboPositive, koboToNaira, nairaToKobo, nairaToKoboString, newIdempotencyKey, ordinal } from './format';

describe('formatKobo', () => {
  it('shows money in full with thousands and two decimals', () => {
    expect(formatKobo('1000000')).toBe('₦10,000.00');
    expect(formatKobo('123456789012')).toBe('₦1,234,567,890.12');
    expect(formatKobo('5')).toBe('₦0.05');
    expect(formatKobo('0')).toBe('₦0.00');
  });
  it('keeps the minus sign on a short difference and survives bad input', () => {
    expect(formatKobo('-250050')).toBe('-₦2,500.50');
    expect(formatKobo(null)).toBe('₦0.00');
    expect(formatKobo('abc')).toBe('₦0.00');
  });
});

describe('koboToNaira / nairaToKobo', () => {
  it('round-trips without float error', () => {
    expect(koboToNaira('1000050')).toBe('10000.50');
    expect(nairaToKobo('10,000.50')?.toString()).toBe('1000050');
    expect(nairaToKoboString('₦ 250')).toBe('25000');
    expect(nairaToKobo('0.1')?.toString()).toBe('10');
  });
  it('refuses anything that is not an amount', () => {
    expect(nairaToKobo('12.345')).toBeNull();
    expect(nairaToKobo('-5')).toBeNull();
    expect(nairaToKobo('')).toBeNull();
    expect(nairaToKobo('ten')).toBeNull();
  });
  it('tells positive from negative', () => {
    expect(koboPositive('1')).toBe(true);
    expect(koboPositive('0')).toBe(false);
    expect(koboNegative('-1')).toBe(true);
    expect(koboNegative('1')).toBe(false);
  });
});

describe('dates and words', () => {
  it('shows an API day as the same calendar day anywhere', () => {
    expect(formatDay('2027-03-01T00:00:00.000Z')).toBe('1 Mar 2027');
    expect(formatDay(null)).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
  it('words the cadence like the server', () => {
    expect(cadenceWords('CUSTOM', 2, 'WEEKS')).toBe('every 2 weeks');
    expect(cadenceWords('CUSTOM', 1, 'MONTHS')).toBe('every month');
    expect(cadenceWords('QUARTERLY', 1, 'DAYS')).toBe('every 3 months');
    expect(frequencyText({ frequency: 'CUSTOM', cadence: 'every 2 weeks' })).toBe('Every 2 weeks');
    expect(frequencyText({ frequency: 'DAILY' })).toBe('Daily');
  });
  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd']);
  });
});

describe('newIdempotencyKey', () => {
  it('makes a different key each time', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(50);
  });
});
