import { meetingsManageApi } from './meetingsManage';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('../client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('meetingsManageApi', () => {
  it('loads stats, lists one status, and opens a meeting', async () => {
    mockGet.mockReturnValue(ok({}));
    await meetingsManageApi.getStats();
    await meetingsManageApi.list({ status: 'SCHEDULED', page: 2, limit: 20 });
    await meetingsManageApi.get(4);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/meetings/stats');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/meetings', { params: { status: 'SCHEDULED', page: 2, limit: 20 } });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/meetings/4');
  });

  it('creates and edits a meeting', async () => {
    mockPost.mockReturnValue(ok({ id: 9 }));
    mockPatch.mockReturnValue(ok({ id: 9 }));
    await meetingsManageApi.create({ title: 'AGM', meetingType: 'AGM', startTime: '2026-11-01T10:00:00.000Z' });
    await meetingsManageApi.update(9, { title: 'AGM 2026' });
    expect(mockPost).toHaveBeenCalledWith('/meetings', expect.objectContaining({ title: 'AGM' }));
    expect(mockPatch).toHaveBeenCalledWith('/meetings/9', { title: 'AGM 2026' });
  });

  it('cancels with a reason, completes, and deletes', async () => {
    mockPost.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await meetingsManageApi.cancel(4, 'Venue unavailable');
    await meetingsManageApi.complete(4);
    await meetingsManageApi.remove(4);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/meetings/4/cancel', { reason: 'Venue unavailable' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/meetings/4/complete');
    expect(mockDelete).toHaveBeenCalledWith('/meetings/4');
  });

  it('manages the agenda, including reordering in one call', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPatch.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    await meetingsManageApi.addAgendaItem(4, { orderNumber: 1, title: 'Opening prayer' });
    await meetingsManageApi.updateAgendaItem(4, 7, { title: 'Prayer' });
    await meetingsManageApi.removeAgendaItem(4, 7);
    await meetingsManageApi.reorderAgenda(4, [{ id: 7, orderNumber: 2 }]);
    expect(mockPost).toHaveBeenCalledWith('/meetings/4/agenda', { orderNumber: 1, title: 'Opening prayer' });
    expect(mockPatch).toHaveBeenCalledWith('/meetings/4/agenda/7', { title: 'Prayer' });
    expect(mockDelete).toHaveBeenCalledWith('/meetings/4/agenda/7');
    expect(mockPut).toHaveBeenCalledWith('/meetings/4/agenda/reorder', { items: [{ id: 7, orderNumber: 2 }] });
  });

  it('starts the attendance list, reads it, and marks one or many', async () => {
    mockPost.mockReturnValue(ok({}));
    mockGet.mockReturnValue(ok({ attendance: [], stats: {} }));
    await meetingsManageApi.initializeAttendance(4);
    await meetingsManageApi.getAttendance(4);
    await meetingsManageApi.markAttendance(4, { memberId: 7, status: 'PRESENT' });
    await meetingsManageApi.markAttendanceBulk(4, [{ memberId: 7, status: 'PRESENT' }]);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/meetings/4/attendance/initialize');
    expect(mockGet).toHaveBeenCalledWith('/meetings/4/attendance');
    expect(mockPost).toHaveBeenNthCalledWith(2, '/meetings/4/attendance', { memberId: 7, status: 'PRESENT' });
    expect(mockPost).toHaveBeenNthCalledWith(3, '/meetings/4/attendance/bulk', { attendances: [{ memberId: 7, status: 'PRESENT' }] });
  });

  it('reads minutes (null when none yet), writes and approves them', async () => {
    mockGet.mockReturnValueOnce(Promise.reject({ status: 404 }));
    expect(await meetingsManageApi.getMinutes(4)).toBeNull();
    mockPost.mockReturnValue(ok({}));
    mockPatch.mockReturnValue(ok({}));
    await meetingsManageApi.createMinutes(4, { content: 'We met.' });
    await meetingsManageApi.updateMinutes(4, { content: 'We met again.' });
    await meetingsManageApi.approveMinutes(4);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/meetings/4/minutes', { content: 'We met.' });
    expect(mockPatch).toHaveBeenCalledWith('/meetings/4/minutes', { content: 'We met again.' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/meetings/4/minutes/approve');
  });

  it('lets other errors from reading minutes through', async () => {
    mockGet.mockReturnValueOnce(Promise.reject({ status: 500 }));
    await expect(meetingsManageApi.getMinutes(4)).rejects.toEqual({ status: 500 });
  });
});
