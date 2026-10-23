const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

import { bankManageApi } from './bankManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('bankManageApi transfers', () => {
  it('lists one status of transfers a page at a time, with an optional search', async () => {
    mockGet.mockReturnValue(ok({ transfers: [], pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0, hasMore: false } }));

    await bankManageApi.listTransfers({ status: 'PENDING', search: 'trf', page: 1, limit: 20 });

    expect(mockGet).toHaveBeenCalledWith('/payments/nigerian/bank-transfers', { params: { status: 'PENDING', search: 'trf', page: 1, limit: 20 } });
  });

  it('records, edits and decides a transfer', async () => {
    mockPost.mockReturnValue(ok({ id: 31 }));
    mockPatch.mockReturnValue(ok({ id: 31 }));

    await bankManageApi.recordTransfer({ senderBankName: 'Access Bank', amount: 25000, reference: 'TRF-1', transferDate: '2026-10-20T09:00:00.000Z' });
    await bankManageApi.updateTransfer(31, { notes: 'checked' });
    await bankManageApi.decideTransfer(31, { status: 'REJECTED', notes: 'Not in our statement' });

    expect(mockPost).toHaveBeenNthCalledWith(1, '/payments/nigerian/bank-transfers', expect.objectContaining({ amount: 25000 }));
    expect(mockPatch).toHaveBeenCalledWith('/payments/nigerian/bank-transfers/31', { notes: 'checked' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/payments/nigerian/bank-transfers/31/verify', { status: 'REJECTED', notes: 'Not in our statement' });
  });
});

describe('bankManageApi accounts', () => {
  it('lists active or retired accounts', async () => {
    mockGet.mockReturnValue(ok({ bankAccounts: [{ id: 1 }] }));

    const accounts = await bankManageApi.listAccounts(false);

    expect(mockGet).toHaveBeenCalledWith('/payments/nigerian/bank-accounts', { params: { isActive: false } });
    expect(accounts).toEqual([{ id: 1 }]);
  });

  it('adds, edits and makes an account the default with PATCH', async () => {
    mockPost.mockReturnValue(ok({ id: 4 }));
    mockPatch.mockReturnValue(ok({ id: 4, newDefaultId: null }));

    await bankManageApi.createAccount({ bankName: 'GTBank', accountName: 'Union', accountNumber: '0123456789' });
    await bankManageApi.updateAccount(4, { isDefault: true });

    expect(mockPost).toHaveBeenCalledWith('/payments/nigerian/bank-accounts', expect.objectContaining({ accountNumber: '0123456789' }));
    expect(mockPatch).toHaveBeenCalledWith('/payments/nigerian/bank-accounts/4', { isDefault: true });
  });

  it('removes an account and reports whether it was deleted or deactivated', async () => {
    mockDelete.mockReturnValue(ok({ outcome: 'deactivated', newDefaultId: 7 }));

    const result = await bankManageApi.removeAccount(4);

    expect(mockDelete).toHaveBeenCalledWith('/payments/nigerian/bank-accounts/4');
    expect(result).toEqual({ outcome: 'deactivated', newDefaultId: 7 });
  });

  it('reads the list of Nigerian banks', async () => {
    mockGet.mockReturnValue(ok({ banks: [{ code: '058', name: 'Guaranty Trust Bank' }] }));
    await expect(bankManageApi.listBanks()).resolves.toEqual([{ code: '058', name: 'Guaranty Trust Bank' }]);
    expect(mockGet).toHaveBeenCalledWith('/payments/nigerian/banks');
  });
});
