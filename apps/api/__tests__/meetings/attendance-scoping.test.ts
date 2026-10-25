/**
 * Members who can view meetings must only receive their OWN attendance; officers
 * (meetings.manage_attendance / members.view_all) keep the full picture. Service and RBAC are mocked.
 */
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/jobs/meeting-jobs', () => ({
  notifyMeetingScheduled: jest.fn(),
  notifyMeetingCancelled: jest.fn(),
  notifyAttendanceMarked: jest.fn(),
}));
jest.mock('../../src/services/rbac.service', () => ({ RBACService: { hasAnyPermission: jest.fn() } }));
jest.mock('../../src/modules/meetings/meetings.service', () => ({
  meetingsService: {
    getMeetingById: jest.fn(),
    getAttendanceStats: jest.fn(),
    getMeetingAttendance: jest.fn(),
    getMemberAttendanceHistory: jest.fn(),
    getMyAttendance: jest.fn(),
  },
}));

import type { Request, Response } from 'express';
import { RBACService } from '../../src/services/rbac.service';
import { meetingsService } from '../../src/modules/meetings/meetings.service';
import { meetingsController } from '../../src/modules/meetings/meetings.controller';

const hasAny = RBACService.hasAnyPermission as jest.Mock;
const svc = meetingsService as unknown as Record<string, jest.Mock>;

function makeReq(over: Partial<Request> & { query?: Record<string, string> } = {}): Request {
  return {
    user: { id: 7, associationId: 15, memberId: 70, platformRole: undefined },
    params: { id: '1' },
    query: {},
    ...over,
  } as unknown as Request;
}

function makeRes() {
  const res = { status: jest.fn(), json: jest.fn() } as unknown as Response & { status: jest.Mock; json: jest.Mock };
  res.status.mockReturnValue(res);
  return res;
}

const attendances = [
  { memberId: 70, status: 'PRESENT' },
  { memberId: 71, status: 'ABSENT' },
];

beforeEach(() => {
  jest.clearAllMocks();
  svc.getMeetingById.mockResolvedValue({ id: 1, attendances });
  svc.getAttendanceStats.mockResolvedValue({ present: 1, absent: 1 });
  svc.getMeetingAttendance.mockResolvedValue(attendances);
  svc.getMemberAttendanceHistory.mockResolvedValue([]);
});

describe('GET /meetings/:id', () => {
  it('returns only the caller\'s own attendance to a plain member', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();

    await meetingsController.getMeetingById(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.data.attendances).toEqual([{ memberId: 70, status: 'PRESENT' }]);
    expect(body.data.attendanceStats).toEqual({ present: 1, absent: 1 });
  });

  it('returns every attendance record to an officer', async () => {
    hasAny.mockResolvedValue(true);
    const res = makeRes();

    await meetingsController.getMeetingById(makeReq(), res);

    expect(res.json.mock.calls[0][0].data.attendances).toHaveLength(2);
  });
});

describe('GET /meetings/:id/attendance', () => {
  it('filters to the caller for a plain member', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();

    await meetingsController.getAttendance(makeReq(), res);

    expect(res.json.mock.calls[0][0].data.attendance).toEqual([{ memberId: 70, status: 'PRESENT' }]);
  });
});

describe('GET /meetings/attendance-history', () => {
  it('ignores a ?memberId for a plain member and uses their own id', async () => {
    hasAny.mockResolvedValue(false);

    await meetingsController.getMemberAttendanceHistory(makeReq({ query: { memberId: '71' } }), makeRes());

    expect(svc.getMemberAttendanceHistory).toHaveBeenCalledWith(15, 70);
  });

  it('honours ?memberId for an officer, and none means everyone', async () => {
    hasAny.mockResolvedValue(true);

    await meetingsController.getMemberAttendanceHistory(makeReq({ query: { memberId: '71' } }), makeRes());
    await meetingsController.getMemberAttendanceHistory(makeReq(), makeRes());

    expect(svc.getMemberAttendanceHistory).toHaveBeenNthCalledWith(1, 15, 71);
    expect(svc.getMemberAttendanceHistory).toHaveBeenNthCalledWith(2, 15, undefined);
  });

  it('returns nothing for a plain user with no member record', async () => {
    hasAny.mockResolvedValue(false);
    const res = makeRes();
    const req = makeReq();
    (req as unknown as { user: Record<string, unknown> }).user.memberId = undefined;

    await meetingsController.getMemberAttendanceHistory(req, res);

    expect(svc.getMemberAttendanceHistory).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
});

describe('GET /meetings/my-attendance', () => {
  it('returns the caller\'s own rows', async () => {
    svc.getMyAttendance.mockResolvedValue([{ meetingId: 1, status: 'PRESENT' }]);
    const res = makeRes();

    await meetingsController.getMyAttendance(makeReq(), res);

    expect(svc.getMyAttendance).toHaveBeenCalledWith(15, 70);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { records: [{ meetingId: 1, status: 'PRESENT' }] } });
  });

  it('returns an empty list when the user has no member record', async () => {
    const res = makeRes();
    const req = makeReq();
    (req as unknown as { user: Record<string, unknown> }).user.memberId = undefined;

    await meetingsController.getMyAttendance(req, res);

    expect(svc.getMyAttendance).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { records: [] } });
  });
});
