import { Decimal } from '@prisma/client/runtime/library';

/**
 * A donation is either money already given or a pledge (a promise the member still has to pay). Both are a charge in the "donation"
 * category; what tells them apart is how much has been paid against it. The member's donation list uses this so a pledge is never
 * counted, or shown, as money donated.
 */
export interface DonationFigures {
  amount: number;
  amountPaid: number;
  balance: number;
  /** Nothing left to pay. */
  isPaid: boolean;
  /** Still owed, in whole or in part: the member can pay it. */
  isPledge: boolean;
}

export function donationFigures(transaction: { amount: Decimal.Value; payments: { amountPaid: Decimal.Value }[] }): DonationFigures {
  const amount = new Decimal(transaction.amount);
  const paid = transaction.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
  const balance = Decimal.max(amount.minus(paid), 0);
  return {
    amount: amount.toNumber(),
    amountPaid: paid.toNumber(),
    balance: balance.toNumber(),
    isPaid: balance.isZero(),
    isPledge: balance.greaterThan(0),
  };
}
