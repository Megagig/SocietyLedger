import { accountingApi } from './accounting';

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

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('accountingApi entries', () => {
  it('writes, changes and sends an entry on the journal routes', async () => {
    mockPost.mockReturnValue(ok({ id: 5 }));
    mockPut.mockReturnValue(ok({ id: 5 }));
    const payload = { entryDate: '2026-10-24T12:00:00.000Z', description: 'Hall hire', lines: [{ accountId: 1, debitAmount: 5000 }, { accountId: 2, creditAmount: 5000 }] };
    await accountingApi.createEntry(payload);
    await accountingApi.updateEntry(5, { description: 'Hall hire, AGM' });
    await accountingApi.submitEntry(5);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/accounting/journal-entries', payload);
    expect(mockPut).toHaveBeenCalledWith('/accounting/journal-entries/5', { description: 'Hall hire, AGM' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/accounting/journal-entries/5/submit');
  });

  it('approves or rejects with the reason, and posts with the password', async () => {
    mockPost.mockReturnValue(ok({}));
    await accountingApi.decideEntry(5, { action: 'reject', reason: 'Wrong account' });
    await accountingApi.postEntry(5, 's3cret');
    expect(mockPost).toHaveBeenNthCalledWith(1, '/accounting/journal-entries/5/approval', { action: 'reject', reason: 'Wrong account' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/accounting/journal-entries/5/post', { password: 's3cret' });
  });

  it('lists entries by status and page', async () => {
    mockGet.mockReturnValue(ok({ entries: [], pagination: {} }));
    await accountingApi.listEntries({ page: 2, limit: 20, status: 'APPROVED' });
    expect(mockGet).toHaveBeenCalledWith('/accounting/journal-entries', { params: { page: 2, limit: 20, status: 'APPROVED' } });
  });
});

describe('accountingApi books and statements', () => {
  it('asks for balances only when wanted', async () => {
    mockGet.mockReturnValue(ok([]));
    await accountingApi.listAccounts({ includeBalances: true });
    await accountingApi.listAccounts();
    expect(mockGet).toHaveBeenNthCalledWith(1, '/accounting/chart-of-accounts', { params: { includeBalances: 'true', type: undefined } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/accounting/chart-of-accounts', { params: { includeBalances: undefined, type: undefined } });
  });

  it('reads each statement with its period or date', async () => {
    mockGet.mockReturnValue(ok({}));
    await accountingApi.getIncomeStatement({ period: 'this_month' });
    await accountingApi.getCashFlow({ period: 'custom', startDate: 'a', endDate: 'b' });
    await accountingApi.getBalanceSheet('2026-10-31T22:59:59.999Z');
    expect(mockGet).toHaveBeenNthCalledWith(1, '/accounting/income-statement', { params: { period: 'this_month' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/accounting/cash-flow', { params: { period: 'custom', startDate: 'a', endDate: 'b' } });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/accounting/balance-sheet', { params: { asOfDate: '2026-10-31T22:59:59.999Z' } });
  });

  it('moves a period along its three steps', async () => {
    mockPost.mockReturnValue(ok({}));
    await accountingApi.closePeriod(3);
    await accountingApi.reopenPeriod(3);
    await accountingApi.lockPeriod(3);
    expect(mockPost.mock.calls.map((c) => c[0])).toEqual(['/accounting/periods/3/close', '/accounting/periods/3/reopen', '/accounting/periods/3/lock']);
  });

  it('works budgets through plan, approval, activation and variance', async () => {
    mockPost.mockReturnValue(ok({}));
    mockGet.mockReturnValue(ok({}));
    await accountingApi.approveBudget(4);
    await accountingApi.activateBudget(4);
    await accountingApi.getVariance(4);
    expect(mockPost.mock.calls.map((c) => c[0])).toEqual(['/accounting/budgets/4/approve', '/accounting/budgets/4/activate']);
    expect(mockGet).toHaveBeenCalledWith('/accounting/budgets/4/variance');
  });
});

describe('accountingApi.runSync', () => {
  it('catches up every kind of record and adds the counts together', async () => {
    mockPost.mockImplementation((path: string) => ok(path === '/accounting/sync/payments/bulk' ? { synced: 3, failed: 1 } : { synced: 1, failed: 0 }));
    const result = await accountingApi.runSync();
    expect(mockPost).toHaveBeenCalledTimes(7);
    expect(mockPost.mock.calls.every((c) => String(c[0]).startsWith('/accounting/sync/') && String(c[0]).endsWith('/bulk'))).toBe(true);
    expect(result).toEqual({ synced: 9, failed: 1 });
  });

  it('stops at the first kind that fails instead of hiding it', async () => {
    mockPost.mockReturnValueOnce(ok({ synced: 1, failed: 0 })).mockRejectedValueOnce(new Error('network'));
    await expect(accountingApi.runSync()).rejects.toThrow('network');
    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});

describe('parity with the website', () => {
  it('catches up one kind of record at a time', async () => {
    mockPost.mockReturnValue(ok({ synced: 4, failed: 0 }));
    expect(await accountingApi.runSync('welfare-payouts')).toEqual({ synced: 4, failed: 0 });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/accounting/sync/welfare-payouts/bulk');
  });

  it('asks for the income statement with its comparison', async () => {
    mockGet.mockReturnValue(ok({}));
    await accountingApi.getIncomeStatement({ period: 'this_month', includeComparison: 'true' });
    expect(mockGet).toHaveBeenCalledWith('/accounting/income-statement', { params: { period: 'this_month', includeComparison: 'true' } });
  });

  it('lists budgets of one year', async () => {
    mockGet.mockReturnValue(ok({ budgets: [], pagination: {} }));
    await accountingApi.listBudgets({ page: 1, limit: 20, fiscalYear: 2026 });
    expect(mockGet).toHaveBeenCalledWith('/accounting/budgets', { params: { page: 1, limit: 20, fiscalYear: 2026 } });
  });
});

describe('accountingApi.exportStatement', () => {
  it('asks the server for the statement as a PDF', async () => {
    mockPost.mockReturnValue(ok({ id: 8, filename: 'accounting_income.pdf', format: 'pdf' }));
    const result = await accountingApi.exportStatement({ statement: 'balance', asOfDate: '2026-10-31T22:59:59.999Z' });
    expect(mockPost).toHaveBeenCalledWith('/exports/accounting-statement', { statement: 'balance', asOfDate: '2026-10-31T22:59:59.999Z' });
    expect(result.id).toBe(8);
  });
});
