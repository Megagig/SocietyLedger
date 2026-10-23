const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
  },
}));

import { ledgerManageApi } from './ledgerManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('ledgerManageApi', () => {
  it('lists members with balances and opens one ledger', async () => {
    mockGet.mockReturnValue(ok({}));
    await ledgerManageApi.listMembers({ page: 1, limit: 30, search: 'ada' });
    await ledgerManageApi.getSummary(7);
    await ledgerManageApi.getEntries(7, { page: 2, limit: 50 });
    expect(mockGet).toHaveBeenNthCalledWith(1, '/member-ledger/ledger/members', { params: { page: 1, limit: 30, search: 'ada' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/member-ledger/ledger/7/summary');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/member-ledger/ledger/7/entries', { params: { page: 2, limit: 50 } });
  });

  it('gets a statement for a period', async () => {
    mockGet.mockReturnValue(ok({}));
    await ledgerManageApi.getStatement(7, '2026-01-01', '2026-10-24');
    expect(mockGet).toHaveBeenCalledWith('/member-ledger/ledger/7/statement', { params: { startDate: '2026-01-01', endDate: '2026-10-24' } });
  });

  it('rebuilds a ledger with force', async () => {
    mockPost.mockReturnValue(ok({ entriesCreated: 4 }));
    expect(await ledgerManageApi.resync(7, true)).toEqual({ entriesCreated: 4 });
    expect(mockPost).toHaveBeenCalledWith('/member-ledger/ledger/7/sync', undefined, { params: { force: true } });
  });
});
