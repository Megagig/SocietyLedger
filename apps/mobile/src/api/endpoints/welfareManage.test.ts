const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}));

import { welfareManageApi } from './welfareManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const BASE = '/welfare';

beforeEach(() => jest.clearAllMocks());

describe('funds', () => {
  it('reads the dashboard and lists funds', async () => {
    mockGet.mockReturnValue(ok({}));
    await welfareManageApi.getDashboard();
    await welfareManageApi.listFunds({ status: 'ACTIVE', limit: 100 });
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/dashboard`);
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/funds`, { params: { status: 'ACTIVE', limit: 100 } });
  });

  it('creates, changes (PUT) and deletes a fund', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await welfareManageApi.createFund({ name: 'Medical', fundType: 'MEDICAL', isContributionMandatory: false, waitingPeriodDays: 0, minContributionMonths: 0 });
    await welfareManageApi.updateFund(2, { status: 'CLOSED' });
    await welfareManageApi.deleteFund(2);
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/funds`, expect.objectContaining({ name: 'Medical' }));
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/funds/2`, { status: 'CLOSED' });
    expect(mockDelete).toHaveBeenCalledWith(`${BASE}/funds/2`);
  });
});

describe('contributions', () => {
  it('lists, records one and many, and confirms or rejects', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    await welfareManageApi.listContributions({ status: 'PENDING', page: 1, limit: 20 });
    await welfareManageApi.recordContribution({ fundId: 2, memberId: 3, amount: 5000 });
    await welfareManageApi.recordBulk({ fundId: 2, memberIds: [3, 4], amount: 5000 });
    await welfareManageApi.confirmContribution(9, 'CONFIRMED');
    await welfareManageApi.confirmContribution(9, 'REJECTED', 'Not received');
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/contributions`, { params: { status: 'PENDING', page: 1, limit: 20 } });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/contributions`, { fundId: 2, memberId: 3, amount: 5000 });
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/contributions/bulk`, { fundId: 2, memberIds: [3, 4], amount: 5000 });
    expect(mockPost).toHaveBeenNthCalledWith(3, `${BASE}/contributions/9/confirm`, { status: 'CONFIRMED', notes: undefined });
    expect(mockPost).toHaveBeenNthCalledWith(4, `${BASE}/contributions/9/confirm`, { status: 'REJECTED', notes: 'Not received' });
  });
});

describe('payouts', () => {
  it('lists, approves with an amount, rejects with a reason, and pays out', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    await welfareManageApi.listPayouts({ status: 'PENDING', limit: 20 });
    await welfareManageApi.reviewPayout(8, { status: 'APPROVED', approvedAmount: 30000 });
    await welfareManageApi.reviewPayout(8, { status: 'REJECTED', rejectionReason: 'Not eligible' });
    await welfareManageApi.disbursePayout(8, { disbursementMethod: 'cash' });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/payouts`, { params: { status: 'PENDING', limit: 20 } });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/payouts/8/review`, { status: 'APPROVED', approvedAmount: 30000 });
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/payouts/8/review`, { status: 'REJECTED', rejectionReason: 'Not eligible' });
    expect(mockPost).toHaveBeenNthCalledWith(3, `${BASE}/payouts/8/disburse`, { disbursementMethod: 'cash' });
  });
});
