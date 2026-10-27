/**
 * Every route that records a payment (card, bank transfer, a proof an officer approved) finishes with the same two steps, so none of
 * them can skip the member ledger or the books again: the credit on the ledger, and the books.
 */
const prismaMock: any = {
  payment: { findUnique: jest.fn(), findFirst: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
const createFromTransaction = jest.fn();
const createFromPayment = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({
  memberLedgerService: {
    createFromTransaction: (...a: any[]) => createFromTransaction(...a),
    createFromPayment: (...a: any[]) => createFromPayment(...a),
  },
}));
const onPaymentRecorded = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onPaymentRecorded: (...a: any[]) => onPaymentRecorded(...a) },
}));

import { syncPaymentEffects } from '../../src/services/payment-sync.service';

const payment = { id: 80, associationId: 1, transactionId: 70, transaction: { category: { type: 'donation' } } };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  prismaMock.payment.findUnique.mockResolvedValue(payment);
});

describe('syncPaymentEffects', () => {
  it('puts the charge and the payment on the member ledger and the payment in the books', async () => {
    await syncPaymentEffects({ paymentId: 80 }, 5);
    expect(createFromTransaction).toHaveBeenCalledWith(70, 5); // so a payment never lands alone as a credit
    expect(createFromPayment).toHaveBeenCalledWith(80, 5);
    expect(onPaymentRecorded).toHaveBeenCalledWith(payment, 5);
  });

  it('finds the payment by its receipt number when a gateway only gives that', async () => {
    prismaMock.payment.findFirst.mockResolvedValue({ id: 80 });
    await syncPaymentEffects({ receiptNumber: 'RCP-1', associationId: 1 }, 5);
    expect(prismaMock.payment.findFirst).toHaveBeenCalledWith({ where: { receiptNumber: 'RCP-1', associationId: 1 }, select: { id: true } });
    expect(createFromPayment).toHaveBeenCalledWith(80, 5);
  });

  it('still posts to the books when the ledger fails, and still credits the ledger when the books fail', async () => {
    createFromPayment.mockRejectedValueOnce(new Error('ledger down'));
    await expect(syncPaymentEffects({ paymentId: 80 }, 5)).resolves.toBeUndefined();
    expect(onPaymentRecorded).toHaveBeenCalledTimes(1);

    onPaymentRecorded.mockRejectedValueOnce(new Error('books down'));
    await expect(syncPaymentEffects({ paymentId: 80 }, 5)).resolves.toBeUndefined();
    expect(createFromPayment).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a payment that does not exist, and never throws', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);
    await expect(syncPaymentEffects({ paymentId: 999 }, 5)).resolves.toBeUndefined();
    expect(createFromPayment).not.toHaveBeenCalled();
    prismaMock.payment.findUnique.mockRejectedValue(new Error('db down'));
    await expect(syncPaymentEffects({ paymentId: 80 }, 5)).resolves.toBeUndefined();
  });
});
