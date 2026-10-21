import { Decimal, toDecimal } from '@/lib/money';
import type { InterestType, LoanProductDTO } from '@/types/api/loans';

export type LoanEstimate = {
  monthlyRepayment: number;
  totalRepayment: number;
  totalInterest: number;
  processingFee: number;
};

/**
 * Mirrors `calculateLoanRepayment` in apps/api/src/modules/cooperatives/cooperatives.service.ts. This is only the
 * preview shown while applying — the server recalculates on submit and its figures are what the application shows.
 */
export function estimateLoan(principal: number, annualRatePercent: number, tenureMonths: number, interestType: InterestType): Omit<LoanEstimate, 'processingFee'> {
  const monthlyRate = annualRatePercent / 100 / 12;

  if (interestType === 'FLAT') {
    const totalInterest = principal * (annualRatePercent / 100) * (tenureMonths / 12);
    const totalRepayment = principal + totalInterest;
    return { monthlyRepayment: totalRepayment / tenureMonths, totalRepayment, totalInterest };
  }

  if (interestType === 'REDUCING_BALANCE') {
    if (monthlyRate === 0) return { monthlyRepayment: principal / tenureMonths, totalRepayment: principal, totalInterest: 0 };
    const growth = Math.pow(1 + monthlyRate, tenureMonths);
    const monthlyRepayment = (principal * monthlyRate * growth) / (growth - 1);
    const totalRepayment = monthlyRepayment * tenureMonths;
    return { monthlyRepayment, totalRepayment, totalInterest: totalRepayment - principal };
  }

  const totalRepayment = principal * Math.pow(1 + monthlyRate, tenureMonths);
  return { monthlyRepayment: totalRepayment / tenureMonths, totalRepayment, totalInterest: totalRepayment - principal };
}

export function estimateForProduct(product: LoanProductDTO, principal: number, tenureMonths: number): LoanEstimate {
  const base = estimateLoan(principal, Number(product.interestRate), tenureMonths, product.interestType);
  const percentFee = principal * (Number(product.processingFeePercent) / 100);
  return { ...base, processingFee: percentFee + Number(product.processingFeeFixed) };
}

export type BorrowingLimit = { max: Decimal; limitedBySavings: boolean };

/**
 * The most a member can borrow on a product: its own max, or — when the product has a savings multiplier — that
 * multiple of their *available* savings (balance minus held), whichever is lower. Same rule the API enforces.
 */
export function borrowingLimit(product: LoanProductDTO, availableSavings: string | number): BorrowingLimit {
  const productMax = toDecimal(product.maxAmount);
  const ratio = product.maxLoanToSavingsRatio ? toDecimal(product.maxLoanToSavingsRatio) : null;
  if (!ratio || ratio.lessThanOrEqualTo(0)) return { max: productMax, limitedBySavings: false };

  const bySavings = toDecimal(availableSavings).times(ratio).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return bySavings.lessThan(productMax) ? { max: bySavings, limitedBySavings: true } : { max: productMax, limitedBySavings: false };
}

/** Savings that will be held against a loan: principal ÷ multiplier, only for products that hold savings. */
export function heldSavingsFor(product: LoanProductDTO, principal: number): Decimal | null {
  const ratio = product.maxLoanToSavingsRatio ? toDecimal(product.maxLoanToSavingsRatio) : null;
  if (!product.lockSavings || !ratio || ratio.lessThanOrEqualTo(0) || principal <= 0) return null;
  return toDecimal(principal).div(ratio).toDecimalPlaces(2);
}
