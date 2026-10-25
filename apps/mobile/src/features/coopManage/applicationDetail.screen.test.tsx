import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { OfficerApplicationDTO } from '@/types/api/coopManage';
import ApplicationDetailScreen from '../../../app/(app)/(tabs)/manage/cooperatives/applications/[id]';

// An officer decides other people's loans, never their own; an approved loan is paid out as a separate step.
let mockApplication: OfficerApplicationDTO;
let mockOwnMemberId: number | undefined;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ id: '20' }) }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleAccess: () => true }));
jest.mock('@/hooks/useMemberId', () => ({ useMemberId: () => mockOwnMemberId }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/feedback/ConfirmSheet', () => ({ ConfirmSheet: () => null }));
jest.mock('@/features/coopManage/components/ReasonSheet', () => ({ ReasonSheet: () => null }));
jest.mock('@/features/coopManage/mutations', () => ({ useReviewApplication: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/features/coopManage/queries', () => ({
  COOP_LOANS_ACCESS: 'a',
  COOP_MODULE: 'cooperatives',
  useApplication: () => ({ data: mockApplication, isPending: false, isError: false, isRefetching: false, refetch: jest.fn() }),
}));

const application = (over: Partial<OfficerApplicationDTO> = {}): OfficerApplicationDTO => ({
  id: 20, applicationNumber: 'APP-0020', memberId: 3, memberName: 'Ada Obi', member: null, loanProductId: 2, loanProductName: 'Emergency loan', amount: '100000',
  tenureMonths: 12, interestRate: '10', interestType: 'FLAT', monthlyRepayment: '9166.67', totalRepayment: '110000', totalInterest: '10000', processingFee: '1000',
  purpose: 'School fees for my children this term', status: 'PENDING_REVIEW', guarantors: [{ id: 1, loanApplicationId: 20, guarantorMemberId: 9, guarantorName: 'Bola Eze', guaranteeAmount: '50000', status: 'ACCEPTED', acceptedAt: null, declinedAt: null, declineReason: null }],
  appliedAt: '2026-10-10T00:00:00.000Z', rejectionReason: null, disbursedAt: null, collateralDescription: null, reviewedAt: null, approvedAt: null, ...over,
});

beforeEach(() => {
  mockApplication = application();
  mockOwnMemberId = undefined;
});

describe('Application detail', () => {
  it('shows the loan and its guarantors, and lets another officer approve or reject while it is waiting', async () => {
    await render(<ApplicationDetailScreen />);
    expect(screen.getByText('Ada Obi · Emergency loan')).toBeTruthy();
    expect(screen.getByText('Bola Eze')).toBeTruthy();
    expect(screen.getByTestId('application-approve')).toBeTruthy();
    expect(screen.getByTestId('application-reject')).toBeTruthy();
    expect(screen.queryByTestId('application-disburse')).toBeNull();
  });

  it('an officer\'s own application can\'t be decided by them', async () => {
    mockOwnMemberId = 3;
    await render(<ApplicationDetailScreen />);
    expect(screen.getByTestId('application-own')).toBeTruthy();
    expect(screen.queryByTestId('application-approve')).toBeNull();
    expect(screen.queryByTestId('application-reject')).toBeNull();
  });

  it('an approved application is paid out as a separate step', async () => {
    mockApplication = application({ status: 'APPROVED' });
    await render(<ApplicationDetailScreen />);
    expect(screen.getByTestId('application-disburse')).toBeTruthy();
    expect(screen.queryByTestId('application-approve')).toBeNull();
  });

  it('a loan already paid out, or rejected, has no actions; a rejection shows its reason', async () => {
    mockApplication = application({ status: 'REJECTED', rejectionReason: 'Not eligible yet' });
    await render(<ApplicationDetailScreen />);
    expect(screen.getByText('Not eligible yet')).toBeTruthy();
    expect(screen.queryByTestId('application-approve')).toBeNull();
    expect(screen.queryByTestId('application-disburse')).toBeNull();
  });

  it('a paid-out application cannot be paid out again', async () => {
    mockApplication = application({ status: 'DISBURSED' });
    await render(<ApplicationDetailScreen />);
    expect(screen.queryByTestId('application-disburse')).toBeNull();
  });
});
