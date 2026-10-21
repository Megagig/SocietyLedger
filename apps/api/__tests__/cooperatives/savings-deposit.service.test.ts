/**
 * A member's savings deposit is only a request until an officer approves it. These cover the rules that
 * matter: the balance only moves on approval (and only once), a failed credit puts the request back in the
 * queue, and a member can only declare a deposit into their own active account. Prisma is mocked.
 */
const mockPrisma = {
  savingsAccount: { findFirst: jest.fn() },
  associationBankAccount: { findFirst: jest.fn() },
  savingsDepositRequest: {
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  member: { findUnique: jest.fn() },
  notification: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));

import { Decimal } from '@prisma/client/runtime/library';
import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

const pendingRow = {
  id: 5,
  associationId: 15,
  savingsAccountId: 9,
  memberId: 70,
  amount: new Decimal('25000.00'),
  reference: null,
  rejectionReason: null,
};

let processSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  processSpy = jest
    .spyOn(cooperativesService, 'processSavingsTransaction')
    .mockResolvedValue({ id: 301 } as never);
  mockPrisma.savingsDepositRequest.findFirstOrThrow.mockResolvedValue(pendingRow);
  mockPrisma.savingsDepositRequest.update.mockResolvedValue({});
  mockPrisma.member.findUnique.mockResolvedValue({ userId: 7 });
  mockPrisma.notification.create.mockResolvedValue({});
});

afterEach(() => processSpy.mockRestore());

describe('createSavingsDepositRequest', () => {
  const input = { savingsAccountId: 9, amount: 25000, paymentDate: new Date() };
  const receipt = { filename: 'r.png', filepath: 'savings-deposits/15/x.png' };

  it("refuses an account that isn't the member's own active account", async () => {
    mockPrisma.savingsAccount.findFirst.mockResolvedValue(null);

    await expect(cooperativesService.createSavingsDepositRequest(15, 70, input, receipt)).rejects.toThrow(
      'Savings account not found or inactive'
    );

    expect(mockPrisma.savingsAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 9, associationId: 15, memberId: 70, status: 'ACTIVE' },
    });
    expect(mockPrisma.savingsDepositRequest.create).not.toHaveBeenCalled();
  });

  it('creates a PENDING request and never touches the balance', async () => {
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({ id: 9 });
    mockPrisma.savingsDepositRequest.create.mockResolvedValue({
      ...pendingRow,
      status: 'PENDING',
      paymentDate: new Date(),
      filename: 'r.png',
      filepath: 'k',
      createdAt: new Date(),
    });

    const result = await cooperativesService.createSavingsDepositRequest(15, 70, input, receipt);

    expect(result.status).toBe('PENDING');
    expect(processSpy).not.toHaveBeenCalled();
  });

  it('rejects an unknown bank account', async () => {
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({ id: 9 });
    mockPrisma.associationBankAccount.findFirst.mockResolvedValue(null);

    await expect(
      cooperativesService.createSavingsDepositRequest(15, 70, { ...input, bankAccountId: 99 }, receipt)
    ).rejects.toThrow('Bank account not found');
  });
});

describe('approveSavingsDepositRequest', () => {
  it('credits the account once, as a DEPOSIT, then links the transaction', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.approveSavingsDepositRequest(15, 5, 2);

    expect(processSpy).toHaveBeenCalledTimes(1);
    expect(processSpy).toHaveBeenCalledWith(
      15,
      2,
      expect.objectContaining({ savingsAccountId: 9, type: 'DEPOSIT', amount: 25000, paymentMethod: 'BANK_TRANSFER' })
    );
    expect(mockPrisma.savingsDepositRequest.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { savingsTransactionId: 301 },
    });
  });

  it('refuses a request that was already reviewed, without crediting again', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(cooperativesService.approveSavingsDepositRequest(15, 5, 2)).rejects.toThrow('already been reviewed');

    expect(processSpy).not.toHaveBeenCalled();
  });

  it('only claims a PENDING request in the same association', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.approveSavingsDepositRequest(15, 5, 2);

    expect(mockPrisma.savingsDepositRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, associationId: 15, status: 'PENDING' } })
    );
  });

  it('puts the request back in the queue if the credit fails', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 1 });
    processSpy.mockRejectedValue(new Error('Savings account not found or inactive'));

    await expect(cooperativesService.approveSavingsDepositRequest(15, 5, 2)).rejects.toThrow(
      'Savings account not found or inactive'
    );

    expect(mockPrisma.savingsDepositRequest.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
  });

  it("tells the member, and a notification failure doesn't fail the approval", async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.notification.create.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(cooperativesService.approveSavingsDepositRequest(15, 5, 2)).resolves.toBeDefined();

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 7, type: 'savings.deposit_approved', entityId: 5 }) })
    );
    errorSpy.mockRestore();
  });
});

describe('rejectSavingsDepositRequest', () => {
  it('records the reason and never credits the account', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.rejectSavingsDepositRequest(15, 5, 2, 'No matching credit on the statement');

    expect(processSpy).not.toHaveBeenCalled();
    expect(mockPrisma.savingsDepositRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, associationId: 15, status: 'PENDING' },
        data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'No matching credit on the statement' }),
      })
    );
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'savings.deposit_rejected' }) })
    );
  });

  it('refuses a request that was already reviewed', async () => {
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(cooperativesService.rejectSavingsDepositRequest(15, 5, 2, 'nope')).rejects.toThrow(
      'already been reviewed'
    );
  });
});
