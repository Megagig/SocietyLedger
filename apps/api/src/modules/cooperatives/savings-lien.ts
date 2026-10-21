import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

/**
 * Savings-to-loan rule. Each cooperative sets, per loan product, how much a member must have saved to
 * borrow (`maxLoanToSavingsRatio`: 2 means "up to twice your savings"). When `lockSavings` is on,
 * disbursing a loan holds `principal / ratio` of the member's savings until the loan is repaid. The balance
 * is never debited — the money is held, not spent — so what a member can touch is:
 *
 *   available = balance of their active savings accounts − outstanding liens
 */

type Db = Prisma.TransactionClient;

export interface SavingsPosition {
  balance: Decimal;
  locked: Decimal;
  available: Decimal;
}

interface RuleProduct {
  maxLoanToSavingsRatio: Decimal | null;
  lockSavings: boolean;
}

/** How much savings a loan of `principal` holds: principal / ratio (0 when the product doesn't lock). */
export function lienAmountFor(principal: Decimal.Value, product: RuleProduct): Decimal {
  if (!product.lockSavings || !product.maxLoanToSavingsRatio || new Decimal(product.maxLoanToSavingsRatio).lte(0)) {
    return new Decimal(0);
  }
  return new Decimal(principal).div(product.maxLoanToSavingsRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** The most a member can borrow on a product given their available savings (null = the product has no savings rule). */
export function maxBorrowableOnProduct(available: Decimal.Value, product: RuleProduct): Decimal | null {
  if (!product.maxLoanToSavingsRatio || new Decimal(product.maxLoanToSavingsRatio).lte(0)) return null;
  return new Decimal(available).times(product.maxLoanToSavingsRatio).toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/** What a repayment releases: the share of the lien matching the share of principal repaid, all of it once paid off. */
export function releaseAmountFor(
  lien: { amount: Decimal; releasedAmount: Decimal },
  principalRepaidNow: Decimal.Value,
  loanPrincipal: Decimal.Value,
  isPaidOff: boolean
): Decimal {
  const remaining = lien.amount.minus(lien.releasedAmount);
  if (remaining.lte(0)) return new Decimal(0);
  if (isPaidOff) return remaining;
  if (new Decimal(loanPrincipal).lte(0)) return new Decimal(0);
  const share = lien.amount.times(principalRepaidNow).div(loanPrincipal).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return Decimal.min(share, remaining);
}

export async function getSavingsPosition(db: Db, associationId: number, memberId: number): Promise<SavingsPosition> {
  const [accounts, liens] = await Promise.all([
    db.savingsAccount.aggregate({
      where: { memberId, associationId, status: 'ACTIVE' },
      _sum: { balance: true },
    }),
    db.savingsLien.findMany({
      where: { memberId, associationId, status: 'ACTIVE' },
      select: { amount: true, releasedAmount: true },
    }),
  ]);

  const balance = accounts._sum.balance ?? new Decimal(0);
  const locked = liens.reduce((sum, l) => sum.plus(l.amount).minus(l.releasedAmount), new Decimal(0));
  return { balance, locked, available: Decimal.max(balance.minus(locked), 0) };
}

const naira = (value: Decimal.Value) => `₦${new Decimal(value).toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * Throws unless `amount` is within what the product's savings rule allows given the member's available
 * savings. Run at apply, approve and disburse, so a stale application can't bypass it.
 */
export async function assertWithinSavingsRule(
  db: Db,
  associationId: number,
  memberId: number,
  product: RuleProduct & { name?: string },
  amount: Decimal.Value
): Promise<SavingsPosition> {
  const position = await getSavingsPosition(db, associationId, memberId);
  const max = maxBorrowableOnProduct(position.available, product);

  if (max !== null && new Decimal(amount).gt(max)) {
    const held = position.locked.gt(0) ? `, ${naira(position.locked)} of your savings is held against another loan` : '';
    throw new Error(
      `This cooperative lets you borrow up to ${new Decimal(product.maxLoanToSavingsRatio!).toNumber()}× your available savings. ` +
        `You can borrow up to ${naira(max)} (available savings ${naira(position.available)}${held}).`
    );
  }
  return position;
}

/** Put principal/ratio of the member's savings on hold for a freshly disbursed loan. No-op when the product doesn't lock. */
export async function createLienForLoan(
  db: Db,
  args: { associationId: number; memberId: number; loanId: number; principal: Decimal.Value; product: RuleProduct }
) {
  const amount = lienAmountFor(args.principal, args.product);
  if (amount.lte(0)) return null;
  return db.savingsLien.create({
    data: { associationId: args.associationId, memberId: args.memberId, loanId: args.loanId, amount },
  });
}

/** Release the matching share of a loan's lien after a repayment; closes the lien once nothing is held. */
export async function releaseLienForRepayment(
  db: Db,
  args: { loanId: number; principalRepaidNow: Decimal.Value; loanPrincipal: Decimal.Value; isPaidOff: boolean }
) {
  const lien = await db.savingsLien.findUnique({ where: { loanId: args.loanId } });
  if (!lien || lien.status !== 'ACTIVE') return null;

  const release = releaseAmountFor(lien, args.principalRepaidNow, args.loanPrincipal, args.isPaidOff);
  if (release.lte(0)) return lien;

  const releasedAmount = lien.releasedAmount.plus(release);
  const fullyReleased = releasedAmount.gte(lien.amount);
  return db.savingsLien.update({
    where: { loanId: args.loanId },
    data: { releasedAmount, status: fullyReleased ? 'RELEASED' : 'ACTIVE' },
  });
}
