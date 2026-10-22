const mockGet = jest.fn();
jest.mock('../client', () => ({ client: { get: (...args: unknown[]) => mockGet(...args) } }));

import { membersManageApi } from './membersManage';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('membersManageApi.listMembers', () => {
  it('asks for one name-ordered page with the filters', async () => {
    mockGet.mockReturnValue(ok({ members: [], pagination: { page: 2, limit: 25, totalCount: 40, totalPages: 2, hasMore: false } }));

    await membersManageApi.listMembers({ page: 2, limit: 25, search: 'ada', status: 'active', loginStatus: 'invited' });

    expect(mockGet).toHaveBeenCalledWith('/members', {
      params: { page: 2, limit: 25, search: 'ada', status: 'active', loginStatus: 'invited', sortBy: 'firstName', sortOrder: 'asc' },
    });
  });
});

describe('membersManageApi.getAttendanceTotals', () => {
  it('asks for the member and returns their totals row', async () => {
    mockGet.mockReturnValue(ok([{ memberId: 9, attended: 4, totalMeetings: 5, attendanceRate: 80 }]));

    const totals = await membersManageApi.getAttendanceTotals(9);

    expect(mockGet).toHaveBeenCalledWith('/meetings/attendance-history', { params: { memberId: 9 } });
    expect(totals?.attendanceRate).toBe(80);
  });

  it('returns null for a member with no meetings on record', async () => {
    mockGet.mockReturnValue(ok([]));
    await expect(membersManageApi.getAttendanceTotals(9)).resolves.toBeNull();
  });
});

describe('membersManageApi per-member reads', () => {
  it('hits the finance, cooperative and welfare profile endpoints for the member', async () => {
    mockGet.mockReturnValue(ok({}));

    await membersManageApi.getFinanceSummary(7);
    await membersManageApi.getCooperativeProfile(7);
    await membersManageApi.getWelfareProfile(7);

    expect(mockGet.mock.calls.map(([path]) => path)).toEqual([
      '/finance/members/7/summary',
      '/cooperatives/members/7/profile',
      '/welfare/members/7/profile',
    ]);
  });
});
