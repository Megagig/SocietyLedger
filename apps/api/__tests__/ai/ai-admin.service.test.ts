/** The owner's view of the AI: what each association's use cost against what it paid for credits. */
const prismaMock: any = {
  aIAuditLog: { groupBy: jest.fn() },
  aICreditPurchase: { groupBy: jest.fn() },
  association: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));

import { aiAdminService, usageWindow } from '../../src/modules/ai/ai-admin.service';

beforeEach(() => jest.clearAllMocks());

describe('the period', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  it('is the last 30 days unless asked otherwise, and stays between 1 and 365', () => {
    expect(usageWindow(undefined, now).from.toISOString()).toBe('2026-09-25T12:00:00.000Z');
    expect(usageWindow(0, now).from.toISOString()).toBe('2026-10-24T12:00:00.000Z');
    expect(usageWindow(9999, now).from.toISOString()).toBe('2025-10-25T12:00:00.000Z');
  });
});

describe('cost against credits sold', () => {
  it('puts use and sales side by side per association, biggest cost first, with totals', async () => {
    prismaMock.aIAuditLog.groupBy.mockResolvedValue([
      { associationId: 1, _count: { _all: 4 }, _sum: { units: 8, allowanceUnits: 5, creditUnits: 3, costUsd: 0.0125 } },
      { associationId: 2, _count: { _all: 10 }, _sum: { units: 10, allowanceUnits: 10, creditUnits: 0, costUsd: 0.04 } },
    ]);
    prismaMock.aICreditPurchase.groupBy.mockResolvedValue([
      { associationId: 1, _sum: { credits: 150, amount: 3000 } },
      { associationId: 3, _sum: { credits: 200, amount: 4000 } },
    ]);
    prismaMock.association.findMany.mockResolvedValue([{ id: 1, name: 'Oko Youth' }, { id: 2, name: 'Egbe Women' }, { id: 3, name: 'Ibadan Elders' }]);

    const report = await aiAdminService.usage(30);
    expect(report.rows.map((r) => r.associationName)).toEqual(['Egbe Women', 'Oko Youth', 'Ibadan Elders']);
    expect(report.rows[1]).toMatchObject({ requests: 4, units: 8, allowanceUnits: 5, creditUnits: 3, costUsd: 0.0125, creditsSold: 150, revenueNaira: 3000 });
    expect(report.rows[2]).toMatchObject({ requests: 0, costUsd: 0, creditsSold: 200, revenueNaira: 4000 });
    expect(report.totals).toEqual({ requests: 14, units: 18, allowanceUnits: 15, creditUnits: 3, costUsd: 0.0525, creditsSold: 350, revenueNaira: 7000 });
  });

  it('counts only answered requests and paid purchases', async () => {
    prismaMock.aIAuditLog.groupBy.mockResolvedValue([]);
    prismaMock.aICreditPurchase.groupBy.mockResolvedValue([]);
    const report = await aiAdminService.usage();
    expect(report.rows).toEqual([]);
    expect(prismaMock.aIAuditLog.groupBy.mock.calls[0][0].where.status).toBe('success');
    expect(prismaMock.aICreditPurchase.groupBy.mock.calls[0][0].where.status).toBe('success');
    expect(prismaMock.association.findMany).not.toHaveBeenCalled();
  });
});
