import { cashApi } from './cash';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('cashApi', () => {
  it('loads the overview, collections and one collection', async () => {
    mockGet.mockReturnValue(ok({}));

    await cashApi.getOverview();
    await cashApi.listCollections({ status: 'OPEN', page: 1, limit: 20 });
    await cashApi.getCollection(4);

    expect(mockGet).toHaveBeenNthCalledWith(1, '/cash/overview');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/cash/collections', { params: { status: 'OPEN', page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/cash/collections/4');
  });

  it('opens and closes a collection', async () => {
    mockPost.mockReturnValue(ok({ id: 4 }));

    await cashApi.createCollection({ title: 'October meeting', meetingId: null });
    await cashApi.closeCollection(4);

    expect(mockPost).toHaveBeenNthCalledWith(1, '/cash/collections', { title: 'October meeting', meetingId: null });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/cash/collections/4/close');
  });

  it('asks what a member could pay, then records the receipt with its idempotency key', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({ id: 8 }));

    await cashApi.getPayables(7);
    await cashApi.recordReceipt(4, { memberId: 7, idempotencyKey: 'abc-123', items: [{ kind: 'DUES', targetId: 100, amount: 6000 }] });

    expect(mockGet).toHaveBeenCalledWith('/cash/payables', { params: { memberId: 7 } });
    expect(mockPost).toHaveBeenCalledWith('/cash/collections/4/receipts', {
      memberId: 7,
      idempotencyKey: 'abc-123',
      items: [{ kind: 'DUES', targetId: 100, amount: 6000 }],
    });
  });

  it('voids a receipt with a reason', async () => {
    mockPost.mockReturnValue(ok(undefined));
    await cashApi.voidReceipt(8, 'Wrong member');
    expect(mockPost).toHaveBeenCalledWith('/cash/receipts/8/void', { reason: 'Wrong member' });
  });

  it('sends a lodgment as multipart with the slip under "slip"', async () => {
    mockPost.mockReturnValue(ok({ id: 5 }));
    const append = jest.spyOn(FormData.prototype, 'append');

    await cashApi.recordLodgment({
      bankAccountId: 3,
      amount: 8500,
      depositDate: '2026-10-22T00:00:00.000Z',
      bankReference: 'TLR-1',
      shortfallReason: 'Refreshments',
      collectionIds: [4, 5],
      slip: { uri: 'file:///slip.jpg', name: 'slip.jpg', type: 'image/jpeg' },
    });

    const fields = Object.fromEntries(append.mock.calls.map(([key, value]) => [key, value]));
    expect(fields).toMatchObject({ bankAccountId: '3', amount: '8500', bankReference: 'TLR-1', shortfallReason: 'Refreshments', collectionIds: '4,5' });
    expect(fields.slip).toEqual({ uri: 'file:///slip.jpg', name: 'slip.jpg', type: 'image/jpeg' });
    expect(mockPost.mock.calls[0][0]).toBe('/cash/lodgments');
    expect(mockPost.mock.calls[0][2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    append.mockRestore();
  });

  it('lists lodgments, opens one with its slip link, and decides it once', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({ id: 5 }));

    await cashApi.listLodgments({ status: 'PENDING', page: 1, limit: 20 });
    await cashApi.getLodgment(5);
    await cashApi.getSlipLink(5);
    await cashApi.decideLodgment(5, { status: 'REJECTED', reason: 'Not on the statement' });

    expect(mockGet).toHaveBeenNthCalledWith(1, '/cash/lodgments', { params: { status: 'PENDING', page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/cash/lodgments/5');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/cash/lodgments/5/slip-url');
    expect(mockPost).toHaveBeenCalledWith('/cash/lodgments/5/decision', { status: 'REJECTED', reason: 'Not on the statement' });
  });
});
