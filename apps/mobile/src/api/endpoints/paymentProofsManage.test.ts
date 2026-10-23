const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import { paymentProofsManageApi } from './paymentProofsManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('paymentProofsManageApi', () => {
  it('lists one status of proofs a page at a time', async () => {
    mockGet.mockReturnValue(ok({ proofs: [], pagination: { page: 2, limit: 20, totalCount: 0, totalPages: 0, hasMore: false } }));

    await paymentProofsManageApi.listProofs({ status: 'PENDING', page: 2, limit: 20 });

    expect(mockGet).toHaveBeenCalledWith('/payments/nigerian/proofs', { params: { status: 'PENDING', page: 2, limit: 20 } });
  });

  it('opens a proof and asks for its file link', async () => {
    mockGet.mockReturnValueOnce(ok({ id: 9, declaredItems: [] }));
    mockGet.mockReturnValueOnce(ok({ url: 'https://files.example.com/r.png', filename: 'r.png', mimeType: 'image/png', expiresInSeconds: 3600 }));

    await paymentProofsManageApi.getProof(9);
    const link = await paymentProofsManageApi.getFileLink(9);

    expect(mockGet).toHaveBeenNthCalledWith(1, '/payments/nigerian/proofs/9');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/payments/nigerian/proofs/9/file-url');
    expect(link.url).toBe('https://files.example.com/r.png');
  });

  it('approves, and rejects with a reason', async () => {
    mockPost.mockReturnValue(ok({ id: 9, status: 'APPROVED' }));

    await paymentProofsManageApi.decideProof(9, { status: 'APPROVED' });
    await paymentProofsManageApi.decideProof(9, { status: 'REJECTED', rejectionReason: 'Only ₦3,000 received' });

    expect(mockPost).toHaveBeenNthCalledWith(1, '/payments/nigerian/proofs/9/verify', { status: 'APPROVED' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/payments/nigerian/proofs/9/verify', { status: 'REJECTED', rejectionReason: 'Only ₦3,000 received' });
  });
});
