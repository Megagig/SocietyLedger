/** Which endpoint a proof or a statement comes from, since the screens no longer talk to the API themselves. */
const mockPaymentReceipt = jest.fn();
const mockRepaymentReceipt = jest.fn();
const mockCashbookPdf = jest.fn();
const mockShare = jest.fn();

jest.mock('@/api/endpoints/coopEnhanced', () => ({
  coopEnhancedApi: { getPaymentReceiptUrl: (...a: unknown[]) => mockPaymentReceipt(...a), getCashbookPdf: (...a: unknown[]) => mockCashbookPdf(...a) },
}));
jest.mock('@/api/endpoints/loans', () => ({ loansApi: { getRepaymentRequestReceiptUrl: (...a: unknown[]) => mockRepaymentReceipt(...a) } }));
jest.mock('@/features/ajo/shareFile', () => ({ PDF_MIME: 'application/pdf', saveAndShareFile: (...a: unknown[]) => mockShare(...a) }));
jest.mock('@/hooks/useMemberId', () => ({ useMemberId: () => 1 }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleAccess: () => true }));
jest.mock('@/hooks/useTenantKey', () => ({ useTenantKey: () => 't' }));
jest.mock('@/lib/permissions', () => ({ COOPERATIVE_OWN_PAGES_ACCESS: [], COOPERATIVE_WITHDRAW_ACCESS: [], COOPERATIVE_WITHDRAWAL_QUEUE_ACCESS: [] }));

import { loadPaymentProof, loadPendingProof, shareCashbookPdf } from './queries';

beforeEach(() => jest.clearAllMocks());

describe('proofs', () => {
  it('opens a savings payment from the payment-request receipt, and a loan repayment from the loan one', async () => {
    mockPaymentReceipt.mockResolvedValue({ url: 'https://files/a' });
    mockRepaymentReceipt.mockResolvedValue({ url: 'https://files/b' });
    await expect(loadPendingProof({ kind: 'SAVINGS', id: 5 })).resolves.toEqual({ url: 'https://files/a' });
    await expect(loadPendingProof({ kind: 'LOAN_REPAYMENT', id: 6 })).resolves.toEqual({ url: 'https://files/b' });
    expect(mockPaymentReceipt).toHaveBeenCalledWith(5);
    expect(mockRepaymentReceipt).toHaveBeenCalledWith(6);
    await loadPaymentProof(9);
    expect(mockPaymentReceipt).toHaveBeenLastCalledWith(9);
  });
});

describe('cashbook PDF', () => {
  it('asks the server for the statement and hands it to the share sheet as a PDF', async () => {
    const bytes = new ArrayBuffer(8);
    mockCashbookPdf.mockResolvedValue(bytes);
    await shareCashbookPdf({ from: '2026-01-01' }, 42, 'member-cashbook');
    expect(mockCashbookPdf).toHaveBeenCalledWith({ from: '2026-01-01' }, 42);
    expect(mockShare).toHaveBeenCalledWith('member-cashbook.pdf', bytes, 'application/pdf');
  });

  it('does not add .pdf twice', async () => {
    mockCashbookPdf.mockResolvedValue(new ArrayBuffer(1));
    await shareCashbookPdf({}, undefined, 'my-cashbook.pdf');
    expect(mockShare).toHaveBeenCalledWith('my-cashbook.pdf', expect.anything(), 'application/pdf');
  });
});
