const prismaMock: any = {
  meeting: { updateMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  member: { count: jest.fn() },
  meetingMinutes: { updateMany: jest.fn(), update: jest.fn() },
  meetingAttendance: { upsert: jest.fn() },
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));

import { meetingsService } from '../../src/modules/meetings/meetings.service';
import { attendanceBlockedReason, cancelBlockedReason, hasMeetingEnded, meetingEndsAt, pastMeetingsWhere } from '../../src/modules/meetings/meeting-rules';
import { createMeetingSchema, updateMeetingSchema } from '../../src/modules/meetings/meetings.validation';

const now = new Date('2026-10-24T12:00:00.000Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

beforeEach(() => jest.clearAllMocks());

describe('when a meeting is over', () => {
  it('uses its end time, or three hours after it started when it has none', () => {
    expect(hasMeetingEnded({ startTime: hours(-5), endTime: hours(-1) }, now)).toBe(true);
    expect(hasMeetingEnded({ startTime: hours(-5), endTime: hours(1) }, now)).toBe(false);
    expect(hasMeetingEnded({ startTime: hours(-4), endTime: null }, now)).toBe(true);
    expect(hasMeetingEnded({ startTime: hours(-2), endTime: null }, now)).toBe(false);
    expect(meetingEndsAt({ startTime: hours(0), endTime: null }).getTime()).toBe(hours(3).getTime());
  });

  it('asks the database for scheduled and in-progress meetings that are over', () => {
    const where = pastMeetingsWhere(now);
    expect(where.status.in).toEqual(['SCHEDULED', 'IN_PROGRESS']);
    expect(where.OR).toEqual([{ endTime: { lt: now } }, { endTime: null, startTime: { lt: hours(-3) } }]);
  });
});

describe('what can be done to a meeting in each status', () => {
  it('attendance is blocked only for a cancelled meeting', () => {
    expect(attendanceBlockedReason('CANCELLED')).toContain('cancelled');
    expect(attendanceBlockedReason('SCHEDULED')).toBeNull();
    expect(attendanceBlockedReason('COMPLETED')).toBeNull();
  });

  it('cancelling is blocked for a cancelled or a completed meeting', () => {
    expect(cancelBlockedReason('CANCELLED')).toContain('already cancelled');
    expect(cancelBlockedReason('COMPLETED')).toContain('already been held');
    expect(cancelBlockedReason('SCHEDULED')).toBeNull();
    expect(cancelBlockedReason('POSTPONED')).toBeNull();
  });
});

describe('meetingsService', () => {
  it('completes past meetings with one update, scoped to an association when given', async () => {
    prismaMock.meeting.updateMany.mockResolvedValue({ count: 2 });
    expect(await meetingsService.completePastMeetings(9)).toBe(2);
    const arg = prismaMock.meeting.updateMany.mock.calls[0][0];
    expect(arg.where.associationId).toBe(9);
    expect(arg.data).toEqual({ status: 'COMPLETED' });
  });

  it('refuses attendance for a member who is not in this association', async () => {
    prismaMock.meeting.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.member.count.mockResolvedValue(0);
    await expect(meetingsService.markAttendance(9, 1, 5, { memberId: 999, status: 'PRESENT' } as any)).rejects.toThrow('One or more members were not found');
    expect(prismaMock.meetingAttendance.upsert).not.toHaveBeenCalled();
  });

  it('checks every member of a bulk save at once', async () => {
    prismaMock.meeting.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.member.count.mockResolvedValue(1);
    await expect(
      meetingsService.bulkMarkAttendance(9, 1, 5, [
        { memberId: 1, status: 'PRESENT' },
        { memberId: 2, status: 'ABSENT' },
      ] as any),
    ).rejects.toThrow('One or more members were not found');
    expect(prismaMock.member.count).toHaveBeenCalledWith({ where: { id: { in: [1, 2] }, associationId: 9 } });
  });

  it('approving minutes is a claim: it only lands on minutes that are still unapproved', async () => {
    prismaMock.meetingMinutes.updateMany.mockResolvedValue({ count: 0 });
    expect(await meetingsService.approveMinutes(4, 7)).toBeNull();
    expect(prismaMock.meetingMinutes.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 4, approvedAt: null } }));
    expect(prismaMock.meetingMinutes.update).not.toHaveBeenCalled();
  });

  it('cancelling is a claim: a cancelled or completed meeting is left alone', async () => {
    prismaMock.meeting.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.meeting.updateMany.mockResolvedValue({ count: 0 });
    expect(await meetingsService.cancelMeeting(9, 1, 5, 'Venue unavailable')).toBeNull();
    expect(prismaMock.meeting.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, associationId: 9, status: { notIn: ['CANCELLED', 'COMPLETED'] } } }));
    expect(prismaMock.meeting.update).not.toHaveBeenCalled();
  });

  it('a manual complete only works on a scheduled or in-progress meeting', async () => {
    prismaMock.meeting.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await meetingsService.completeMeeting(9, 1)).toBe(true);
    expect(await meetingsService.completeMeeting(9, 1)).toBe(false);
  });
});

describe('meeting times', () => {
  const base = { title: 'AGM', startTime: '2026-11-01T10:00:00.000Z' };

  it('a meeting cannot end before it starts', () => {
    expect(createMeetingSchema.safeParse({ ...base, endTime: '2026-11-01T09:00:00.000Z' }).success).toBe(false);
    expect(createMeetingSchema.safeParse({ ...base, endTime: '2026-11-01T12:00:00.000Z' }).success).toBe(true);
    expect(createMeetingSchema.safeParse(base).success).toBe(true);
    expect(updateMeetingSchema.safeParse({ startTime: base.startTime, endTime: '2026-11-01T09:00:00.000Z' }).success).toBe(false);
    expect(updateMeetingSchema.safeParse({ title: 'New title' }).success).toBe(true);
  });
});
