/**
 * The member ledger page (web) reads totalAdjustments, entryCount, lastEntryDate and a per-category net from the
 * summary; the mobile app reads byCategory. Prisma is mocked.
 */
const mockPrisma = {
  memberFinancialLedger: { groupBy: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), findFirst: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma, default: mockPrisma }));

import { memberLedgerService } from '../../src/modules/member-finance/member-ledger.service';

describe('getMemberLedgerSummary', () => {
  beforeEach(() => {
    jest.spyOn(memberLedgerService, 'getMemberBalance').mockResolvedValue(0);
    mockPrisma.memberFinancialLedger.groupBy.mockResolvedValue([
      { category: 'LEVY', entryType: 'DEBIT', _sum: { amount: 10000 }, _count: { _all: 1 } },
      { category: 'LEVY', entryType: 'CREDIT', _sum: { amount: 10000 }, _count: { _all: 1 } },
      { category: 'DUES', entryType: 'ADJUSTMENT', _sum: { amount: 500 }, _count: { _all: 2 } },
    ]);
    mockPrisma.memberFinancialLedger.findMany.mockResolvedValue([
      { id: 9, amount: 500, runningBalance: 0, effectiveDate: new Date('2026-10-21T10:00:00Z') },
    ]);
  });

  it('returns the totals and counts the web page shows, and keeps byCategory for mobile', async () => {
    const summary: any = await memberLedgerService.getMemberLedgerSummary(15, 73);

    expect(summary).toMatchObject({ totalDebits: 10000, totalCredits: 10000, totalAdjustments: 500, entryCount: 4 });
    expect(summary.lastEntryDate).toEqual(new Date('2026-10-21T10:00:00Z'));
    expect(summary.byCategory.LEVY).toEqual({ debits: 10000, credits: 10000 });
    expect(summary.categoryBreakdown.LEVY).toEqual({ debits: 10000, credits: 10000, net: 0 });
  });
});
