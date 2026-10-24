/**
 * The cooperative's money paths: a balance moves atomically and can't overdraw, a loan is disbursed once and to a real account, an
 * officer can't decide their own request, and a repayment can't exceed what is owed. Prisma is mocked.
 */
import { Decimal } from '@prisma/client/runtime/library';

const tx: any = {
  savingsAccount: { findFirst: jest.fn(), updateMany: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
  savingsTransaction: { create: jest.fn() },
  loanApplication: { updateMany: jest.fn() },
  loan: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  loanRepaymentSchedule: { createMany: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  loanRepayment: { create: jest.fn() },
  $queryRaw: jest.fn(),
};
const mockPrisma: any = {
  ...tx,
  loanApplication: { findFirst: jest.fn(), updateMany: jest.fn() },
  loan: { ...tx.loan, count: jest.fn() },
  savingsAccount: { ...tx.savingsAccount, count: jest.fn() },
  member: { findUnique: jest.fn() },
  savingsDepositRequest: { findFirst: jest.fn(), updateMany: jest.fn() },
  loanRepaymentRequest: { findFirst: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../src/services/notification-preferences.service', () => ({ dispatchNotification: jest.fn() }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));
const mockPosition = jest.fn();
jest.mock('../../src/modules/cooperatives/savings-lien', () => ({
  assertWithinSavingsRule: jest.fn(),
  createLienForLoan: jest.fn(),
  getSavingsPosition: (...a: any[]) => mockPosition(...a),
  maxBorrowableOnProduct: jest.fn(),
  releaseLienForRepayment: jest.fn(),
}));

import { cooperativesService } from '../../src/modules/cooperatives/cooperatives.service';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
  mockPosition.mockResolvedValue({ locked: new Decimal(0), available: new Decimal(100000) });
});

describe('processSavingsTransaction', () => {
  const account = (balance: number) => ({ id: 4, memberId: 3, status: 'ACTIVE', balance: new Decimal(balance) });

  it('a deposit moves the balance with an increment and records the balance read back afterwards', async () => {
    tx.savingsAccount.findFirst.mockResolvedValue(account(10000));
    tx.savingsAccount.updateMany.mockResolvedValue({ count: 1 });
    tx.savingsAccount.findUniqueOrThrow.mockResolvedValue({ balance: new Decimal(15000) });
    tx.savingsTransaction.create.mockImplementation(async ({ data }: any) => ({ id: 1, ...data, createdAt: new Date(), processor: { email: 'a@b.c' } }));

    await cooperativesService.processSavingsTransaction(1, 99, { savingsAccountId: 4, type: 'DEPOSIT', amount: 5000 } as any);

    const update = tx.savingsAccount.updateMany.mock.calls[0][0];
    expect(update.data.balance).toEqual({ increment: new Decimal(5000) });
    expect(update.data.totalDeposits).toEqual({ increment: new Decimal(5000) });
    expect(update.where.balance).toBeUndefined();
    expect(Number(tx.savingsTransaction.create.mock.calls[0][0].data.balanceAfter)).toBe(15000);
  });

  it('a withdrawal only goes through if the balance is still enough at the moment it is applied', async () => {
    tx.savingsAccount.findFirst.mockResolvedValue(account(10000));
    tx.savingsAccount.updateMany.mockResolvedValue({ count: 0 }); // someone else withdrew first
    await expect(
      cooperativesService.processSavingsTransaction(1, 99, { savingsAccountId: 4, type: 'WITHDRAWAL', amount: 8000 } as any),
    ).rejects.toMatchObject({ status: 409, code: 'INSUFFICIENT_BALANCE' });
    const update = tx.savingsAccount.updateMany.mock.calls[0][0];
    expect(update.where.balance).toEqual({ gte: new Decimal(8000) });
    expect(update.data.balance).toEqual({ decrement: new Decimal(8000) });
    expect(tx.savingsTransaction.create).not.toHaveBeenCalled();
  });

  it('refuses a withdrawal larger than the balance before touching anything', async () => {
    tx.savingsAccount.findFirst.mockResolvedValue(account(1000));
    await expect(
      cooperativesService.processSavingsTransaction(1, 99, { savingsAccountId: 4, type: 'WITHDRAWAL', amount: 2000 } as any),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(tx.savingsAccount.updateMany).not.toHaveBeenCalled();
  });

  it('refuses taking out savings that are held against a loan', async () => {
    tx.savingsAccount.findFirst.mockResolvedValue(account(50000));
    mockPosition.mockResolvedValue({ locked: new Decimal(40000), available: new Decimal(10000) });
    await expect(
      cooperativesService.processSavingsTransaction(1, 99, { savingsAccountId: 4, type: 'WITHDRAWAL', amount: 20000 } as any),
    ).rejects.toMatchObject({ status: 409, code: 'SAVINGS_HELD' });
    expect(tx.savingsAccount.updateMany).not.toHaveBeenCalled();
  });

  it('an unknown or closed account is a 404', async () => {
    tx.savingsAccount.findFirst.mockResolvedValue(null);
    await expect(
      cooperativesService.processSavingsTransaction(1, 99, { savingsAccountId: 4, type: 'DEPOSIT', amount: 1 } as any),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('disburseLoan', () => {
  const application = (over: object = {}) => ({
    id: 20, memberId: 3, status: 'APPROVED', amount: new Decimal(100000), processingFee: new Decimal(1000), interestRate: new Decimal(10),
    interestType: 'FLAT', tenureMonths: 12, monthlyRepayment: new Decimal(9166), totalRepayment: new Decimal(110000), totalInterest: new Decimal(10000),
    loanProductId: 2, loanProduct: { lockSavings: false }, member: { firstName: 'Ada', lastName: 'Obi', memberId: 'M3', userId: 30 }, ...over,
  });

  it('refuses an application that was already disbursed, or is not approved', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(application({ status: 'DISBURSED' }));
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'bank_transfer')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DISBURSED' });
    mockPrisma.loanApplication.findFirst.mockResolvedValue(application({ status: 'PENDING_REVIEW' }));
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'bank_transfer')).rejects.toMatchObject({ code: 'NOT_APPROVED' });
  });

  it('an officer cannot pay out their own loan', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(application());
    await expect(cooperativesService.disburseLoan(1, 20, 30, 'bank_transfer')).rejects.toMatchObject({ status: 403, code: 'OWN_REQUEST' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('crediting savings needs an open account of the borrower, or nothing is created', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(application());
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'savings_credit')).rejects.toMatchObject({ code: 'SAVINGS_ACCOUNT_REQUIRED' });
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({ memberId: 77, status: 'ACTIVE' }); // someone else's account
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'savings_credit', { savingsAccountId: 5 })).rejects.toMatchObject({ code: 'DISBURSE_ACCOUNT_INVALID' });
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({ memberId: 3, status: 'CLOSED' });
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'savings_credit', { savingsAccountId: 5 })).rejects.toMatchObject({ code: 'DISBURSE_ACCOUNT_INVALID' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('only one disbursement can win the claim: the second finds it already taken and creates no loan', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(application());
    mockPrisma.loan.count.mockResolvedValue(0);
    tx.loanApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(cooperativesService.disburseLoan(1, 20, 99, 'bank_transfer')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DISBURSED' });
    expect(tx.loan.create).not.toHaveBeenCalled();
    const claim = tx.loanApplication.updateMany.mock.calls[0][0];
    expect(claim.where).toMatchObject({ id: 20, status: 'APPROVED' });
  });
});

describe('reviewLoanApplication', () => {
  const pending = (over: object = {}) => ({ id: 20, memberId: 3, status: 'PENDING_REVIEW', loanProduct: { requiresGuarantor: false }, guarantors: [], amount: new Decimal(1000), ...over });

  it('an officer cannot review their own application', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(pending());
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 99 });
    await expect(cooperativesService.reviewLoanApplication(1, 20, 99, 'approve')).rejects.toMatchObject({ status: 403, code: 'OWN_REQUEST' });
    expect(mockPrisma.loanApplication.updateMany).not.toHaveBeenCalled();
  });

  it('two officers deciding at once cannot both win: the second is told it was just decided', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(pending());
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 30 });
    mockPrisma.loanApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(cooperativesService.reviewLoanApplication(1, 20, 99, 'reject', 'no', 'Not eligible')).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
    expect(mockPrisma.loanApplication.updateMany.mock.calls[0][0].where.status).toEqual({ in: ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'] });
  });

  it('an application already decided cannot be reviewed again', async () => {
    mockPrisma.loanApplication.findFirst.mockResolvedValue(pending({ status: 'APPROVED' }));
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 30 });
    await expect(cooperativesService.reviewLoanApplication(1, 20, 99, 'reject', undefined, 'x')).rejects.toMatchObject({ status: 409, code: 'NOT_REVIEWABLE' });
  });
});

describe('deciding a member request', () => {
  it('an officer cannot approve or reject their own deposit', async () => {
    mockPrisma.savingsDepositRequest.findFirst.mockResolvedValue({ memberId: 3 });
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 99 });
    await expect(cooperativesService.approveSavingsDepositRequest(1, 5, 99)).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    await expect(cooperativesService.rejectSavingsDepositRequest(1, 5, 99, 'no')).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    expect(mockPrisma.savingsDepositRequest.updateMany).not.toHaveBeenCalled();
  });

  it('an officer cannot approve or reject their own repayment', async () => {
    mockPrisma.loanRepaymentRequest.findFirst.mockResolvedValue({ memberId: 3 });
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 99 });
    await expect(cooperativesService.approveLoanRepaymentRequest(1, 5, 99)).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    await expect(cooperativesService.rejectLoanRepaymentRequest(1, 5, 99, 'no')).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    expect(mockPrisma.loanRepaymentRequest.updateMany).not.toHaveBeenCalled();
  });

  it('another officer can decide it, and an already-decided request is a 409', async () => {
    mockPrisma.savingsDepositRequest.findFirst.mockResolvedValue({ memberId: 3 });
    mockPrisma.member.findUnique.mockResolvedValue({ userId: 30 });
    mockPrisma.savingsDepositRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(cooperativesService.approveSavingsDepositRequest(1, 5, 99)).rejects.toMatchObject({ status: 409, code: 'ALREADY_DECIDED' });
  });
});

describe('processLoanRepayment', () => {
  const loan = (outstanding: number) => ({
    id: 8, status: 'ACTIVE', outstandingBalance: new Decimal(outstanding), totalPaid: new Decimal(0), principalPaid: new Decimal(0), interestPaid: new Decimal(0),
    principalAmount: new Decimal(100000), repaymentSchedule: [], loanProduct: {},
  });

  it('takes a lock on the loan, and refuses more than is owed before recording anything', async () => {
    tx.loan.findFirst.mockResolvedValue(loan(50000));
    await expect(cooperativesService.processLoanRepayment(1, 99, { loanId: 8, amount: 60000, paymentMethod: 'cash' } as any)).rejects.toMatchObject({
      status: 400,
      code: 'REPAYMENT_TOO_LARGE',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.loanRepayment.create).not.toHaveBeenCalled();
  });

  it('a loan that is not active is a 404', async () => {
    tx.loan.findFirst.mockResolvedValue(null);
    await expect(cooperativesService.processLoanRepayment(1, 99, { loanId: 8, amount: 1, paymentMethod: 'cash' } as any)).rejects.toMatchObject({ status: 404, code: 'LOAN_NOT_FOUND' });
  });
});
