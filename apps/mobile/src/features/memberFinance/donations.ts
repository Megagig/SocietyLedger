import type { Decimal } from 'decimal.js-light';

import { sumMoney } from '@/lib/money';

type DonationAmounts = { amountPaid: Decimal; balance: Decimal; isPledge: boolean };

/**
 * What a member has actually given, and what they have promised but not paid. A pledge is never counted as given until it is paid:
 * "donated" is money paid (including the paid part of a part-paid pledge), "pledged" is what is still owed on pledges.
 */
export function donationTotals(donations: DonationAmounts[]): { donated: Decimal; pledged: Decimal; pledgeCount: number } {
  const pledges = donations.filter((d) => d.isPledge);
  return {
    donated: sumMoney(donations.map((d) => d.amountPaid)),
    pledged: sumMoney(pledges.map((d) => d.balance)),
    pledgeCount: pledges.length,
  };
}
