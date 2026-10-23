import { toDecimal } from '@/lib/money';
import { donationTotals } from './donations';

const d = (amountPaid: number, balance: number, isPledge: boolean) => ({ amountPaid: toDecimal(amountPaid), balance: toDecimal(balance), isPledge });

describe('donationTotals', () => {
  it('does not count an unpaid pledge as donated', () => {
    const totals = donationTotals([d(0, 100000, true)]);
    expect(totals.donated.toNumber()).toBe(0);
    expect(totals.pledged.toNumber()).toBe(100000);
    expect(totals.pledgeCount).toBe(1);
  });

  it('counts what was paid, including the paid part of a part-paid pledge', () => {
    const totals = donationTotals([d(5000, 0, false), d(30000, 70000, true)]);
    expect(totals.donated.toNumber()).toBe(35000);
    expect(totals.pledged.toNumber()).toBe(70000);
  });

  it('is zero for no donations', () => {
    const totals = donationTotals([]);
    expect(totals.donated.toNumber()).toBe(0);
    expect(totals.pledged.toNumber()).toBe(0);
    expect(totals.pledgeCount).toBe(0);
  });
});
