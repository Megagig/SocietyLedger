/**
 * A reconciliation is decided once. Confirming it twice must not record the payment twice, and a disputed one cannot be
 * confirmed afterwards.
 */
const prismaMock: any = {
  paymentReconciliation: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  transaction: { update: jest.fn() },
  payment: { count: jest.fn(async () => 0), create: jest.fn(async () => ({ id: 1 })) },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onPaymentRecorded: jest.fn() } }));
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createFromPayment: jest.fn() } }));

import { nigerianPaymentsService, ReconciliationDecisionError } from '../../src/modules/nigerian-payments/nigerian-payments.service';

const reconciliation = { id: 3, transactionId: 8, matchedAmount: 5000, transaction: {} };

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.paymentReconciliation.findUniqueOrThrow.mockResolvedValue(reconciliation);
});

describe('confirmReconciliation', () => {
  it('claims only a PENDING reconciliation in the caller\'s association, then records the payment once', async () => {
    prismaMock.paymentReconciliation.updateMany.mockResolvedValue({ count: 1 });
    await nigerianPaymentsService.confirmReconciliation(3, 9, 5, 'CONFIRMED');
    expect(prismaMock.paymentReconciliation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3, associationId: 9, status: 'PENDING' } }),
    );
    expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
  });

  it('records nothing and refuses when it was already decided', async () => {
    prismaMock.paymentReconciliation.updateMany.mockResolvedValue({ count: 0 });
    await expect(nigerianPaymentsService.confirmReconciliation(3, 9, 5, 'CONFIRMED')).rejects.toBeInstanceOf(ReconciliationDecisionError);
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
  });

  it('records no payment when it is disputed', async () => {
    prismaMock.paymentReconciliation.updateMany.mockResolvedValue({ count: 1 });
    await nigerianPaymentsService.confirmReconciliation(3, 9, 5, 'DISPUTED', 'wrong amount');
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});
