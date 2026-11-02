import { collectionsApi } from './collections';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({ client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('collections', () => {
  it("reads a member's open debts", async () => {
    mockGet.mockReturnValue(ok({ charges: [] }));
    await collectionsApi.getOpenCharges(9);
    expect(mockGet).toHaveBeenCalledWith('/finance/collections/members/9/open-charges');
  });

  it('records several debts in one call and returns a receipt for each', async () => {
    mockPost.mockReturnValue(ok({ payments: [{ paymentId: 1, receiptNumber: 'RCP000001-1' }, { paymentId: 2, receiptNumber: 'RCP000002-1' }] }));
    const saved = await collectionsApi.recordPayments({
      items: [{ transactionId: 1, amountPaid: 3000 }, { transactionId: 2, amountPaid: 2000 }],
      paymentMethod: 'cash',
      source: 'member-ledger',
    });
    expect(mockPost).toHaveBeenCalledWith('/finance/payments/batch', expect.objectContaining({ paymentMethod: 'cash', source: 'member-ledger' }));
    expect(saved.map((p) => p.receiptNumber)).toEqual(['RCP000001-1', 'RCP000002-1']);
  });

  it('asks for the file with exactly the filter and search, leaving out what is empty', async () => {
    const bytes = new ArrayBuffer(4);
    mockGet.mockReturnValue(Promise.resolve({ data: bytes }));
    const file = await collectionsApi.exportFile({ screen: 'levy-campaign', format: 'pdf', status: 'owing', search: '', id: 11 });
    expect(file).toBe(bytes);
    expect(mockGet).toHaveBeenCalledWith('/finance/collections/export', expect.objectContaining({ params: { screen: 'levy-campaign', format: 'pdf', status: 'owing', id: 11 }, responseType: 'arraybuffer' }));
  });
});
