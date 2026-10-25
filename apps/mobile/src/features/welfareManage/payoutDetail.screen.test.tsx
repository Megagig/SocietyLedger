import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { OfficerPayoutDTO } from '@/types/api/welfareManage';
import PayoutDetailScreen from '../../../app/(app)/(tabs)/manage/welfare/payouts/[id]';

// An officer decides other members' requests, never their own; an approved request is paid out as a separate step.
let mockRequest: OfficerPayoutDTO | undefined;
let mockOwnMemberId: number | undefined;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ id: '8' }) }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleAccess: () => true }));
jest.mock('@/hooks/useMemberId', () => ({ useMemberId: () => mockOwnMemberId }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/coopManage/components/ReasonSheet', () => ({ ReasonSheet: () => null }));
jest.mock('@/features/members/queries', () => ({
  useMemberWelfare: () => ({ data: { totalContributions: '120000', contributionCount: 12, totalPayoutsReceived: '0', pendingRequests: 1 }, isPending: false }),
}));
jest.mock('@/features/welfareManage/mutations', () => ({ useReviewPayout: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/features/welfareManage/queries', () => ({
  WELFARE_MODULE: 'welfare',
  WELFARE_PAYOUT_ACCESS: 'a',
  usePayoutById: () => ({ request: mockRequest, isPending: false, isError: false, error: null, isRefetching: false, refetch: jest.fn() }),
}));

const payout = (over: Partial<OfficerPayoutDTO> = {}): OfficerPayoutDTO => ({
  id: 8, fundId: 2, memberId: 3, requestNumber: 'WPR000008', payoutType: 'MEDICAL', amount: '50000', approvedAmount: null, reason: 'Hospital bill for surgery', supportingDocuments: 'Hospital invoice',
  status: 'PENDING', reviewComments: null, rejectionReason: null, disbursementMethod: null, disbursementReference: null, requestedAt: '2026-10-20T00:00:00.000Z',
  reviewedAt: null, approvedAt: null, disbursedAt: null, fund: { id: 2, name: 'Medical fund', fundType: 'MEDICAL' }, member: { id: 3, memberId: 'M-003', firstName: 'Ada', lastName: 'Obi' },
  reviewer: null, approver: null, disburser: null, ...over,
});

beforeEach(() => {
  mockRequest = payout();
  mockOwnMemberId = undefined;
});

describe('Payout detail', () => {
  it('shows the request and the member\'s standing, and lets another officer approve or reject while it is waiting', async () => {
    await render(<PayoutDetailScreen />);
    expect(screen.getByText('Ada Obi · Medical fund')).toBeTruthy();
    expect(screen.getByText('Hospital bill for surgery')).toBeTruthy();
    expect(screen.getByText('₦120,000.00')).toBeTruthy();
    expect(screen.getByTestId('payout-approve')).toBeTruthy();
    expect(screen.getByTestId('payout-reject')).toBeTruthy();
    expect(screen.queryByTestId('payout-disburse')).toBeNull();
  });

  it('an officer\'s own request can\'t be decided by them', async () => {
    mockOwnMemberId = 3;
    await render(<PayoutDetailScreen />);
    expect(screen.getByTestId('payout-own')).toBeTruthy();
    expect(screen.queryByTestId('payout-approve')).toBeNull();
    expect(screen.queryByTestId('payout-reject')).toBeNull();
  });

  it('an approved request is paid out as a separate step, and shows the approved amount', async () => {
    mockRequest = payout({ status: 'APPROVED', approvedAmount: '30000' });
    await render(<PayoutDetailScreen />);
    expect(screen.getByTestId('payout-disburse')).toBeTruthy();
    expect(screen.queryByTestId('payout-approve')).toBeNull();
    expect(screen.getByText('₦50,000.00 was asked for')).toBeTruthy();
  });

  it('a request already paid out, or rejected, has no actions; a rejection shows its reason', async () => {
    mockRequest = payout({ status: 'REJECTED', rejectionReason: 'Not eligible yet' });
    await render(<PayoutDetailScreen />);
    expect(screen.getByText('Not eligible yet')).toBeTruthy();
    expect(screen.queryByTestId('payout-approve')).toBeNull();
    expect(screen.queryByTestId('payout-disburse')).toBeNull();
  });

  it('a paid-out request cannot be paid out again', async () => {
    mockRequest = payout({ status: 'DISBURSED', approvedAmount: '30000' });
    await render(<PayoutDetailScreen />);
    expect(screen.queryByTestId('payout-disburse')).toBeNull();
    expect(screen.getAllByText('Paid out').length).toBeGreaterThan(0);
  });
});
