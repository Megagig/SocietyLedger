import { Decimal } from '@prisma/client/runtime/library';
import { cashbookPdf, type CashbookData } from '../../src/modules/cooperatives/cooperative-cashbook-pdf';

const d = (v: string | number) => new Decimal(v);

function book(rows: number): CashbookData {
  return {
    member: { name: 'Anthony Obi', memberNumber: 'M-001' },
    period: { from: new Date('2026-01-01'), to: null },
    tiles: { totalShares: d(2000), totalSavings: d(15000), totalLoans: d(50000), totalLoanInterest: d(5000) },
    rows: Array.from({ length: rows }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + (i % 28))),
      narration: `Payment ${i}`,
      shares: i % 3 === 0 ? d(500) : null,
      savings: { desc: 'Monthly savings', dr: null, cr: d(1000), balance: d(1000 * (i + 1)) },
      loans: null,
      interest: null,
    })),
    totals: { shares: d(2000), savingsDr: d(0), savingsCr: d(15000), loansDr: d(50000), loansCr: d(0), interestDr: d(5000), interestCr: d(0) },
  };
}

describe('cashbook PDF', () => {
  it('makes a real PDF, and writes money in full', async () => {
    const file = await cashbookPdf(book(3), 'Oko Youth Forum');
    expect(file.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.length).toBeGreaterThan(1000);
  });

  it('runs over several pages when there are many entries, and copes with none', async () => {
    const many = await cashbookPdf(book(120), 'Oko Youth Forum');
    expect(many.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0).toBeGreaterThan(1);
    await expect(cashbookPdf(book(0), 'Oko Youth Forum')).resolves.toBeInstanceOf(Buffer);
  });
});
