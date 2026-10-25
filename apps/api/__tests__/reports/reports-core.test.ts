/**
 * The reports and the lists behind their figures. These guard the bugs this replaced: voided and forgiven charges counted as owed for
 * ever, income taken from when a charge was raised instead of when money came in, penalties shown as expenses, and aging buckets whose
 * members didn't add up to the bucket.
 */
const mockPrisma: any = {
  payment: { findMany: jest.fn(), aggregate: jest.fn(), count: jest.fn() },
  transaction: { findMany: jest.fn() },
  member: { findMany: jest.fn() },
  financialCategory: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));

import { Decimal } from '@prisma/client/runtime/library';
import {
  chargeWhere,
  generateAgingAnalysis,
  generateFinancialSummary,
  generateMemberBalances,
  listCharges,
  paymentWhere,
} from '../../src/modules/reports/reports-core.service';

const d = (n: number | string) => new Decimal(n);
const NOW = new Date('2026-10-15T11:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

beforeEach(() => jest.resetAllMocks());

describe('what counts', () => {
  it('money expected leaves out voided and forgiven charges; money owing leaves out voided and paid ones', () => {
    expect(chargeWhere(1, { scope: 'raised', startDate: NOW, endDate: NOW })).toMatchObject({ associationId: 1, isVoided: false, status: { not: 'waived' } });
    expect(chargeWhere(1, { scope: 'owing' })).toMatchObject({ isVoided: false, status: { in: ['pending', 'partial', 'overdue'] } });
  });

  it('overdue is the same rule as the overdue list: open, not voided, and the due date has passed', () => {
    expect(chargeWhere(1, { scope: 'overdue' }, NOW)).toMatchObject({ isVoided: false, dueDate: { lt: NOW } });
  });

  it('payments are found by the date money came in, not the date the charge was raised', () => {
    const w = paymentWhere(1, { startDate: daysAgo(30), endDate: NOW, categoryId: 4 }) as any;
    expect(w.paymentDate).toEqual({ gte: daysAgo(30), lte: NOW });
    expect(w.transaction).toEqual({ categoryId: 4 });
  });
});

describe('financial summary', () => {
  const category = { id: 1, name: 'Monthly dues', type: 'due' };
  const penalty = { id: 2, name: 'Late fee', type: 'penalty' };

  it('income is the money that came in during the period, and a penalty is income, not an expense', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([
      { amountPaid: d(5000), transaction: { category } },
      { amountPaid: d(2500), transaction: { category } },
      { amountPaid: d(1000), transaction: { category: penalty } },
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const report = await generateFinancialSummary(1, { period: 'this_month' });
    expect(report.income.total.toString()).toBe('8500');
    expect(report.received).toMatchObject({ paymentCount: 3 });
    expect(report.expenses.total.toString()).toBe('0');
    expect(report.income.byCategory.map((c) => [c.categoryName, c.amount.toString()])).toEqual([['Monthly dues', '7500'], ['Late fee', '1000']]);
    // it asked for payments by their own date
    expect((mockPrisma.payment.findMany.mock.calls[0][0].where as any).paymentDate).toBeDefined();
  });

  it('collections cover only counted charges raised in the period, and what has been paid on them', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([
      { amount: d(10000), payments: [{ amountPaid: d(4000) }] },
      { amount: d(10000), payments: [] },
    ]);
    const report = await generateFinancialSummary(1, { period: 'this_month' });
    expect(report.collections.expected.toString()).toBe('20000');
    expect(report.collections.collected.toString()).toBe('4000');
    expect(report.collections.outstanding.toString()).toBe('16000');
    expect(report.collections.collectionRate).toBe(20);
    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where).toMatchObject({ isVoided: false, status: { not: 'waived' } });
  });

  it('a custom range is honoured, and one without an end date is refused', async () => {
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const a = new Date('2026-01-01T00:00:00Z');
    const b = new Date('2026-02-01T00:00:00Z');
    const report = await generateFinancialSummary(1, { period: 'custom', startDate: a, endDate: b });
    expect(report.period.startDate).toEqual(a);
    await expect(generateFinancialSummary(1, { period: 'custom', startDate: a })).rejects.toMatchObject({ code: 'RANGE_REQUIRED' });
  });
});

describe('member balances', () => {
  const member = (id: number, status: string, transactions: object[]) => ({ id, memberId: `M-${id}`, firstName: `A${id}`, lastName: 'Obi', email: null, phone: null, status, transactions });

  it('includes suspended and inactive members who owe, and leaves out only members who were disabled', async () => {
    mockPrisma.member.findMany.mockResolvedValue([]);
    await generateMemberBalances(1, {});
    expect(mockPrisma.member.findMany.mock.calls[0][0].where).toMatchObject({ associationId: 1, status: { not: 'terminated' } });
    expect(mockPrisma.member.findMany.mock.calls[0][0].select.transactions.where).toMatchObject({ isVoided: false, status: { not: 'waived' } });
  });

  it('totals cover the whole filtered list and add up to the rows, and overdue follows the due date rule', async () => {
    mockPrisma.member.findMany.mockResolvedValue([
      member(1, 'active', [{ amount: d(10000), status: 'pending', dueDate: daysAgo(5), isVoided: false, payments: [{ amountPaid: d(2000), paymentDate: daysAgo(2) }] }]),
      member(2, 'suspended', [{ amount: d(5000), status: 'pending', dueDate: new Date(NOW.getTime() + 86_400_000), isVoided: false, payments: [] }]),
      member(3, 'active', [{ amount: d(3000), status: 'paid', dueDate: daysAgo(40), isVoided: false, payments: [{ amountPaid: d(3000), paymentDate: daysAgo(30) }] }]),
    ]);
    const all = await generateMemberBalances(1, { limit: 2 }, NOW);
    expect(all.members).toHaveLength(2); // a page
    expect(all.totals).toMatchObject({ memberCount: 3, overdueCharges: 1 });
    expect(all.totals.totalDues.toString()).toBe('18000');
    expect(all.totals.totalPaid.toString()).toBe('5000');
    expect(all.totals.balance.toString()).toBe('13000');

    const owing = await generateMemberBalances(1, { status: 'with_balance' }, NOW);
    expect(owing.members.map((m) => m.memberId).sort()).toEqual([1, 2]);
    expect(owing.totals.balance.toString()).toBe('13000');
    const overdue = await generateMemberBalances(1, { status: 'overdue' }, NOW);
    expect(overdue.members.map((m) => m.memberId)).toEqual([1]);
  });
});

describe('aging', () => {
  const charge = (id: number, memberId: number, amount: number, dueDate: Date | null, paid = 0) => ({
    id, amount: d(amount), dueDate, memberId, member: { id: memberId, firstName: `A${memberId}`, lastName: 'Obi' }, payments: paid ? [{ amountPaid: d(paid) }] : [],
  });

  it("a bucket's amount is exactly the sum of its members, even when a member has charges in several buckets", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      charge(1, 1, 10000, daysAgo(10)), // member 1: 10 days late
      charge(2, 1, 5000, daysAgo(100), 1000), // and 100 days late, part paid -> 4000 owing
      charge(3, 2, 7000, daysAgo(45)),
      charge(4, 3, 2000, null), // no due date: not overdue
      charge(5, 3, 1500, daysAgo(3), 1500), // paid in full: skipped
    ]);
    const report = await generateAgingAnalysis(1, NOW);
    const { buckets, summary } = report;
    for (const b of Object.values(buckets)) {
      const memberSum = b.members.reduce((s, m) => s.plus(m.amount), d(0));
      expect(memberSum.toString()).toBe(b.amount.toString());
    }
    expect(buckets.current.amount.toString()).toBe('10000');
    expect(buckets.days31to60.amount.toString()).toBe('7000');
    expect(buckets.over90.amount.toString()).toBe('4000');
    expect(buckets.notYetDue.amount.toString()).toBe('2000');
    expect(summary.totalOutstanding.toString()).toBe('23000');
    expect(summary.totalTransactions).toBe(4);
    expect(summary.totalMembers).toBe(3);
    const total = Object.values(buckets).reduce((s, b) => s.plus(b.amount), d(0));
    expect(total.toString()).toBe(summary.totalOutstanding.toString());
    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where).toMatchObject({ isVoided: false });
  });
});

describe('the list behind a figure', () => {
  const row = (id: number, amount: number, status: string, dueDate: Date | null, paid = 0) => ({
    id, referenceNumber: `R${id}`, amount: d(amount), status, dueDate, createdAt: daysAgo(20), isVoided: false,
    member: { id: id, memberId: `M-${id}`, firstName: 'A', lastName: 'Obi' }, category: { id: 1, name: 'Dues', type: 'due' }, payments: paid ? [{ amountPaid: d(paid) }] : [],
  });

  it('holds only charges with something still owing, shows an open charge past its date as overdue, and its totals are the figure', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      row(1, 10000, 'pending', daysAgo(5), 2500),
      row(2, 4000, 'overdue', daysAgo(50)),
      row(3, 3000, 'partial', null, 3000), // nothing left: dropped
    ]);
    const result = await listCharges(1, { scope: 'owing' }, 1, 25, NOW);
    expect(result.charges.map((c) => [c.id, c.status])).toEqual([[1, 'overdue'], [2, 'overdue']]);
    expect(result.totals.count).toBe(2);
    expect(result.totals.balance.toString()).toBe('11500');
    expect(result.totals.balance.toString()).toBe(result.charges.reduce((s, c) => s.plus(c.balance), d(0)).toString());
  });

  it('pages the rows but totals the whole list', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([row(1, 1000, 'pending', null), row(2, 2000, 'pending', null), row(3, 4000, 'pending', null)]);
    const result = await listCharges(1, { scope: 'owing' }, 2, 2, NOW);
    expect(result.charges).toHaveLength(1);
    expect(result.totals.balance.toString()).toBe('7000');
    expect(result.pagination).toMatchObject({ totalCount: 3, totalPages: 2, hasMore: false });
  });

  it("an aging bucket's list asks for the bucket's own due dates", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    await listCharges(1, { scope: 'aging', bucket: 'days31to60', asOf: NOW }, 1, 25, NOW);
    const where = mockPrisma.transaction.findMany.mock.calls[0][0].where;
    expect(where.dueDate).toBeDefined();
    await expect(listCharges(1, { scope: 'aging' }, 1, 25, NOW)).rejects.toMatchObject({ code: 'BUCKET_REQUIRED' });
  });
});
