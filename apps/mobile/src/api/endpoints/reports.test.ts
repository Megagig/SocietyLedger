import { reportsApi } from './reports';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('reportsApi reports', () => {
  it('asks for a named period, or for a custom range with both dates', async () => {
    mockGet.mockReturnValue(ok({}));
    await reportsApi.getFinancialSummary({ period: 'this_month' });
    await reportsApi.getFinancialSummary({ period: 'custom', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z' }, false);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/reports/financial-summary', { params: { period: 'this_month', includeComparison: true } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/reports/financial-summary', { params: { period: 'custom', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z', includeComparison: false } });
  });

  it('loads member balances, aging, collection rate and the category report', async () => {
    mockGet.mockReturnValue(ok({}));
    await reportsApi.getMemberBalances({ page: 2, limit: 25, status: 'overdue', sortBy: 'balance' });
    await reportsApi.getAging();
    await reportsApi.getCollectionRate({ period: 'this_year' }, 'quarter');
    await reportsApi.getByCategory({ startDate: 'a', endDate: 'b' }, 'levy');
    expect(mockGet).toHaveBeenNthCalledWith(1, '/reports/member-balances', { params: { page: 2, limit: 25, status: 'overdue', sortBy: 'balance' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/reports/aging-analysis', { params: { includeDetails: true } });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/reports/collection-rate', { params: { period: 'this_year', groupBy: 'quarter' } });
    expect(mockGet).toHaveBeenNthCalledWith(4, '/reports/by-category', { params: expect.objectContaining({ startDate: 'a', endDate: 'b', type: 'levy', includeTransactions: true }) });
  });

  it('lists the charges and the payments behind a figure with the same filters', async () => {
    mockGet.mockReturnValue(ok({}));
    await reportsApi.listCharges({ scope: 'aging', bucket: 'over90', memberId: 4 }, 2, 25);
    await reportsApi.listPayments({ startDate: 'a', endDate: 'b', paymentMethod: 'unspecified' }, 1, 25);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/reports/charges', { params: { scope: 'aging', bucket: 'over90', memberId: 4, page: 2, limit: 25 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/reports/payments', { params: { startDate: 'a', endDate: 'b', paymentMethod: 'unspecified', page: 1, limit: 25 } });
  });
});

describe('reportsApi exports', () => {
  it('makes a financial PDF or Excel on its own route', async () => {
    mockPost.mockReturnValue(ok({ id: 1 }));
    await reportsApi.exportFinancial({ format: 'pdf', period: 'this_month' });
    await reportsApi.exportFinancial({ format: 'excel', period: 'this_year' });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/exports/financial-pdf', { format: 'pdf', period: 'this_month' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/exports/financial-excel', { format: 'excel', period: 'this_year' });
  });

  it('makes the members list and a member statement', async () => {
    mockPost.mockReturnValue(ok({ id: 2 }));
    await reportsApi.exportMembers({ format: 'excel', status: 'with_balance' });
    await reportsApi.exportMemberStatement(9, { format: 'pdf' });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/exports/members-excel', { format: 'excel', status: 'with_balance' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/exports/member-statement/9', { format: 'pdf' });
  });

  it('lists the history and downloads a file as bytes', async () => {
    mockGet.mockReturnValueOnce(ok({ exports: [] })).mockReturnValueOnce(Promise.resolve({ data: new ArrayBuffer(8) }));
    await reportsApi.listExports({ page: 1, limit: 20 });
    const bytes = await reportsApi.downloadExport(5);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/exports/history', { params: { page: 1, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/exports/download/5', expect.objectContaining({ responseType: 'arraybuffer' }));
    expect(bytes.byteLength).toBe(8);
  });
});
