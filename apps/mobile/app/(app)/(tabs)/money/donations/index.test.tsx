import { fireEvent, render, screen } from '@testing-library/react-native';

import { toDecimal } from '@/lib/money';
import DonationsScreen from './index';

const mockPush = jest.fn();
const mockDonations = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() }, useFocusEffect: jest.fn() }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/ui/Button', () => ({ Button: () => null }));
jest.mock('@/features/memberFinance/queries', () => ({
  useMemberDonations: () => ({ isPending: false, isRefetching: false, refetch: jest.fn(), data: { donations: mockDonations(), donationCategories: [] } }),
}));

const donation = (over: Record<string, unknown>) => ({
  id: 1,
  referenceNumber: 'TXN1',
  category: { id: 1, name: 'New Member welcome', type: 'donation' },
  amount: toDecimal(100000),
  amountPaid: toDecimal(0),
  balance: toDecimal(100000),
  isPledge: true,
  dueDate: '2026-11-05T00:00:00.000Z',
  isAnonymous: false,
  createdAt: '2026-10-23T10:00:00.000Z',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('My Donations', () => {
  it('shows an unpaid pledge as owed, not as money donated', async () => {
    mockDonations.mockReturnValue([donation({})]);
    await render(<DonationsScreen />);
    expect(screen.getByText('Total donated')).toBeTruthy();
    expect(screen.getAllByText('₦0.00').length).toBeGreaterThan(0); // nothing donated yet
    expect(screen.getByTestId('donations-pledged')).toBeTruthy();
    expect(screen.getByText('Pledged, still to pay')).toBeTruthy();
    expect(screen.getByText('To pay · Pay now')).toBeTruthy();
  });

  it('opens the pay screen for the pledge when tapped', async () => {
    mockDonations.mockReturnValue([donation({ id: 7 })]);
    await render(<DonationsScreen />);
    await fireEvent.press(screen.getByTestId('donation-7'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/(tabs)/money/pay', params: { transactionId: '7' } });
  });

  it('counts a paid donation as donated and gives it no Pay action', async () => {
    mockDonations.mockReturnValue([donation({ id: 2, amount: toDecimal(5000), amountPaid: toDecimal(5000), balance: toDecimal(0), isPledge: false })]);
    await render(<DonationsScreen />);
    expect(screen.getAllByText('₦5,000.00').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('donations-pledged')).toBeNull();
    await fireEvent.press(screen.getByTestId('donation-2'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
