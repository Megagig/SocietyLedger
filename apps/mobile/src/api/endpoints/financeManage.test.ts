const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

import { financeManageApi } from './financeManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('financeManageApi', () => {
  it('loads the overview, the stats, the charges and one charge', async () => {
    mockGet.mockReturnValue(ok({}));
    await financeManageApi.getDashboard();
    await financeManageApi.getStats();
    await financeManageApi.listCharges({ status: 'overdue', page: 2, limit: 20 });
    await financeManageApi.getCharge(9);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/finance/dashboard');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/finance/transactions/stats');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/finance/transactions', { params: { status: 'overdue', page: 2, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(4, '/finance/transactions/9');
  });

  it('lists the active categories', async () => {
    mockGet.mockReturnValue(ok({ categories: [{ id: 1 }] }));
    expect(await financeManageApi.listCategories()).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledWith('/finance/categories', { params: { isActive: 'true', limit: 100 } });
  });

  it('creates one charge, or many', async () => {
    mockPost.mockReturnValue(ok({ id: 1 }));
    await financeManageApi.createCharge({ memberId: 7, categoryId: 3, amount: 5000 });
    await financeManageApi.createBulk({ categoryId: 3, memberIds: [1, 2], amount: 5000 });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/finance/transactions', { memberId: 7, categoryId: 3, amount: 5000 });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/finance/transactions/bulk', { categoryId: 3, memberIds: [1, 2], amount: 5000 });
  });

  it('edits with PUT, and voids with the password in the body', async () => {
    mockPut.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({ newTransaction: { id: 2 } }));
    await financeManageApi.editCharge(9, { amount: 6000, editReason: 'Wrong amount' });
    await financeManageApi.voidAndReplace(9, { voidReason: 'Charged the wrong amount', password: 'secret', newTransaction: { memberId: 7, categoryId: 3, amount: 6000 } });
    expect(mockPut).toHaveBeenCalledWith('/finance/transactions/9/edit', { amount: 6000, editReason: 'Wrong amount' });
    expect(mockPost).toHaveBeenCalledWith('/finance/transactions/9/void-and-replace', expect.objectContaining({ password: 'secret' }));
  });

  it('deletes and undoes with the audit log id', async () => {
    mockDelete.mockReturnValue(ok({ auditLogId: 55 }));
    mockPost.mockReturnValue(ok({}));
    expect(await financeManageApi.deleteCharge(9)).toEqual({ auditLogId: 55 });
    await financeManageApi.undoDelete(55);
    expect(mockDelete).toHaveBeenCalledWith('/finance/transactions/9');
    expect(mockPost).toHaveBeenCalledWith('/finance/transactions/undo-delete/55');
  });

  it('records a payment', async () => {
    mockPost.mockReturnValue(ok({ remainingBalance: '0' }));
    await financeManageApi.recordPayment({ transactionId: 9, amountPaid: 5000, paymentMethod: 'cash' });
    expect(mockPost).toHaveBeenCalledWith('/finance/payments', { transactionId: 9, amountPaid: 5000, paymentMethod: 'cash' });
  });
});
