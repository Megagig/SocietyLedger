import { render, screen } from '@testing-library/react-native';

import ManageScreen from './index';

// The hub's job is to show each section the officer may open, with its waiting count taken from the one attention list.
const mockAttention = jest.fn();
let mockCan = true;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }), useQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('@/hooks/useCan', () => ({ useCan: () => mockCan }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleDisabled: () => false }));
jest.mock('@/hooks/useTenantKey', () => ({ useTenantKey: () => 't' }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/features/dashboard/queries', () => ({
  dashboardKeys: { attention: () => ['attention'] },
  useAttention: () => ({ data: mockAttention() }),
  attentionCount: (items: { key: string; count: number }[] | undefined, key: string) => items?.find((i) => i.key === key)?.count ?? 0,
}));
jest.mock('@/features/session/queries', () => ({ sessionKeys: { me: () => ['me'] } }));
jest.mock('@/features/finance/queries', () => ({ FINANCE_VIEW_ACCESS: 'FINANCE_VIEW' }));
jest.mock('@/features/meetingsAdmin/queries', () => ({ MEETINGS_ADMIN_ACCESS: [], MEETINGS_MODULE: 'meetings', useMeetingStats: () => ({ data: { scheduledMeetings: 2 } }) }));
jest.mock('@/features/cash/queries', () => ({
  CASH_ANY_ACCESS: [],
  CASH_VERIFY_ACCESS: 'CASH_VERIFY',
  useCashOverview: () => ({ data: { mine: { readyToLodge: 0 } } }),
}));
jest.mock('@/features/members/queries', () => ({
  MEMBERS_APPROVE_ACCESS: 'a',
  MEMBERS_INVITE_ACCESS: 'b',
  MEMBERS_VIEW_ACCESS: 'c',
  useMemberStats: () => ({ data: { totalMembers: 40 } }),
}));
jest.mock('@/features/nigerianPayments/queries', () => ({ BANK_ACCOUNTS_VIEW_ACCESS: [], PROOFS_VIEW_ACCESS: 'p' }));
jest.mock('@/features/support/queries', () => ({ SUPPORT_STAFF_ACCESS: 's' }));

beforeEach(() => {
  mockCan = true;
  mockAttention.mockReturnValue([
    { key: 'memberApprovals', count: 3 },
    { key: 'paymentProofs', count: 2 },
    { key: 'bankTransfers', count: 2 },
    { key: 'overdueCharges', count: 5 },
    { key: 'cashLodgments', count: 4 },
    { key: 'supportTickets', count: 6 },
  ]);
});

describe('Manage hub', () => {
  it('takes every waiting count from the attention list', async () => {
    await render(<ManageScreen />);
    expect(screen.getByText('3 waiting')).toBeTruthy(); // pending approvals
    expect(screen.getByText('4 waiting')).toBeTruthy(); // payments: proofs + transfers
    expect(screen.getByText('5 overdue')).toBeTruthy();
    expect(screen.getByText('4 to check')).toBeTruthy();
    expect(screen.getByText('6 need a reply')).toBeTruthy();
  });

  it('adds proofs and transfers together for the Payments badge', async () => {
    mockAttention.mockReturnValue([
      { key: 'paymentProofs', count: 2 },
      { key: 'bankTransfers', count: 1 },
    ]);
    await render(<ManageScreen />);
    expect(screen.getByText('3 waiting')).toBeTruthy();
  });

  it('shows no badges when nothing is waiting, and no sections to someone with no permissions', async () => {
    mockAttention.mockReturnValue([]);
    await render(<ManageScreen />);
    expect(screen.queryByText(/waiting|overdue|to check|need a reply/)).toBeNull();

    mockCan = false;
    await render(<ManageScreen />);
    expect(screen.getByText('Officer hub')).toBeTruthy();
  });
});
