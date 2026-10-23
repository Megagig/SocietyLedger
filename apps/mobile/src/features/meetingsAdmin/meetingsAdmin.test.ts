import { mergeDateTime } from '@/lib/dateTime';
import type { AttendanceRowDTO } from '@/types/api/meetingsManage';
import {
  canCancelMeeting,
  canCompleteMeeting,
  canEditMeeting,
  canTakeAttendance,
  countAttendance,
  filterAttendance,
  markAllPresentPayload,
  meetingStatusKey,
  quorumMet,
} from './labels';
import { agendaFormSchema, emptyMeetingValues, meetingFormSchema, minutesFormSchema, reorderedAgenda, toAgendaPayload, toMeetingPayload } from './schemas';

const row = (memberId: number, status: AttendanceRowDTO['status'], first = 'Ada', last = 'Obi'): AttendanceRowDTO => ({
  id: memberId, meetingId: 1, memberId, status, checkInTime: null, apologyReason: null, notes: null, member: { id: memberId, memberId: `M-00${memberId}`, firstName: first, lastName: last },
});

describe('attendance counts', () => {
  it('counts each choice, and late counts as attended', () => {
    const counts = countAttendance([row(1, 'PRESENT'), row(2, 'LATE'), row(3, 'ABSENT'), row(4, 'APOLOGY'), row(5, 'PENDING'), row(6, 'PRESENT')]);
    expect(counts).toEqual({ total: 6, present: 2, late: 1, absent: 1, excused: 1, pending: 1, attended: 3 });
  });

  it('quorum is met at or above the number needed, and always when none is set', () => {
    expect(quorumMet(10, 10)).toBe(true);
    expect(quorumMet(9, 10)).toBe(false);
    expect(quorumMet(0, null)).toBe(true);
  });
});

describe('the roster', () => {
  const rows = [row(1, 'PENDING', 'Ada', 'Obi'), row(2, 'ABSENT', 'Chima', 'Eze'), row(3, 'PENDING', 'Bola', 'Ade')];

  it('searches by name or member ID', () => {
    expect(filterAttendance(rows, 'chi').map((r) => r.memberId)).toEqual([2]);
    expect(filterAttendance(rows, 'M-003').map((r) => r.memberId)).toEqual([3]);
    expect(filterAttendance(rows, '  ')).toHaveLength(3);
  });

  it('"mark all present" only touches members not yet marked', () => {
    expect(markAllPresentPayload(rows)).toEqual([
      { memberId: 1, status: 'PRESENT' },
      { memberId: 3, status: 'PRESENT' },
    ]);
  });
});

describe('what can be done to a meeting', () => {
  it('follows the API rules for each status', () => {
    expect([canCancelMeeting('SCHEDULED'), canCancelMeeting('COMPLETED'), canCancelMeeting('CANCELLED')]).toEqual([true, false, false]);
    expect([canCompleteMeeting('SCHEDULED'), canCompleteMeeting('IN_PROGRESS'), canCompleteMeeting('COMPLETED')]).toEqual([true, true, false]);
    expect([canTakeAttendance('SCHEDULED'), canTakeAttendance('COMPLETED'), canTakeAttendance('CANCELLED')]).toEqual([true, true, false]);
    expect([canEditMeeting('SCHEDULED'), canEditMeeting('COMPLETED'), canEditMeeting('CANCELLED')]).toEqual([true, false, false]);
    expect(meetingStatusKey('IN_PROGRESS')).toBe('in_progress');
  });
});

describe('the meeting form', () => {
  const valid = { ...emptyMeetingValues(new Date('2026-10-24T09:00:00.000Z')), title: 'October meeting' };

  it('needs a title and a start, and the end must be after the start', () => {
    expect(meetingFormSchema.safeParse(valid).success).toBe(true);
    expect(meetingFormSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
    expect(meetingFormSchema.safeParse({ ...valid, endTime: new Date(new Date(valid.startTime).getTime() - 3_600_000).toISOString() }).success).toBe(false);
    expect(meetingFormSchema.safeParse({ ...valid, endTime: new Date(new Date(valid.startTime).getTime() + 3_600_000).toISOString() }).success).toBe(true);
  });

  it('checks the link and the quorum, and sends blanks as null', () => {
    expect(meetingFormSchema.safeParse({ ...valid, virtualLink: 'meet.google.com' }).success).toBe(false);
    expect(meetingFormSchema.safeParse({ ...valid, virtualLink: 'https://meet.google.com/abc' }).success).toBe(true);
    expect(meetingFormSchema.safeParse({ ...valid, quorumRequired: '0' }).success).toBe(false);
    expect(toMeetingPayload(valid)).toMatchObject({ title: 'October meeting', endTime: null, location: null, virtualLink: null, quorumRequired: null, meetingType: 'REGULAR' });
    expect(toMeetingPayload({ ...valid, quorumRequired: '12' }).quorumRequired).toBe(12);
  });
});

describe('the agenda', () => {
  it('needs a title and a sensible duration', () => {
    expect(agendaFormSchema.safeParse({ title: '', presenter: '', duration: '', description: '' }).success).toBe(false);
    expect(agendaFormSchema.safeParse({ title: 'Treasurer report', presenter: '', duration: '15', description: '' }).success).toBe(true);
    expect(agendaFormSchema.safeParse({ title: 'x', presenter: '', duration: '0', description: '' }).success).toBe(false);
    expect(toAgendaPayload({ title: ' Report ', presenter: '', duration: '15', description: '' }, 3)).toEqual({ orderNumber: 3, title: 'Report', presenter: null, duration: 15, description: null });
  });

  it('moves an item up or down and renumbers the whole agenda', () => {
    const items = [{ id: 10 }, { id: 20 }, { id: 30 }];
    expect(reorderedAgenda(items, 20, 'up')).toEqual([{ id: 20, orderNumber: 1 }, { id: 10, orderNumber: 2 }, { id: 30, orderNumber: 3 }]);
    expect(reorderedAgenda(items, 20, 'down')).toEqual([{ id: 10, orderNumber: 1 }, { id: 30, orderNumber: 2 }, { id: 20, orderNumber: 3 }]);
    expect(reorderedAgenda(items, 10, 'up')).toBeNull();
    expect(reorderedAgenda(items, 30, 'down')).toBeNull();
    expect(reorderedAgenda(items, 99, 'up')).toBeNull();
  });
});

describe('the minutes form', () => {
  it('needs the minutes themselves', () => {
    expect(minutesFormSchema.safeParse({ content: 'short', decisions: '', actionItems: '' }).success).toBe(false);
    expect(minutesFormSchema.safeParse({ content: 'We discussed the dues for the year.', decisions: '', actionItems: '' }).success).toBe(true);
  });
});

describe('mergeDateTime', () => {
  it('changing the day keeps the time, and changing the time keeps the day', () => {
    const current = new Date(2026, 9, 24, 18, 30);
    const day = mergeDateTime(current, new Date(2026, 10, 2, 9, 0), 'date');
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours(), day.getMinutes()]).toEqual([2026, 10, 2, 18, 30]);
    const time = mergeDateTime(current, new Date(2026, 0, 1, 7, 15), 'time');
    expect([time.getDate(), time.getHours(), time.getMinutes()]).toEqual([24, 7, 15]);
  });
});
