import { Decimal, formatMoney, sumMoney, toDecimal } from './money';

describe('toDecimal', () => {
  it('converts a number', () => {
    expect(toDecimal(25000).toString()).toBe('25000');
  });

  it('converts a string (as Decimal fields arrive from the API)', () => {
    expect(toDecimal('1234.5').toString()).toBe('1234.5');
  });

  it('passes an existing Decimal through unchanged', () => {
    const existing = new Decimal('10.5');
    expect(toDecimal(existing)).toBe(existing);
  });
});

describe('sumMoney', () => {
  it('sums a list of mixed string/number values without float rounding error', () => {
    expect(sumMoney([0.1, 0.2, '0.3']).toString()).toBe('0.6');
  });

  it('returns zero for an empty list', () => {
    expect(sumMoney([]).toString()).toBe('0');
  });
});

describe('formatMoney', () => {
  it('formats a whole naira amount with thousands separators and 2 decimals', () => {
    expect(formatMoney(25000)).toBe('₦25,000.00');
  });

  it('formats a string amount (as Decimal fields arrive from the API)', () => {
    expect(formatMoney('1234567.5')).toBe('₦1,234,567.50');
  });

  it('formats a Decimal instance directly', () => {
    expect(formatMoney(new Decimal('500'))).toBe('₦500.00');
  });

  it('never uses float arithmetic that could round incorrectly (code-standards.md §11)', () => {
    expect(formatMoney('0.1')).toBe('₦0.10');
    expect(formatMoney(10.1)).toBe('₦10.10');
  });

  it('formats a value under 1,000 with no separator needed', () => {
    expect(formatMoney(500)).toBe('₦500.00');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('₦0.00');
  });

  it('renders negative values with the word context, not a literal minus sign', () => {
    expect(formatMoney(-2000)).toBe('Credit ₦2,000.00');
  });

  it('honours a custom credit label', () => {
    expect(formatMoney(-500, { creditLabel: 'Refund' })).toBe('Refund ₦500.00');
  });

  describe('never abbreviates', () => {
    it('writes thousands and millions out in full', () => {
      expect(formatMoney(10000)).toBe('₦10,000.00');
      expect(formatMoney(25000)).toBe('₦25,000.00');
      expect(formatMoney(1200000)).toBe('₦1,200,000.00');
      expect(formatMoney(5000000)).toBe('₦5,000,000.00');
    });

    it('writes a credit out in full too', () => {
      expect(formatMoney(-1200000)).toBe('Credit ₦1,200,000.00');
    });
  });
});
