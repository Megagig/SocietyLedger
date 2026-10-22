import { fireEvent, render, screen } from '@testing-library/react-native';

import type { MemberListItemDTO } from '@/types/api/membersManage';
import { MemberRow } from './MemberRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const member = (overrides: Partial<MemberListItemDTO> = {}): MemberListItemDTO => ({
  id: 12,
  associationId: 1,
  userId: null,
  memberId: 'MEM-0012',
  firstName: 'Adaeze',
  lastName: 'Okafor',
  email: null,
  phone: null,
  address: null,
  city: null,
  state: null,
  country: null,
  gender: 'female',
  dateOfBirth: null,
  occupation: null,
  category: 'executive',
  status: 'suspended',
  loginStatus: 'no_login',
  joinDate: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelationship: null,
  notes: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  user: null,
  ...overrides,
});

describe('MemberRow', () => {
  it('shows the name, member ID, category and status', async () => {
    await render(<MemberRow member={member()} position="only" onPress={() => undefined} />);

    expect(screen.getByText('Adaeze Okafor')).toBeTruthy();
    expect(screen.getByText('MEM-0012 · Executive')).toBeTruthy();
    expect(screen.getByText('Suspended')).toBeTruthy();
  });

  it('opens the member when pressed', async () => {
    const onPress = jest.fn();
    const row = member();
    await render(<MemberRow member={row} position="middle" onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('member-row-12'));

    expect(onPress).toHaveBeenCalledWith(row);
  });
});
