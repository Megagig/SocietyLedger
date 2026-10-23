import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { CampaignDetailDTO } from '@/types/api/financeSetup';
import CampaignDetailScreen from '../../../app/(app)/(tabs)/manage/finance/levies/[id]';

// A levy is a debt. A closed campaign takes no new members but says plainly that what members were charged is still owed.
let mockCampaign: CampaignDetailDTO;
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useLocalSearchParams: () => ({ id: '8' }) }));
jest.mock('@/hooks/useCan', () => ({ useCan: () => true }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/feedback/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
jest.mock('@/features/financeSetup/mutations', () => ({
  useUpdateCampaign: () => ({ mutate: jest.fn(), isPending: false }),
  useRemoveAssignment: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/features/financeSetup/queries', () => ({
  ASSIGN_ACCESS: 'a',
  ASSIGN_REMOVE_ACCESS: 'b',
  FINANCE_VIEW_ACCESS: 'c',
  SETUP_EDIT_ACCESS: 'd',
  useCampaign: () => ({ data: mockCampaign, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }),
}));

const campaign = (over: Partial<CampaignDetailDTO> = {}): CampaignDetailDTO => ({
  id: 8, name: 'Building fund', description: null, targetAmount: '500000', amountPerMember: '10000', deadline: '2099-01-01T00:00:00.000Z',
  status: 'ACTIVE', category: { id: 4, name: 'Building levy' },
  progress: { totalAssigned: 20000, totalCollected: 10000, remaining: 490000, stillOwed: 10000, progressPercentage: 2, assignedMembers: 2, paidCount: 1, partialCount: 0, pendingCount: 1 },
  assignments: [
    { id: 1, memberId: 7, amount: '10000', assignedAt: '2026-10-01T00:00:00.000Z', paidAmount: 10000, balance: 0, calculatedStatus: 'paid', member: { id: 7, memberId: 'M1', firstName: 'Ada', lastName: 'Obi', email: null }, transaction: { id: 31, status: 'paid' } },
    { id: 2, memberId: 9, amount: '10000', assignedAt: '2026-10-01T00:00:00.000Z', paidAmount: 0, balance: 10000, calculatedStatus: 'pending', member: { id: 9, memberId: 'M2', firstName: 'Bola', lastName: 'Eze', email: null }, transaction: { id: 32, status: 'pending' } },
  ],
  ...over,
});

beforeEach(() => {
  mockPush.mockClear();
  mockCampaign = campaign();
});

describe('Campaign detail', () => {
  it('an active campaign offers to assign members and to close', async () => {
    await render(<CampaignDetailScreen />);
    expect(screen.getByText('Assign members')).toBeTruthy();
    expect(screen.getByText('Close campaign')).toBeTruthy();
    expect(screen.queryByTestId('campaign-closed')).toBeNull();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('a closed campaign takes nobody new and says what is still owed stays owed', async () => {
    mockCampaign = campaign({ status: 'CLOSED' });
    await render(<CampaignDetailScreen />);
    expect(screen.queryByText('Assign members')).toBeNull();
    expect(screen.queryByText('Close campaign')).toBeNull();
    expect(screen.getByTestId('campaign-closed')).toBeTruthy();
    expect(screen.getByText(/1 member still owes this levy.*stay owed and keep being reminded/)).toBeTruthy();
  });

  it('lists every member with what they paid, and opens the assign screen', async () => {
    await render(<CampaignDetailScreen />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Bola Eze')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('campaign-assign'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/finance/levies/assign?id=8');
  });

  it('can remove only a member who has paid nothing', async () => {
    await render(<CampaignDetailScreen />);
    await fireEvent.press(screen.getByTestId('assignment-1'));
    expect(screen.queryByTestId('assignment-remove')).toBeNull(); // Ada has paid
    await fireEvent.press(screen.getByTestId('assignment-2'));
    expect(screen.getByTestId('assignment-remove')).toBeTruthy(); // Bola has not
  });
});
