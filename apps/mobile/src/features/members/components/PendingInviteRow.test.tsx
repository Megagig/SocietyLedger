import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PendingInviteDTO } from '@/types/api/membersManage';
import { PendingInviteRow } from './PendingInviteRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const invite = (overrides: Partial<PendingInviteDTO> = {}): PendingInviteDTO => ({
  id: 9,
  memberId: 4,
  email: 'tunde@example.com',
  phone: null,
  status: 'pending',
  inviteTokenExpiresAt: '2999-01-01T00:00:00.000Z',
  createdAt: '2026-10-20T09:00:00.000Z',
  member: { id: 4, firstName: 'Tunde', lastName: 'Bakare', email: 'tunde@example.com', memberId: 'MEM0004' },
  invitedBy: null,
  ...overrides,
});

describe('PendingInviteRow', () => {
  it('shows who it went to and wires Resend and Revoke', async () => {
    const onResend = jest.fn();
    const onRevoke = jest.fn();
    const row = invite();
    await render(<PendingInviteRow invite={row} onResend={onResend} onRevoke={onRevoke} />);

    expect(screen.getByText('Tunde Bakare')).toBeTruthy();
    expect(screen.getByText('tunde@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('resend-9'));
    await fireEvent.press(screen.getByTestId('revoke-9'));
    expect(onResend).toHaveBeenCalledWith(row);
    expect(onRevoke).toHaveBeenCalledWith(row);
  });

  it('says so, and offers Send again, once the link has expired', async () => {
    await render(<PendingInviteRow invite={invite({ inviteTokenExpiresAt: '2020-01-01T00:00:00.000Z' })} onResend={() => undefined} onRevoke={() => undefined} />);

    expect(screen.getByText(/^Expired /)).toBeTruthy();
    expect(screen.getByText('Send again')).toBeTruthy();
  });
});
