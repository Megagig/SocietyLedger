/**
 * Re-syncing a member's ledger must not charge them for a voided charge (its replacement carries the debt), while payments already made
 * against it were real money and still count as credits. It also must not wipe entries that did not come from a charge or payment
 * (waivers, savings, loans, adjustments): only the ones that do are touched.
 */
const stored: any[] = [];
const removed: number[][] = [];
const updates: any[] = [];

const tx: any = {
  $executeRaw: jest.fn(),
  transaction: { findMany: jest.fn() },
  memberFinancialLedger: {
    findMany: jest.fn(async (args: any) => {
      // the reconcile reads existing charge/payment entries and void markers; the renumbering reads everything in date order
      if (args.orderBy) return stored.map((row, i) => ({ id: i + 1, ...row })).sort((a, b) => a.effectiveDate - b.effectiveDate || a.id - b.id);
      return [];
    }),
    createMany: jest.fn(async ({ data }: any) => {
      stored.push(...data);
      return { count: data.length };
    }),
    deleteMany: jest.fn(async ({ where }: any) => {
      removed.push(where.id.in);
      return { count: where.id.in.length };
    }),
    update: jest.fn(async (args: any) => {
      updates.push(args);
      return {};
    }),
    aggregate: jest.fn(async ({ where }: any) => ({
      _sum: { amount: stored.filter((r) => r.entryType === where.entryType).reduce((s, r) => s + Number(r.amount), 0) },
    })),
  },
};
const prismaMock: any = {
  memberFinancialLedger: { count: jest.fn(async () => 0) },
  $transaction: jest.fn(async (fn: any) => fn(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));

import { memberLedgerService } from '../../src/modules/member-finance/member-ledger.service';

const txn = (over: object) => ({
  id: 1, amount: 5000, notes: null, referenceNumber: 'T1', createdAt: new Date('2026-01-01'), isVoided: false,
  category: { type: 'due', name: 'Annual dues' }, payments: [], ...over,
});

beforeEach(() => {
  stored.length = 0;
  removed.length = 0;
  updates.length = 0;
  jest.clearAllMocks();
});

describe('syncExistingTransactions', () => {
  it('charges for a live charge and credits its payments', async () => {
    tx.transaction.findMany.mockResolvedValue([txn({ payments: [{ id: 9, amountPaid: 2000, paymentDate: new Date('2026-01-05'), receiptNumber: 'R1' }] })]);
    const result = await memberLedgerService.syncExistingTransactions(1, 7, 1, false);
    expect(stored.map((e) => [e.entryType, Number(e.amount)])).toEqual([['DEBIT', 5000], ['CREDIT', 2000]]);
    expect(result).toEqual({ entriesCreated: 2, finalBalance: 3000 });
    expect(updates.map((u) => u.data.runningBalance)).toEqual([5000, 3000]);
  });

  it('adds no debit for a voided charge but keeps its payments as credits, so only the replacement is owed', async () => {
    tx.transaction.findMany.mockResolvedValue([
      txn({ id: 1, isVoided: true, payments: [{ id: 9, amountPaid: 5000, paymentDate: new Date('2026-01-05'), receiptNumber: 'R1' }] }),
      txn({ id: 2, amount: 6000, referenceNumber: 'T2', createdAt: new Date('2026-01-06') }),
    ]);
    const result = await memberLedgerService.syncExistingTransactions(1, 7, 1, false);
    expect(stored.map((e) => [e.entryType, Number(e.amount), e.sourceId])).toEqual([['CREDIT', 5000, 9], ['DEBIT', 6000, 2]]);
    expect(result.finalBalance).toBe(1000);
  });

  it('records a donation as a charge and a payment, so an instant donation leaves the member owing nothing', async () => {
    tx.transaction.findMany.mockResolvedValue([
      txn({ id: 3, amount: 20000, category: { type: 'donation', name: 'Building Fund' }, payments: [{ id: 30, amountPaid: 20000, paymentDate: new Date('2026-01-02'), receiptNumber: 'R3' }] }),
    ]);
    const result = await memberLedgerService.syncExistingTransactions(1, 7, 1, false);
    expect(stored.map((e) => [e.entryType, e.category, Number(e.amount)])).toEqual([['DEBIT', 'DONATION', 20000], ['CREDIT', 'DONATION', 20000]]);
    expect(result.finalBalance).toBe(0);
  });

  it('refuses to run over an existing ledger unless forced, as before', async () => {
    prismaMock.memberFinancialLedger.count.mockResolvedValueOnce(4);
    await expect(memberLedgerService.syncExistingTransactions(1, 7, 1, false)).rejects.toThrow('already has ledger entries');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
