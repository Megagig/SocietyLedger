/**
 * Undoing a delete brings back the payments and donation record that went with the charge, so a charge restored as "paid"
 * has its payments behind it, and the member's ledger and the books are brought up to date.
 */
const prismaMock: any = {
  payment: { create: jest.fn() },
  donationRecord: { create: jest.fn() },
  transaction: { findUnique: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
const syncPaymentEffects = jest.fn();
jest.mock('../../src/services/payment-sync.service', () => ({ syncPaymentEffects: (...a: unknown[]) => syncPaymentEffects(...a) }));
const onTransactionCreated = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onTransactionCreated: (...a: unknown[]) => onTransactionCreated(...a) } }));
const onPaymentChange = jest.fn();
jest.mock('../../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onPaymentChange: (...a: unknown[]) => onPaymentChange(...a) } }));
const syncLedgerDebit = jest.fn();
jest.mock('../../src/modules/finance/ledger-sync', () => ({ syncLedgerDebit: (...a: unknown[]) => syncLedgerDebit(...a) }));

import { paymentRestoreData, restoreChargeExtras } from '../../src/modules/finance/restore-rules';

const payment = { amountPaid: '5000', paymentDate: '2026-10-01T10:00:00.000Z', paymentMethod: 'cash', receiptNumber: 'RCP000004', confirmedBy: 3, confirmedAt: '2026-10-01T10:05:00.000Z' };

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.payment.create.mockResolvedValue({ id: 77 });
  prismaMock.transaction.findUnique.mockResolvedValue({ id: 40, category: { type: 'donation' } });
  onPaymentChange.mockResolvedValue(undefined);
});

describe('paymentRestoreData', () => {
  it('points the payment at the restored charge and turns its dates back into dates', () => {
    const data = paymentRestoreData(9, 40, payment);
    expect(data).toMatchObject({ associationId: 9, transactionId: 40, receiptNumber: 'RCP000004', paymentMethod: 'cash', confirmedBy: 3 });
    expect(data.paymentDate).toBeInstanceOf(Date);
    expect(data.confirmedAt).toBeInstanceOf(Date);
  });

  it('copes with a payment that was never confirmed', () => {
    expect(paymentRestoreData(9, 40, { amountPaid: '1', paymentDate: '2026-10-01T10:00:00.000Z' })).toMatchObject({ confirmedBy: null, confirmedAt: null, receiptNumber: null });
  });
});

describe('restoreChargeExtras', () => {
  it('re-creates each payment and the donation record, then puts the charge and its payments back on the ledger and in the books', async () => {
    await restoreChargeExtras(9, 40, { payments: [payment, { ...payment, receiptNumber: 'RCP000005' }], donationRecord: { receiptNumber: 'DON1', isAnonymous: true } }, 3);
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.donationRecord.create).toHaveBeenCalledWith({ data: expect.objectContaining({ transactionId: 40, receiptNumber: 'DON1', isAnonymous: true }) });
    expect(syncLedgerDebit).toHaveBeenCalledWith(40, 3);
    expect(onTransactionCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 40 }), 3);
    expect(syncPaymentEffects).toHaveBeenCalledTimes(2);
    expect(syncPaymentEffects).toHaveBeenCalledWith({ paymentId: 77 }, 3);
  });

  it('does nothing extra for a charge that had no payments', async () => {
    await restoreChargeExtras(9, 40, {}, 3);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
    expect(prismaMock.donationRecord.create).not.toHaveBeenCalled();
  });

  it('keeps going when the books are down', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    onTransactionCreated.mockRejectedValue(new Error('books down'));
    await expect(restoreChargeExtras(9, 40, { payments: [payment] }, 3)).resolves.toBeUndefined();
  });
});
