/**
 * Every route that records a payment (card webhooks, Nomba, cash, an approved proof) ends in syncPaymentEffects. It must clear the cached
 * dashboard and reports for that association, and a cache that fails must never stop the ledger and the books from being updated.
 */
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockLedgerTxn = jest.fn(async () => undefined);
const mockLedgerPay = jest.fn(async () => undefined);
const mockBooks = jest.fn(async () => undefined);
const mockOnPaymentChange = jest.fn(async (_associationId: number) => undefined);

jest.mock('../src/lib/prisma', () => ({ prisma: { payment: { findFirst: (...a: unknown[]) => mockFindFirst(...a), findUnique: (...a: unknown[]) => mockFindUnique(...a) } } }));
jest.mock('../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createFromTransaction: mockLedgerTxn, createFromPayment: mockLedgerPay } }));
jest.mock('../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onPaymentRecorded: mockBooks } }));
jest.mock('../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onPaymentChange: (id: number) => mockOnPaymentChange(id) } }));

import { syncPaymentEffects } from '../src/services/payment-sync.service';

const payment = { id: 5, transactionId: 9, associationId: 42 };

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue(payment);
  mockFindFirst.mockResolvedValue({ id: 5 });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('after a payment is recorded', () => {
  it('clears the cached dashboard and reports of that association, once the ledger and the books are updated', async () => {
    await syncPaymentEffects({ paymentId: 5 }, 1);
    expect(mockLedgerPay).toHaveBeenCalledTimes(1);
    expect(mockBooks).toHaveBeenCalledTimes(1);
    expect(mockOnPaymentChange).toHaveBeenCalledWith(42);
  });

  it('does so when the webhook only knows the receipt number', async () => {
    await syncPaymentEffects({ receiptNumber: 'RCP-1', associationId: 42 }, 1);
    expect(mockOnPaymentChange).toHaveBeenCalledWith(42);
  });

  it('still updates the ledger and the books when clearing the cache fails', async () => {
    mockOnPaymentChange.mockRejectedValueOnce(new Error('redis down'));
    await expect(syncPaymentEffects({ paymentId: 5 }, 1)).resolves.toBeUndefined();
    expect(mockLedgerPay).toHaveBeenCalledTimes(1);
    expect(mockBooks).toHaveBeenCalledTimes(1);
  });

  it('clears the cache even when the books could not be updated', async () => {
    mockBooks.mockRejectedValueOnce(new Error('books unavailable'));
    await syncPaymentEffects({ paymentId: 5 }, 1);
    expect(mockOnPaymentChange).toHaveBeenCalledWith(42);
  });

  it('does nothing for a payment that cannot be found', async () => {
    mockFindFirst.mockResolvedValue(null);
    await syncPaymentEffects({ receiptNumber: 'NOPE', associationId: 42 }, 1);
    expect(mockOnPaymentChange).not.toHaveBeenCalled();
  });
});
