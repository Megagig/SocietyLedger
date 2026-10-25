import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { LateFeePreviewDTO } from '@/types/api/donationsPenalties';
import LateFeesScreen from '../../../app/(app)/(tabs)/manage/finance/penalties/late-fees';

// "Apply late fees now" shows who would be charged first, and charges nobody until the officer confirms.
let mockPreview: LateFeePreviewDTO;
let mockCan = true;
const mockApply = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@/hooks/useCan', () => ({ useCan: () => mockCan }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/donationsPenalties/mutations', () => ({ useApplyLateFees: () => ({ mutate: mockApply, isPending: false }) }));
jest.mock('@/features/donationsPenalties/queries', () => ({
  PENALTY_APPROVE_ACCESS: 'a',
  useLateFeePreview: () => ({ data: mockPreview, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }),
}));

const preview = (over: Partial<LateFeePreviewDTO> = {}): LateFeePreviewDTO => ({
  count: 2, memberCount: 2, totalAmount: 1000, truncated: false,
  items: [
    { transactionId: 1, memberId: 3, memberName: 'Ada Obi', chargeName: 'Annual dues', daysOverdue: 30, ruleName: 'Late dues fee', penaltyAmount: 500 },
    { transactionId: 2, memberId: 4, memberName: 'Bola Eze', chargeName: 'Building levy', daysOverdue: 12, ruleName: 'Late dues fee', penaltyAmount: 500 },
  ],
  ...over,
});

beforeEach(() => {
  mockCan = true;
  mockApply.mockClear();
  mockPreview = preview();
});

describe('Apply late fees', () => {
  it('lists who would be charged and the total, and has not charged anyone yet', async () => {
    await render(<LateFeesScreen />);
    expect(screen.getByText('2 late fees for 2 members · ₦1,000.00')).toBeTruthy();
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText(/Annual dues · 30 days overdue/)).toBeTruthy();
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('charges only when the officer confirms', async () => {
    await render(<LateFeesScreen />);
    await fireEvent.press(screen.getByTestId('late-fees-apply'));
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it('with nothing due it says so and offers no button to charge', async () => {
    mockPreview = preview({ count: 0, memberCount: 0, totalAmount: 0, items: [] });
    await render(<LateFeesScreen />);
    expect(screen.getByText('No late fees are due right now.')).toBeTruthy();
    expect(screen.queryByTestId('late-fees-apply')).toBeNull();
  });

  it('an officer who cannot approve sees no preview at all', async () => {
    mockCan = false;
    await render(<LateFeesScreen />);
    expect(screen.queryByTestId('late-fees-apply')).toBeNull();
    expect(screen.queryByText(/late fees for/)).toBeNull();
  });
});
