/**
 * A member's loan repayment is only a request until an officer confirms the money arrived. These cover the rules
 * that matter: only your own open loan, never more than you owe, nothing is recorded until approval (and only
 * once), and a failed recording puts the request back in the queue. Prisma is mocked.
 */
const mockPrisma = {
  loan: { findFirst: jest.fn() },
  associationBankAccount: { findFirst: jest.fn() },
  loanRepaymentRequest: {
    findFirst: jest.fn(async () => null), // the self-decision check finds nothing to compare, so the claim below answers
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirstOrThrow: jest.fn(),
  },
  member: { findUnique: jest.fn() },
  notification: { create: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
const mockDispatch = jest.fn();
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: (...args: unknown[]) => mockDispatch(...args) }));

jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));

import { Decimal } from '@prisma/client/runtime/library';
import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

const openLoan = { id: 3, memberId: 70, outstandingBalance: new Decimal('120000.00') };

const pendingRow = {
  id: 8,
  associationId: 15,
  loanId: 3,
  memberId: 70,
  amount: new Decimal('50000.00'),
  reference: null,
  rejectionReason: null,
};

let processSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  processSpy = jest.spyOn(cooperativesService, 'processLoanRepayment').mockResolvedValue({ id: 501 } as never);
  mockPrisma.loan.findFirst.mockResolvedValue(openLoan);
  mockPrisma.loanRepaymentRequest.findFirstOrThrow.mockResolvedValue(pendingRow);
  mockPrisma.loanRepaymentRequest.update.mockResolvedValue({});
  mockPrisma.member.findUnique.mockResolvedValue({ userId: 7 });
  mockPrisma.notification.create.mockResolvedValue({});
});

afterEach(() => processSpy.mockRestore());

describe('createLoanRepaymentRequest', () => {
  const input = { loanId: 3, amount: 50000, paymentDate: new Date() };
  const receipt = { filename: 'r.png', filepath: 'loan-repayments/15/x.png' };

  it("only accepts the member's own open loan", async () => {
    mockPrisma.loan.findFirst.mockResolvedValue(null);

    await expect(cooperativesService.createLoanRepaymentRequest(15, 70, input, receipt)).rejects.toThrow(
      'Active loan not found'
    );

    expect(mockPrisma.loan.findFirst).toHaveBeenCalledWith({
      where: { id: 3, associationId: 15, memberId: 70, status: { in: ['ACTIVE', 'OVERDUE'] } },
    });
    expect(mockPrisma.loanRepaymentRequest.create).not.toHaveBeenCalled();
  });

  it('refuses more than the member still owes', async () => {
    await expect(
      cooperativesService.createLoanRepaymentRequest(15, 70, { ...input, amount: 120000.01 }, receipt)
    ).rejects.toThrow(/more than you still owe/);
  });

  it('creates a PENDING request and records nothing', async () => {
    mockPrisma.loanRepaymentRequest.create.mockResolvedValue({
      ...pendingRow,
      status: 'PENDING',
      paymentDate: new Date(),
      filename: 'r.png',
      filepath: 'k',
      createdAt: new Date(),
    });

    const result = await cooperativesService.createLoanRepaymentRequest(15, 70, input, receipt);

    expect(result.status).toBe('PENDING');
    expect(processSpy).not.toHaveBeenCalled();
  });

  it('rejects an unknown bank account', async () => {
    mockPrisma.associationBankAccount.findFirst.mockResolvedValue(null);

    await expect(
      cooperativesService.createLoanRepaymentRequest(15, 70, { ...input, bankAccountId: 99 }, receipt)
    ).rejects.toThrow('Bank account not found');
  });
});

describe('approveLoanRepaymentRequest', () => {
  it('records the repayment once, as a BANK_TRANSFER, then links it', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.approveLoanRepaymentRequest(15, 8, 2);

    expect(processSpy).toHaveBeenCalledTimes(1);
    expect(processSpy).toHaveBeenCalledWith(
      15,
      2,
      expect.objectContaining({ loanId: 3, amount: 50000, paymentMethod: 'BANK_TRANSFER' })
    );
    expect(mockPrisma.loanRepaymentRequest.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { loanRepaymentId: 501 },
    });
  });

  it('refuses a request that was already reviewed, without recording again', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(cooperativesService.approveLoanRepaymentRequest(15, 8, 2)).rejects.toThrow('already been reviewed');

    expect(processSpy).not.toHaveBeenCalled();
  });

  it('only claims a PENDING request in the same association', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.approveLoanRepaymentRequest(15, 8, 2);

    expect(mockPrisma.loanRepaymentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8, associationId: 15, status: 'PENDING' } })
    );
  });

  it('puts the request back in the queue if the loan was paid down below the amount meanwhile', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.loan.findFirst.mockResolvedValue({ ...openLoan, outstandingBalance: new Decimal('20000.00') });

    await expect(cooperativesService.approveLoanRepaymentRequest(15, 8, 2)).rejects.toThrow(/more than you still owe/);

    expect(processSpy).not.toHaveBeenCalled();
    expect(mockPrisma.loanRepaymentRequest.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
  });

  it('puts the request back in the queue if recording fails', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });
    processSpy.mockRejectedValue(new Error('Active loan not found'));

    await expect(cooperativesService.approveLoanRepaymentRequest(15, 8, 2)).rejects.toThrow('Active loan not found');

    expect(mockPrisma.loanRepaymentRequest.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: 'PENDING', reviewedBy: null, reviewedAt: null },
    });
  });

  it("tells the member, and a notification failure doesn't fail the approval", async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });
    mockDispatch.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(cooperativesService.approveLoanRepaymentRequest(15, 8, 2)).resolves.toBeDefined();

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, kind: 'system', pushType: 'loan.repayment_decision', entityId: 8 })
    );
    errorSpy.mockRestore();
  });
});

describe('rejectLoanRepaymentRequest', () => {
  it('records the reason and never records a repayment', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 1 });

    await cooperativesService.rejectLoanRepaymentRequest(15, 8, 2, 'No matching credit on the statement');

    expect(processSpy).not.toHaveBeenCalled();
    expect(mockPrisma.loanRepaymentRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, associationId: 15, status: 'PENDING' },
        data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'No matching credit on the statement' }),
      })
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ pushType: 'loan.repayment_decision', title: 'Loan repayment not approved' })
    );
  });

  it('refuses a request that was already reviewed', async () => {
    mockPrisma.loanRepaymentRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(cooperativesService.rejectLoanRepaymentRequest(15, 8, 2, 'nope')).rejects.toThrow(
      'already been reviewed'
    );
  });
});
