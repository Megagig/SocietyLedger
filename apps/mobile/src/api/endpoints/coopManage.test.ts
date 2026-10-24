const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('../client', () => ({
  client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

import { coopManageApi } from './coopManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const BASE = '/cooperatives';

beforeEach(() => jest.clearAllMocks());

describe('savings', () => {
  it('lists accounts and reads one', async () => {
    mockGet.mockReturnValue(ok({}));
    await coopManageApi.listAccounts({ search: 'ada', status: 'ACTIVE', page: 1, limit: 20 });
    await coopManageApi.getAccount(4);
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/savings-accounts`, { params: { search: 'ada', status: 'ACTIVE', page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/savings-accounts/4`);
  });

  it('opens an account and records money in and out', async () => {
    mockPost.mockReturnValue(ok({}));
    await coopManageApi.openAccount({ memberId: 3, accountType: 'REGULAR' });
    await coopManageApi.recordSavings({ savingsAccountId: 4, type: 'WITHDRAWAL', amount: 2000, paymentMethod: 'CASH' });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/savings-accounts`, { memberId: 3, accountType: 'REGULAR' });
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/savings-transactions`, expect.objectContaining({ type: 'WITHDRAWAL', amount: 2000 }));
  });
});

describe('the request queues', () => {
  it('lists deposits and repayments by status, and decides them', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    await coopManageApi.listDepositRequests({ status: 'PENDING', page: 1, limit: 20 });
    await coopManageApi.listRepaymentRequests({ status: 'APPROVED' });
    await coopManageApi.approveDeposit(5);
    await coopManageApi.rejectDeposit(5, 'Unclear receipt');
    await coopManageApi.approveRepayment(6);
    await coopManageApi.rejectRepayment(6, 'Wrong amount');
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/savings-deposits`, { params: { status: 'PENDING', page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/loan-repayment-requests`, { params: { status: 'APPROVED' } });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/savings-deposits/5/approve`, {});
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/savings-deposits/5/reject`, { reason: 'Unclear receipt' });
    expect(mockPost).toHaveBeenNthCalledWith(3, `${BASE}/loan-repayment-requests/6/approve`, {});
    expect(mockPost).toHaveBeenNthCalledWith(4, `${BASE}/loan-repayment-requests/6/reject`, { reason: 'Wrong amount' });
  });
});

describe('loan products', () => {
  it('lists with the active filter as text, creates and changes one', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    await coopManageApi.listProducts({ isActive: true });
    await coopManageApi.createProduct({ name: 'Emergency', minAmount: 1, maxAmount: 2, interestRate: 10, interestType: 'FLAT', minTenureMonths: 1, maxTenureMonths: 2, requiresGuarantor: false });
    await coopManageApi.updateProduct(2, { isActive: false });
    expect(mockGet).toHaveBeenCalledWith(`${BASE}/loan-products`, { params: { isActive: 'true' } });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/loan-products`, expect.objectContaining({ name: 'Emergency' }));
    expect(mockPut).toHaveBeenCalledWith(`${BASE}/loan-products/2`, { isActive: false });
  });
});

describe('applications and loans', () => {
  it('reviews with an approve or a reject-with-reason, and disburses once', async () => {
    mockPost.mockReturnValue(ok({}));
    await coopManageApi.reviewApplication(20, { action: 'approve' });
    await coopManageApi.reviewApplication(20, { action: 'reject', rejectionReason: 'Not eligible' });
    await coopManageApi.disburse(20, { disbursementMethod: 'savings_credit', savingsAccountId: 4 });
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/loan-applications/20/review`, { action: 'approve' });
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/loan-applications/20/review`, { action: 'reject', rejectionReason: 'Not eligible' });
    expect(mockPost).toHaveBeenNthCalledWith(3, `${BASE}/loan-applications/20/disburse`, { disbursementMethod: 'savings_credit', savingsAccountId: 4 });
  });

  it('lists and reads applications and loans, and records a repayment', async () => {
    mockGet.mockReturnValue(ok({}));
    mockPost.mockReturnValue(ok({}));
    await coopManageApi.listApplications({ status: 'PENDING_REVIEW' });
    await coopManageApi.getApplication(20);
    await coopManageApi.listLoans({ status: 'OVERDUE' });
    await coopManageApi.getLoan(8);
    await coopManageApi.listLoanRepayments({ loanId: 8, limit: 50 });
    await coopManageApi.recordRepayment({ loanId: 8, amount: 5000, paymentMethod: 'cash' });
    expect(mockGet).toHaveBeenNthCalledWith(1, `${BASE}/loan-applications`, { params: { status: 'PENDING_REVIEW' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, `${BASE}/loan-applications/20`);
    expect(mockGet).toHaveBeenNthCalledWith(3, `${BASE}/loans`, { params: { status: 'OVERDUE' } });
    expect(mockGet).toHaveBeenNthCalledWith(4, `${BASE}/loans/8`);
    expect(mockGet).toHaveBeenNthCalledWith(5, `${BASE}/loan-repayments`, { params: { loanId: 8, limit: 50 } });
    expect(mockPost).toHaveBeenCalledWith(`${BASE}/loan-repayments`, { loanId: 8, amount: 5000, paymentMethod: 'cash' });
  });
});
