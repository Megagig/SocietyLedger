/**
 * Rebuilding a member's ledger must not charge them for a voided charge: its replacement carries the debt. Payments already made
 * against the voided charge were real money, so they still count as credits.
 */
const created: any[] = [];
const prismaMock: any = {
  memberFinancialLedger: {
    count: jest.fn(async () => 0),
    create: jest.fn(async ({ data }: any) => {
      created.push(data);
      return data;
    }),
    deleteMany: jest.fn(),
  },
  transaction: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));

import { memberLedgerService } from '../../src/modules/member-finance/member-ledger.service';

const txn = (over: object) => ({
  id: 1, amount: 5000, notes: null, referenceNumber: 'T1', createdAt: new Date('2026-01-01'), isVoided: false,
  category: { type: 'due', name: 'Annual dues' }, payments: [], ...over,
});

beforeEach(() => {
  created.length = 0;
  jest.clearAllMocks();
});

describe('syncExistingTransactions', () => {
  it('charges for a live charge and credits its payments', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([txn({ payments: [{ id: 9, amountPaid: 2000, paymentDate: new Date('2026-01-05'), receiptNumber: 'R1' }] })]);
    await memberLedgerService.syncExistingTransactions(1, 7, 1, false);
    expect(created.map((e) => [e.entryType, Number(e.amount)])).toEqual([['DEBIT', 5000], ['CREDIT', 2000]]);
    expect(Number(created[1].runningBalance)).toBe(3000);
  });

  it('adds no debit for a voided charge but keeps its payments as credits, so only the replacement is owed', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txn({ id: 1, isVoided: true, payments: [{ id: 9, amountPaid: 5000, paymentDate: new Date('2026-01-05'), receiptNumber: 'R1' }] }),
      txn({ id: 2, amount: 6000, referenceNumber: 'T2', createdAt: new Date('2026-01-06') }),
    ]);
    await memberLedgerService.syncExistingTransactions(1, 7, 1, false);
    expect(created.map((e) => [e.entryType, Number(e.amount), e.sourceId])).toEqual([['CREDIT', 5000, 9], ['DEBIT', 6000, 2]]);
    expect(Number(created[created.length - 1].runningBalance)).toBe(1000);
  });
});
