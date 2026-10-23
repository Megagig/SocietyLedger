import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AttendanceRowDTO, MeetingListItemDTO } from '@/types/api/meetingsManage';
import { AttendanceMemberRow } from './AttendanceMemberRow';
import { MeetingRow } from './MeetingRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const meeting = (over: Partial<MeetingListItemDTO> = {}): MeetingListItemDTO => ({
  id: 4, associationId: 1, title: 'October general meeting', description: null, meetingType: 'AGM', location: 'Town hall', virtualLink: null, startTime: '2026-10-30T17:00:00.000Z', endTime: null,
  status: 'SCHEDULED', quorumRequired: null, createdBy: 1, cancelledBy: null, cancelledAt: null, cancellationReason: null, reminderSent: false, createdAt: '2026-10-20T09:00:00.000Z', updatedAt: '2026-10-20T09:00:00.000Z',
  creator: { id: 1, email: 'a@b.c' }, agendaItems: [], _count: { attendances: 0 }, ...over,
});

const attendance = (status: AttendanceRowDTO['status'] = 'PENDING'): AttendanceRowDTO => ({
  id: 1, meetingId: 4, memberId: 7, status, checkInTime: null, apologyReason: null, notes: null, member: { id: 7, memberId: 'M-007', firstName: 'Ada', lastName: 'Obi' },
});

describe('MeetingRow', () => {
  it('shows the title, kind and venue, and its status, and opens on press', async () => {
    const onPress = jest.fn();
    const row = meeting();
    await render(<MeetingRow meeting={row} position="only" onPress={onPress} />);
    expect(screen.getByText('October general meeting')).toBeTruthy();
    expect(screen.getByText('Annual general meeting · Town hall')).toBeTruthy();
    expect(screen.getByText('Scheduled')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('meeting-row-4'));
    expect(onPress).toHaveBeenCalledWith(row);
  });

  it('shows how many are on the attendance list, and a cancelled meeting as cancelled', async () => {
    await render(<MeetingRow meeting={meeting({ status: 'CANCELLED', _count: { attendances: 12 } })} position="only" onPress={() => undefined} />);
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('12 on the list')).toBeTruthy();
  });
});

describe('AttendanceMemberRow', () => {
  it('offers Present, Absent, Excused and Late, and reports the one tapped', async () => {
    const onMark = jest.fn();
    const row = attendance();
    await render(<AttendanceMemberRow row={row} position="only" editable onMark={onMark} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Not marked yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('attendance-7-APOLOGY'));
    expect(onMark).toHaveBeenCalledWith(row, 'APOLOGY');
  });

  it('marks the chosen status as selected and hides the "not marked" note', async () => {
    await render(<AttendanceMemberRow row={attendance('LATE')} position="only" editable onMark={() => undefined} />);
    expect(screen.getByTestId('attendance-7-LATE').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByText('Not marked yet')).toBeNull();
  });

  it('cannot be changed when the meeting was cancelled', async () => {
    const onMark = jest.fn();
    await render(<AttendanceMemberRow row={attendance()} position="only" editable={false} onMark={onMark} />);
    await fireEvent.press(screen.getByTestId('attendance-7-PRESENT'));
    expect(onMark).not.toHaveBeenCalled();
  });
});
