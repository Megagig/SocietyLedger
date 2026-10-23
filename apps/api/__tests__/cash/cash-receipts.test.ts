/**
 * Recording a cash receipt: safe to retry, owner-only, open collections only, and honest when only part of it was saved.
 * The per-kind recorders (which reuse the existing payment rules) are mocked — these cover the receipt itself.
 */
const prismaMock: any = {
  cashReceipt: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUniqueOrThrow: jest.fn() },
  cashCollection: { findFirst: jest.fn() },
  member: { findFirst: jest.fn() },
  user: { findMany: jest.fn(async () => []) },
  auditLog: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/modules/cash/cash-record-items', () => ({ assertCashEnabled: jest.fn(), recordCashItem: jest.fn() }));
jest.mock('../../src/modules/cash/cash-notifications', () => ({ notifyCashReceipt: jest.fn() }));
jest.mock('../../src/services/accounting-integration.service', () => ({ runAsCashCollection: (fn: () => Promise<unknown>) => fn() }));

import { cashCollectionsService } from '../../src/modules/cash/cash-collections.service';
import { assertCashEnabled, recordCashItem, type CashItemInput } from '../../src/modules/cash/cash-record-items';
import { notifyCashReceipt } from '../../src/modules/cash/cash-notifications';
import { CashRuleError } from '../../src/modules/cash/cash-rules';

const member = { id: 7, memberId: 'M-007', firstName: 'Ada', lastName: 'Obi', status: 'active', userId: 70, email: 'ada@example.com' };
const openCollection = { id: 1, associationId: 1, collectedBy: 10, status: 'OPEN' };
const dues: CashItemInput = { kind: 'DUES', targetId: 100, amount: 5000 };
const savings: CashItemInput = { kind: 'SAVINGS', targetId: 200, amount: 2000 };
const input = (items: CashItemInput[] = [dues], idempotencyKey = 'key-0000001') => ({ collectionId: 1, memberId: 7, idempotencyKey, items });
const savedReceipt = (over: object = {}) => ({
  id: 55, receiptNumber: 'CSH1', collectionId: 1, totalAmount: 5000, status: 'ACTIVE', createdBy: 10, createdAt: new Date(), memberId: 7,
  member: { id: 7, memberId: 'M-007', firstName: 'Ada', lastName: 'Obi' }, items: [{ id: 1, kind: 'DUES', sourceId: 9, label: 'Annual dues', amount: 5000 }], ...over,
});

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e instanceof CashRuleError ? e.code : `other:${(e as Error).message}`;
  }
  return 'none';
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.cashReceipt.findUnique.mockResolvedValue(null);
  prismaMock.cashCollection.findFirst.mockResolvedValue(openCollection);
  prismaMock.member.findFirst.mockResolvedValue(member);
  prismaMock.cashReceipt.create.mockResolvedValue({ id: 55 });
  prismaMock.cashReceipt.delete.mockResolvedValue({});
  prismaMock.cashReceipt.findUniqueOrThrow.mockResolvedValue(savedReceipt());
  (recordCashItem as jest.Mock).mockImplementation(async (_ctx, item) => ({ kind: item.kind, sourceId: 9, label: 'Annual dues', amount: item.amount }));
});

describe('recordReceipt', () => {
  it('records each item through the existing rules, saves the receipt, and tells the member', async () => {
    const { receipt, replayed } = await cashCollectionsService.recordReceipt(1, 10, input());
    expect(replayed).toBe(false);
    expect(receipt.total).toBe(5000);
    expect(recordCashItem).toHaveBeenCalledTimes(1);
    expect(prismaMock.cashReceipt.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 55 } }));
    expect(notifyCashReceipt).toHaveBeenCalledWith(1, expect.objectContaining({ memberUserId: 70, total: 5000 }));
  });

  it('a retry with the same key returns the receipt already made and credits nothing again', async () => {
    prismaMock.cashReceipt.findUnique.mockResolvedValue(savedReceipt());
    const { receipt, replayed } = await cashCollectionsService.recordReceipt(1, 10, input());
    expect(replayed).toBe(true);
    expect(receipt.receiptNumber).toBe('CSH1');
    expect(recordCashItem).not.toHaveBeenCalled();
    expect(prismaMock.cashReceipt.create).not.toHaveBeenCalled();
  });

  it('still answers a retry after the collection was closed', async () => {
    prismaMock.cashReceipt.findUnique.mockResolvedValue(savedReceipt());
    prismaMock.cashCollection.findFirst.mockResolvedValue({ ...openCollection, status: 'CLOSED' });
    expect((await cashCollectionsService.recordReceipt(1, 10, input())).replayed).toBe(true);
  });

  it('refuses a receipt that is still being saved by another request with the same key', async () => {
    prismaMock.cashReceipt.findUnique.mockResolvedValue(savedReceipt({ items: [], createdAt: new Date() }));
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('ALREADY_DECIDED');
    expect(recordCashItem).not.toHaveBeenCalled();
  });

  it('starts over from a receipt abandoned mid-save', async () => {
    prismaMock.cashReceipt.findUnique.mockResolvedValue(savedReceipt({ items: [], createdAt: new Date(Date.now() - 10 * 60_000) }));
    const { replayed } = await cashCollectionsService.recordReceipt(1, 10, input());
    expect(prismaMock.cashReceipt.delete).toHaveBeenCalledWith({ where: { id: 55 } });
    expect(replayed).toBe(false);
  });

  it('only the officer who opened the collection can add receipts', async () => {
    expect(await code(cashCollectionsService.recordReceipt(1, 99, input()))).toBe('NOT_OWNER');
    expect(recordCashItem).not.toHaveBeenCalled();
  });

  it('refuses a closed collection', async () => {
    prismaMock.cashCollection.findFirst.mockResolvedValue({ ...openCollection, status: 'CLOSED' });
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('COLLECTION_CLOSED');
  });

  it('refuses when the association has not enabled cash', async () => {
    (assertCashEnabled as jest.Mock).mockRejectedValueOnce(new CashRuleError('CASH_DISABLED', 'off'));
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('CASH_DISABLED');
  });

  it('refuses a disabled member, an empty receipt, and the same item twice', async () => {
    prismaMock.member.findFirst.mockResolvedValueOnce({ ...member, status: 'terminated' });
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('INVALID_LINK');
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input([])))).toBe('INVALID_ITEM');
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input([dues, { ...dues, amount: 1 }])))).toBe('INVALID_ITEM');
  });

  it('leaves nothing behind when the first payment fails', async () => {
    (recordCashItem as jest.Mock).mockRejectedValueOnce(new CashRuleError('OVER_BALANCE', 'too much'));
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('OVER_BALANCE');
    expect(prismaMock.cashReceipt.delete).toHaveBeenCalledWith({ where: { id: 55 } });
    expect(notifyCashReceipt).not.toHaveBeenCalled();
  });

  it('keeps what was already credited when a later payment fails, and says so', async () => {
    (recordCashItem as jest.Mock)
      .mockImplementationOnce(async (_c, item) => ({ kind: item.kind, sourceId: 9, label: 'Annual dues', amount: item.amount }))
      .mockRejectedValueOnce(new Error('savings account closed'));
    let error: unknown;
    try {
      await cashCollectionsService.recordReceipt(1, 10, input([dues, savings]));
    } catch (e) {
      error = e;
    }
    expect((error as CashRuleError).code).toBe('PARTIALLY_RECORDED');
    expect((error as CashRuleError).message).toContain('savings account closed');
    expect(prismaMock.cashReceipt.delete).not.toHaveBeenCalled();
    const kept = prismaMock.cashReceipt.update.mock.calls[0][0].data;
    expect(Number(kept.totalAmount)).toBe(5000);
    expect(kept.items.create).toHaveLength(1);
  });

  it('loses a race for the key cleanly instead of recording twice', async () => {
    prismaMock.cashReceipt.create.mockRejectedValueOnce({ code: 'P2002' });
    expect(await code(cashCollectionsService.recordReceipt(1, 10, input()))).toBe('ALREADY_DECIDED');
    expect(recordCashItem).not.toHaveBeenCalled();
  });
});
