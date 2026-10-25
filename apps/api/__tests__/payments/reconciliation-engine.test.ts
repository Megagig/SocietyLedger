/**
 * Proposing, confirming and disputing a match. These guard the bugs this replaced: a match that recorded ₦0.00 and marked the charge
 * paid, one bank line paying several charges, a charge filled twice, and a disputed match leaving its line stuck.
 */
const tx: any = {
  $queryRaw: jest.fn(),
  transaction: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  bankStatementEntry: { findFirst: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
  bankTransfer: { findFirst: jest.fn(), updateMany: jest.fn() },
  paymentReconciliation: { findFirst: jest.fn(), aggregate: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  payment: { count: jest.fn(), create: jest.fn() },
  levyCampaignAssignment: { updateMany: jest.fn() },
};
const mockPrisma: any = { ...tx, $transaction: jest.fn(async (fn: any) => fn(tx)) };
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, prisma: mockPrisma, default: mockPrisma }));
const onPaymentRecorded = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onPaymentRecorded: (...a: unknown[]) => onPaymentRecorded(...a) } }));
const createFromPayment = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createFromPayment: (...a: unknown[]) => createFromPayment(...a) } }));
jest.mock('../../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onPaymentChange: jest.fn(async () => undefined) } }));

import { Decimal } from '@prisma/client/runtime/library';
import { confirmMatch, disputeMatch, proposeMatch } from '../../src/modules/nigerian-payments/reconciliation-engine';

const d = (n: number) => new Decimal(n);
const charge = (over: object = {}) => ({
  id: 8, amount: d(10000), status: 'pending', isVoided: false, member: { id: 1, status: 'active', firstName: 'Ada', lastName: 'Obi' }, payments: [], ...over,
});
const entry = (over: object = {}) => ({ id: 21, creditAmount: d(10000), debitAmount: null, transactionDate: new Date('2026-10-05T23:00:00Z'), ...over });

beforeEach(() => {
  jest.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ id: 8 }]);
  tx.transaction.findUniqueOrThrow.mockResolvedValue(charge());
  tx.paymentReconciliation.aggregate.mockResolvedValue({ _sum: { matchedAmount: null } });
  tx.paymentReconciliation.create.mockImplementation(async ({ data }: any) => ({ id: 3, ...data }));
  tx.bankStatementEntry.findFirst.mockResolvedValue(entry());
  tx.bankStatementEntry.updateMany.mockResolvedValue({ count: 1 });
  tx.bankTransfer.updateMany.mockResolvedValue({ count: 1 });
  tx.payment.count.mockResolvedValue(4);
  tx.payment.create.mockResolvedValue({ id: 70, receiptNumber: 'RCP000005' });
  tx.paymentReconciliation.updateMany.mockResolvedValue({ count: 1 });
});

describe('proposing a match', () => {
  it("records the bank line's own amount, never a typed one, and holds the line", async () => {
    const result = await proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'AUTO_REFERENCE' });
    expect(result.matchedAmount.toString()).toBe('10000');
    expect(result.status).toBe('PENDING');
    expect(result.createdBy).toBe(9);
    expect(tx.bankStatementEntry.updateMany.mock.calls[0][0].where).toEqual({ id: 21, matchStatus: 'UNMATCHED' });
  });

  it('refuses a line that is already matched, so one bank line can not pay two charges', async () => {
    tx.bankStatementEntry.updateMany.mockResolvedValue({ count: 0 });
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'ALREADY_MATCHED' });
    expect(tx.paymentReconciliation.create).not.toHaveBeenCalled();
  });

  it('refuses money going out', async () => {
    tx.bankStatementEntry.findFirst.mockResolvedValue(entry({ creditAmount: null, debitAmount: d(500) }));
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'ENTRY_NOT_CREDIT' });
  });

  it('refuses a line bigger than what the charge still owes, counting matches already waiting', async () => {
    tx.paymentReconciliation.aggregate.mockResolvedValue({ _sum: { matchedAmount: d(6000) } });
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'LINE_TOO_LARGE' });
  });

  it('refuses a cancelled, waived or disabled-member charge', async () => {
    tx.transaction.findUniqueOrThrow.mockResolvedValue(charge({ isVoided: true }));
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'CHARGE_NOT_OPEN' });
  });

  it("a charge in another association, or a line in another association, is not found", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(proposeMatch(1, 9, { transactionId: 99, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'CHARGE_NOT_FOUND' });
    tx.$queryRaw.mockResolvedValue([{ id: 8 }]);
    tx.bankStatementEntry.findFirst.mockResolvedValue(null);
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
    expect(tx.bankStatementEntry.findFirst.mock.calls[0][0].where).toEqual({ id: 21, import: { associationId: 1 } });
  });

  it('needs exactly one bank line or declared transfer', async () => {
    await expect(proposeMatch(1, 9, { transactionId: 8, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'ONE_SOURCE' });
    await expect(proposeMatch(1, 9, { transactionId: 8, statementEntryId: 1, bankTransferId: 2, matchType: 'MANUAL' })).rejects.toMatchObject({ code: 'ONE_SOURCE' });
  });

  it("matches a verified declared transfer the same way, in the association's own transfers only", async () => {
    tx.bankTransfer.findFirst.mockResolvedValue({ id: 5, amount: d(10000), status: 'VERIFIED', reconciliationId: null });
    const result = await proposeMatch(1, 9, { transactionId: 8, bankTransferId: 5, matchType: 'AUTO_AMOUNT' });
    expect(result.matchedAmount.toString()).toBe('10000');
    expect(tx.bankTransfer.findFirst.mock.calls[0][0].where).toEqual({ id: 5, associationId: 1 });
    expect(tx.bankTransfer.updateMany.mock.calls[0][0].where).toMatchObject({ id: 5, associationId: 1, status: 'VERIFIED', reconciliationId: null });
  });
});

describe('confirming a match', () => {
  const pending = (over: object = {}) => ({ id: 3, transactionId: 8, statementEntryId: 21, matchedAmount: d(10000), status: 'PENDING', createdBy: 9, ...over });
  beforeEach(() => {
    tx.paymentReconciliation.findFirst.mockResolvedValue(pending());
    tx.paymentReconciliation.aggregate.mockResolvedValue({ _sum: { matchedAmount: d(10000) } }); // itself
    tx.bankStatementEntry.findUnique.mockResolvedValue(entry());
    tx.bankTransfer.findFirst.mockResolvedValue(null);
  });

  it('records one payment for the amount the bank received, dated the day it arrived, and marks the charge paid', async () => {
    const result = await confirmMatch(3, 1, 12);
    const data = tx.payment.create.mock.calls[0][0].data;
    expect(data.amountPaid.toString()).toBe('10000');
    expect(data.paymentDate).toEqual(new Date('2026-10-05T23:00:00Z'));
    expect(data.confirmedBy).toBe(12);
    expect(tx.transaction.update.mock.calls[0][0].data.status).toBe('paid');
    expect(result).toMatchObject({ chargeStatus: 'paid', amount: '10000.00' });
    expect(onPaymentRecorded).toHaveBeenCalledTimes(1);
    expect(createFromPayment).toHaveBeenCalledWith(70, 12);
  });

  it('a payment smaller than the charge makes it part paid, not paid', async () => {
    tx.paymentReconciliation.findFirst.mockResolvedValue(pending({ matchedAmount: d(4000) }));
    tx.paymentReconciliation.aggregate.mockResolvedValue({ _sum: { matchedAmount: d(4000) } });
    const result = await confirmMatch(3, 1, 12);
    expect(result.chargeStatus).toBe('partial');
    expect(tx.transaction.update.mock.calls[0][0].data.status).toBe('partial');
    expect(tx.levyCampaignAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('the officer who proposed it cannot confirm it, and nothing is recorded', async () => {
    await expect(confirmMatch(3, 1, 9)).rejects.toMatchObject({ code: 'OWN_MATCH' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('a match decided already, or decided at the same moment by someone else, records nothing', async () => {
    tx.paymentReconciliation.findFirst.mockResolvedValue(pending({ status: 'CONFIRMED' }));
    await expect(confirmMatch(3, 1, 12)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
    tx.paymentReconciliation.findFirst.mockResolvedValue(pending());
    tx.paymentReconciliation.updateMany.mockResolvedValue({ count: 0 });
    await expect(confirmMatch(3, 1, 12)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('refuses a match with no amount, which used to record ₦0.00 and mark the charge paid', async () => {
    tx.paymentReconciliation.findFirst.mockResolvedValue(pending({ matchedAmount: d(0) }));
    await expect(confirmMatch(3, 1, 12)).rejects.toMatchObject({ code: 'NO_AMOUNT' });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('refuses if the charge was cancelled or paid some other way since it was matched, and says to dispute', async () => {
    tx.transaction.findUniqueOrThrow.mockResolvedValue(charge({ isVoided: true }));
    await expect(confirmMatch(3, 1, 12)).rejects.toMatchObject({ code: 'CHARGE_CHANGED', message: expect.stringContaining('Dispute') });
    tx.transaction.findUniqueOrThrow.mockResolvedValue(charge({ payments: [{ amountPaid: d(7000) }] }));
    await expect(confirmMatch(3, 1, 12)).rejects.toMatchObject({ code: 'CHARGE_CHANGED' });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('a failure in accounting does not undo the confirmation', async () => {
    onPaymentRecorded.mockRejectedValueOnce(new Error('accounting down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(confirmMatch(3, 1, 12)).resolves.toMatchObject({ chargeStatus: 'paid' });
  });
});

describe('disputing a match', () => {
  it('releases the bank line and the declared transfer so they can be matched again', async () => {
    tx.paymentReconciliation.findFirst.mockResolvedValue({ id: 3, statementEntryId: 21, status: 'PENDING' });
    tx.paymentReconciliation.findUniqueOrThrow.mockResolvedValue({ id: 3, status: 'DISPUTED' });
    await disputeMatch(3, 1, 9, 'wrong member');
    expect(tx.bankStatementEntry.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 21 }, data: { matchStatus: 'UNMATCHED', matchedTransactionId: null } });
    expect(tx.bankTransfer.updateMany.mock.calls[0][0]).toMatchObject({ data: { status: 'VERIFIED', reconciliationId: null } });
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it('a match that is already decided can not be disputed', async () => {
    tx.paymentReconciliation.findFirst.mockResolvedValue({ id: 3, statementEntryId: 21, status: 'CONFIRMED' });
    tx.paymentReconciliation.updateMany.mockResolvedValue({ count: 0 });
    await expect(disputeMatch(3, 1, 9)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
    expect(tx.bankStatementEntry.updateMany).not.toHaveBeenCalled();
  });
});
