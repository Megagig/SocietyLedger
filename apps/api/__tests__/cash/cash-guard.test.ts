/** A charge paid through a cash receipt can't be deleted until that receipt is voided. */
const prismaMock: any = {
  payment: { findMany: jest.fn() },
  donationRecord: { findMany: jest.fn() },
  cashReceiptItem: { findMany: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));

import { cashBackedMessage, findCashBackingReceipts } from '../../src/modules/finance/cash-guard';

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.payment.findMany.mockResolvedValue([{ id: 11 }]);
  prismaMock.donationRecord.findMany.mockResolvedValue([]);
});

describe('findCashBackingReceipts', () => {
  it('names the active cash receipts that paid the charges', async () => {
    prismaMock.cashReceiptItem.findMany.mockResolvedValue([{ receipt: { receiptNumber: 'CSH1' } }, { receipt: { receiptNumber: 'CSH1' } }, { receipt: { receiptNumber: 'CSH2' } }]);
    expect(await findCashBackingReceipts(1, [5])).toEqual(['CSH1', 'CSH2']);
    const where = prismaMock.cashReceiptItem.findMany.mock.calls[0][0].where;
    expect(where.receipt).toEqual({ associationId: 1, status: 'ACTIVE' });
  });

  it('is empty when nothing was paid in cash, and skips the lookup when there are no payments', async () => {
    prismaMock.cashReceiptItem.findMany.mockResolvedValue([]);
    expect(await findCashBackingReceipts(1, [5])).toEqual([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    expect(await findCashBackingReceipts(1, [6])).toEqual([]);
    expect(prismaMock.cashReceiptItem.findMany).toHaveBeenCalledTimes(1);
    expect(await findCashBackingReceipts(1, [])).toEqual([]);
  });
});

describe('cashBackedMessage', () => {
  it('tells the officer which receipt to void first', () => {
    expect(cashBackedMessage(['CSH1'])).toContain('CSH1');
    expect(cashBackedMessage(['A', 'B', 'C', 'D'])).toContain('A, B, C…');
  });
});
