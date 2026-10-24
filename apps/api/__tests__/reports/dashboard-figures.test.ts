/**
 * The money figures on Home. They must be worked out the way the reports and their drill-down lists work them out, or tapping a tile
 * would open a list that doesn't add up to it. These guard the bugs this replaced: forgiven and cancelled charges counted as owed,
 * payments with no method missing from the method split, and months cut on the server's clock.
 */
const mockPrisma: any = {
  payment: { aggregate: jest.fn(), groupBy: jest.fn() },
  transaction: { aggregate: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));

import { Decimal } from '@prisma/client/runtime/library';
import { dashboardService } from '../../src/modules/dashboard/dashboard.service';
import { monthRange } from '../../src/modules/reports/report-rules';

const d = (n: number) => new Decimal(n);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeEach(() => jest.resetAllMocks());

describe('Home financial figures', () => {
  it('owed, overdue and pending are exactly what the aging report and its lists hold', async () => {
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountPaid: d(9000) } });
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: d(30000) } });
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 1, amount: d(10000), dueDate: daysAgo(5), memberId: 1, member: { id: 1, firstName: 'A', lastName: 'O' }, payments: [{ amountPaid: d(2000) }] },
      { id: 2, amount: d(5000), dueDate: daysAhead(10), memberId: 2, member: { id: 2, firstName: 'B', lastName: 'O' }, payments: [] },
      { id: 3, amount: d(3000), dueDate: null, memberId: 3, member: { id: 3, firstName: 'C', lastName: 'O' }, payments: [] },
    ]);
    const summary = await dashboardService.getFinancialSummary(1);
    expect(summary.outstandingDues.toString()).toBe('16000');
    expect(summary.overduePayments).toBe(1);
    expect(summary.pendingPayments).toBe(2);
    expect(summary.totalInflow.toString()).toBe('9000');
    expect(summary.collectionRate).toBe(30);
    // what is expected leaves out voided and forgiven charges
    expect(mockPrisma.transaction.aggregate.mock.calls[0][0].where).toMatchObject({ isVoided: false, status: { not: 'waived' } });
  });
});

describe('payment methods', () => {
  it('shows payments recorded without a method as their own slice, so the slices add up to all the money received', async () => {
    mockPrisma.payment.groupBy.mockResolvedValue([
      { paymentMethod: 'cash', _count: { id: 2 }, _sum: { amountPaid: d(6000) } },
      { paymentMethod: null, _count: { id: 1 }, _sum: { amountPaid: d(4000) } },
    ]);
    const methods = await dashboardService.getPaymentMethods(1);
    expect(methods.map((m) => [m.method, m.amount.toString(), m.percentage])).toEqual([['cash', '6000', 60], ['unspecified', '4000', 40]]);
    expect(methods[1]!.name).toBe('Not recorded');
    expect(mockPrisma.payment.groupBy.mock.calls[0][0].where).toEqual({ associationId: 1 });
  });
});

describe('the revenue trend', () => {
  it('has a bar for each of the last months in Lagos time, each carrying its own dates', async () => {
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountPaid: d(1000) } });
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: d(2000) } });
    const trend = await dashboardService.getRevenueTrend(1, 3);
    expect(trend).toHaveLength(3);
    const thisMonth = monthRange(0);
    expect(trend[2]!.startDate).toEqual(thisMonth.startDate);
    expect(trend[2]!.endDate).toEqual(thisMonth.endDate);
    expect(trend[0]!.endDate!.getTime()).toBeLessThan(trend[1]!.startDate!.getTime());
    expect(trend[2]!.revenue.toString()).toBe('1000');
  });

  it('knows the month before across the new year', () => {
    const jan = new Date('2027-01-10T10:00:00Z');
    expect(monthRange(1, jan).label).toBe('December 2026');
    expect(monthRange(0, jan).shortLabel).toBe('Jan');
    expect(monthRange(13, jan).label).toBe('December 2025');
  });
});
