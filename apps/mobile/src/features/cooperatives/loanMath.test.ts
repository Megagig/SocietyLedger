import type { LoanProductDTO } from '@/types/api/loans';
import { borrowingLimit, estimateForProduct, estimateLoan, heldSavingsFor } from './loanMath';

const product = (overrides: Partial<LoanProductDTO> = {}): LoanProductDTO => ({
  id: 1,
  name: 'Standard',
  description: null,
  minAmount: '10000',
  maxAmount: '500000',
  interestRate: '12',
  interestType: 'FLAT',
  minTenureMonths: 1,
  maxTenureMonths: 24,
  processingFeePercent: '1',
  processingFeeFixed: '0',
  requiresGuarantor: false,
  minGuarantors: 0,
  maxLoanToSavingsRatio: null,
  lockSavings: false,
  isActive: true,
  ...overrides,
});

describe('estimateLoan', () => {
  it('flat: interest on the original principal, spread evenly', () => {
    const e = estimateLoan(100_000, 12, 12, 'FLAT');
    expect(e.totalInterest).toBeCloseTo(12_000);
    expect(e.totalRepayment).toBeCloseTo(112_000);
    expect(e.monthlyRepayment).toBeCloseTo(112_000 / 12);
  });

  it('reducing balance: EMI formula, and zero rate is just principal / tenure', () => {
    const e = estimateLoan(100_000, 12, 12, 'REDUCING_BALANCE');
    expect(e.monthlyRepayment).toBeCloseTo(8884.88, 1);
    expect(e.totalInterest).toBeCloseTo(e.totalRepayment - 100_000);
    expect(estimateLoan(120_000, 0, 12, 'REDUCING_BALANCE')).toEqual({ monthlyRepayment: 10_000, totalRepayment: 120_000, totalInterest: 0 });
  });

  it('adds percent and fixed processing fees', () => {
    expect(estimateForProduct(product({ processingFeePercent: '2', processingFeeFixed: '500' }), 100_000, 12).processingFee).toBe(2_500);
  });
});

describe('borrowingLimit', () => {
  it('is the product max when there is no savings rule', () => {
    const { max, limitedBySavings } = borrowingLimit(product(), '10');
    expect(max.toString()).toBe('500000');
    expect(limitedBySavings).toBe(false);
  });

  it('is multiplier × available savings when that is lower', () => {
    const { max, limitedBySavings } = borrowingLimit(product({ maxLoanToSavingsRatio: '2.00' }), '100000');
    expect(max.toString()).toBe('200000');
    expect(limitedBySavings).toBe(true);
  });

  it('falls back to the product max when savings allow more', () => {
    const { max, limitedBySavings } = borrowingLimit(product({ maxLoanToSavingsRatio: '2' }), '1000000');
    expect(max.toString()).toBe('500000');
    expect(limitedBySavings).toBe(false);
  });

  it('rounds the savings-based limit down to the kobo', () => {
    expect(borrowingLimit(product({ maxLoanToSavingsRatio: '2.5' }), '100.333').max.toString()).toBe('250.83');
  });
});

describe('heldSavingsFor', () => {
  it('is principal ÷ multiplier for products that hold savings', () => {
    expect(heldSavingsFor(product({ maxLoanToSavingsRatio: '2', lockSavings: true }), 200_000)?.toString()).toBe('100000');
  });

  it('is null without the hold switch, a multiplier, or an amount', () => {
    expect(heldSavingsFor(product({ maxLoanToSavingsRatio: '2', lockSavings: false }), 200_000)).toBeNull();
    expect(heldSavingsFor(product({ lockSavings: true }), 200_000)).toBeNull();
    expect(heldSavingsFor(product({ maxLoanToSavingsRatio: '2', lockSavings: true }), 0)).toBeNull();
  });
});
