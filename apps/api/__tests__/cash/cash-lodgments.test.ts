/**
 * Lodging cash into the bank and checking it: a different officer verifies, a shortfall needs a reason, nothing over what is held can
 * be lodged, and one decision wins.
 */
const prismaMock: any = {
  cashLodgment: { findFirst: jest.fn(), updateMany: jest.fn() },
  cashCollection: { findMany: jest.fn() },
  associationBankAccount: { findFirst: jest.fn(), findMany: jest.fn(async () => []) },
  auditLog: { create: jest.fn() },
  user: { findMany: jest.fn(async () => []) },
  cashReceipt: { groupBy: jest.fn() },
  cashLodgmentAllocation: { groupBy: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/lib/storage', () => ({ uploadFile: jest.fn(), deleteFile: jest.fn(), getPresignedUrl: jest.fn() }));
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onCashLodgmentVerified: jest.fn() },
  runAsCashCollection: (fn: () => Promise<unknown>) => fn(),
}));
jest.mock('../../src/modules/cash/cash-notifications', () => ({
  notifyLodgmentRecorded: jest.fn(),
  notifyLodgmentDecided: jest.fn(),
  notifyCashReceipt: jest.fn(),
}));
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSettings: jest.fn(async () => ({})) } }));

import { cashLodgmentsService } from '../../src/modules/cash/cash-lodgments.service';
import { accountingIntegrationService } from '../../src/services/accounting-integration.service';
import { uploadFile } from '../../src/lib/storage';
import { notifyLodgmentDecided } from '../../src/modules/cash/cash-notifications';
import { CashRuleError } from '../../src/modules/cash/cash-rules';

async function code(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e instanceof CashRuleError ? e.code : `other:${(e as Error).message}`;
  }
  return 'none';
}

const lodgment = (over: object = {}) => ({
  id: 5, associationId: 1, lodgedBy: 10, amount: 9000, expectedAmount: 9000, status: 'PENDING', bankAccountId: 3,
  depositDate: new Date(), bankReference: null, slipKey: 'k', allocations: [{ collectionId: 1, amount: 9000, collection: { id: 1, title: 'AGM' } }],
  createdAt: new Date(), shortfallReason: null, verifiedBy: null, verifiedAt: null, rejectionReason: null, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.cashLodgment.findFirst.mockResolvedValue(lodgment());
  prismaMock.cashLodgment.updateMany.mockResolvedValue({ count: 1 });
});

describe('decideLodgment', () => {
  it('lets a different officer verify, posts the cash to the bank, and tells the collector', async () => {
    prismaMock.associationBankAccount.findFirst.mockResolvedValue({ bankName: 'GTBank' });
    await cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'VERIFIED' });
    expect(accountingIntegrationService.onCashLodgmentVerified).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }), 'GTBank', 20);
    expect(notifyLodgmentDecided).toHaveBeenCalledWith(1, expect.objectContaining({ lodgedBy: 10, status: 'VERIFIED' }));
  });

  it('never lets the officer who lodged it verify it', async () => {
    expect(await code(cashLodgmentsService.decideLodgment(1, 10, 5, { status: 'VERIFIED' }))).toBe('OWN_LODGMENT');
    expect(prismaMock.cashLodgment.updateMany).not.toHaveBeenCalled();
  });

  it('only one decision wins — a second finds nothing pending', async () => {
    prismaMock.cashLodgment.updateMany.mockResolvedValue({ count: 0 });
    expect(await code(cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'VERIFIED' }))).toBe('ALREADY_DECIDED');
    expect(accountingIntegrationService.onCashLodgmentVerified).not.toHaveBeenCalled();
  });

  it('claims only a pending lodgment that was not made by the decider', async () => {
    await cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'REJECTED', reason: 'Not on the statement' });
    expect(prismaMock.cashLodgment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING', lodgedBy: { not: 20 } }) }),
    );
  });

  it('a rejection needs a reason and posts nothing to the books', async () => {
    expect(await code(cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'REJECTED' }))).toBe('INVALID_ITEM');
    await cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'REJECTED', reason: 'Wrong account' });
    expect(accountingIntegrationService.onCashLodgmentVerified).not.toHaveBeenCalled();
    expect(notifyLodgmentDecided).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'REJECTED', rejectionReason: 'Wrong account' }));
  });

  it('a books failure does not undo the verification', async () => {
    prismaMock.associationBankAccount.findFirst.mockResolvedValue({ bankName: 'GTBank' });
    (accountingIntegrationService.onCashLodgmentVerified as jest.Mock).mockRejectedValueOnce(new Error('period closed'));
    await expect(cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'VERIFIED' })).resolves.toBeDefined();
  });

  it('reports a lodgment that does not exist', async () => {
    prismaMock.cashLodgment.findFirst.mockResolvedValue(null);
    expect(await code(cashLodgmentsService.decideLodgment(1, 20, 5, { status: 'VERIFIED' }))).toBe('NOT_FOUND');
  });
});

describe('recordLodgment rules', () => {
  const slip = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'slip.jpg' };
  const base = { bankAccountId: 3, amount: 9000, depositDate: new Date() };

  beforeEach(() => {
    prismaMock.associationBankAccount.findFirst.mockResolvedValue({ id: 3, bankName: 'GTBank', isActive: true });
    // one closed collection holding 9,000 that is not yet lodged
    prismaMock.cashCollection.findMany.mockResolvedValue([{ id: 1, title: 'AGM', closedAt: new Date(Date.now() - 86_400_000) }]);
    prismaMock.cashReceipt.groupBy.mockResolvedValue([{ collectionId: 1, _sum: { totalAmount: 9000 }, _count: { _all: 3 } }]);
    prismaMock.cashLodgmentAllocation.groupBy.mockResolvedValue([]);
  });

  it('refuses to lodge more than the cash held', async () => {
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, { ...base, amount: 9500 }, slip))).toBe('OVER_CASH_IN_HAND');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('asks for a reason when lodging less than was collected', async () => {
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, { ...base, amount: 8500 }, slip))).toBe('SHORTFALL_REASON_REQUIRED');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('refuses when there is nothing closed to lodge', async () => {
    prismaMock.cashCollection.findMany.mockResolvedValue([]);
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, base, slip))).toBe('NOTHING_TO_LODGE');
  });

  it('refuses a bank account that is inactive or not this association’s', async () => {
    prismaMock.associationBankAccount.findFirst.mockResolvedValueOnce({ id: 3, isActive: false });
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, base, slip))).toBe('INVALID_LINK');
    prismaMock.associationBankAccount.findFirst.mockResolvedValueOnce(null);
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, base, slip))).toBe('INVALID_LINK');
  });

  it('refuses a future deposit date and an amount that is not naira and kobo', async () => {
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, { ...base, depositDate: new Date(Date.now() + 5 * 86_400_000) }, slip))).toBe('INVALID_ITEM');
    expect(await code(cashLodgmentsService.recordLodgment(1, 10, { ...base, amount: 10.005 }, slip))).toBe('INVALID_ITEM');
  });
});
