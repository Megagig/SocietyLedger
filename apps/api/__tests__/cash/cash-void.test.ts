/**
 * Voiding a cash receipt: only while the collection is open, never your own, with a reason, one at a time, and never for a loan
 * repayment (which can't be unwound automatically).
 */
const prismaMock: any = {
  cashReceipt: { findFirst: jest.fn(), updateMany: jest.fn() },
  savingsTransaction: { findFirst: jest.fn() },
  welfareContribution: { findFirst: jest.fn() },
  auditLog: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { reverseJournalEntry: jest.fn() } }));
jest.mock('../../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onPaymentChange: jest.fn() } }));
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createEntry: jest.fn() } }));
jest.mock('../../src/modules/cash/cash-notifications', () => ({ notifyCashReceiptVoided: jest.fn() }));

import { voidCashReceipt } from '../../src/modules/cash/cash-void';
import { CashRuleError } from '../../src/modules/cash/cash-rules';
import { notifyCashReceiptVoided } from '../../src/modules/cash/cash-notifications';

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e instanceof CashRuleError ? e.code : `other:${(e as Error).message}`;
  }
  return 'none';
}

const receipt = (over: object = {}) => ({
  id: 8, receiptNumber: 'CSH8', createdBy: 10, status: 'ACTIVE', collection: { status: 'OPEN' },
  member: { firstName: 'Ada', lastName: 'Obi', userId: 70 }, items: [] as any[], ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.cashReceipt.findFirst.mockResolvedValue(receipt());
  prismaMock.cashReceipt.updateMany.mockResolvedValue({ count: 1 });
});

describe('voidCashReceipt', () => {
  it('voids an open-collection receipt for a different officer and tells the member why', async () => {
    await voidCashReceipt(1, 20, 8, 'Wrong member');
    expect(prismaMock.cashReceipt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8, associationId: 1, status: 'ACTIVE' }, data: expect.objectContaining({ status: 'VOIDED', voidedBy: 20, voidReason: 'Wrong member' }) }),
    );
    expect(notifyCashReceiptVoided).toHaveBeenCalledWith(1, expect.objectContaining({ memberUserId: 70, reason: 'Wrong member' }));
  });

  it('needs a reason', async () => {
    expect(await code(voidCashReceipt(1, 20, 8, '   '))).toBe('INVALID_ITEM');
  });

  it('refuses once the collection is closed', async () => {
    prismaMock.cashReceipt.findFirst.mockResolvedValue(receipt({ collection: { status: 'CLOSED' } }));
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('COLLECTION_CLOSED');
    expect(prismaMock.cashReceipt.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to let an officer void the receipt they took themselves', async () => {
    expect(await code(voidCashReceipt(1, 10, 8, 'Typo'))).toBe('NOT_OWNER');
  });

  it('refuses a receipt that is already voided, and when another officer voids it first', async () => {
    prismaMock.cashReceipt.findFirst.mockResolvedValueOnce(receipt({ status: 'VOIDED' }));
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('ALREADY_DECIDED');
    prismaMock.cashReceipt.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('ALREADY_DECIDED');
  });

  it('refuses a receipt that includes a loan repayment, before changing anything', async () => {
    prismaMock.cashReceipt.findFirst.mockResolvedValue(receipt({ items: [{ id: 1, kind: 'LOAN_REPAYMENT', sourceId: 4, label: 'Loan L1', amount: 3000 }] }));
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('NOT_VOIDABLE');
    expect(prismaMock.cashReceipt.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a savings deposit the member has already spent', async () => {
    prismaMock.cashReceipt.findFirst.mockResolvedValue(receipt({ items: [{ id: 1, kind: 'SAVINGS', sourceId: 4, label: 'Savings', amount: 3000 }] }));
    prismaMock.savingsTransaction.findFirst.mockResolvedValue({ amount: 3000, savingsAccount: { balance: { lessThan: () => true } } });
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('NOT_VOIDABLE');
    expect(prismaMock.cashReceipt.updateMany).not.toHaveBeenCalled();
  });

  it('reports a receipt that does not exist', async () => {
    prismaMock.cashReceipt.findFirst.mockResolvedValue(null);
    expect(await code(voidCashReceipt(1, 20, 8, 'Typo'))).toBe('NOT_FOUND');
  });
});
