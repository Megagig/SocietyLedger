import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ApprovalDTO } from '@/types/api/membersManage';
import { ApprovalRow } from './ApprovalRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const approval = (overrides: Partial<ApprovalDTO> = {}): ApprovalDTO => ({
  id: 1,
  userId: 40,
  approvalStatus: 'pending',
  createdAt: '2026-10-20T09:00:00.000Z',
  approvalDate: null,
  rejectionReason: null,
  approvedBy: null,
  user: {
    id: 40,
    email: 'ngozi@example.com',
    role: 'member',
    emailVerified: true,
    isActive: false,
    createdAt: '2026-10-20T09:00:00.000Z',
    member: { id: 7, memberId: 'MEM0007', firstName: 'Ngozi', lastName: 'Eze', phone: '08031234567' },
  },
  ...overrides,
});

describe('ApprovalRow', () => {
  it('shows who registered and offers Approve and Reject while pending', async () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    const row = approval();
    await render(<ApprovalRow approval={row} onApprove={onApprove} onReject={onReject} />);

    expect(screen.getByText('Ngozi Eze')).toBeTruthy();
    expect(screen.getByText('ngozi@example.com')).toBeTruthy();
    expect(screen.getByText('Email verified')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('approve-40'));
    await fireEvent.press(screen.getByTestId('reject-40'));
    expect(onApprove).toHaveBeenCalledWith(row);
    expect(onReject).toHaveBeenCalledWith(row);
  });

  it('falls back to the email when there is no member record, and flags an unverified email', async () => {
    const row = approval({ user: { ...approval().user, member: null, emailVerified: false } });
    await render(<ApprovalRow approval={row} onApprove={() => undefined} onReject={() => undefined} />);

    expect(screen.getAllByText('ngozi@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Email not verified')).toBeTruthy();
  });

  it('is read-only once decided, and shows a rejection reason', async () => {
    const row = approval({ approvalStatus: 'rejected', approvalDate: '2026-10-21T09:00:00.000Z', rejectionReason: 'Not on our register' });
    await render(<ApprovalRow approval={row} />);

    expect(screen.getByText('Reason: Not on our register')).toBeTruthy();
    expect(screen.queryByTestId('approve-40')).toBeNull();
  });
});
