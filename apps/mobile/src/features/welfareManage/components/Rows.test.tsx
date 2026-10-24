import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OfficerContributionDTO, OfficerFundDTO, OfficerPayoutDTO } from '@/types/api/welfareManage';
import { ContributionCard, FundRow, PayoutRow } from './Rows';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const contribution = (over: Partial<OfficerContributionDTO> = {}): OfficerContributionDTO => ({
  id: 5, fundId: 2, memberId: 3, amount: '10000', contributionDate: '2026-10-20T00:00:00.000Z', paymentMethod: 'bank_transfer', reference: 'TRF1', notes: 'Paid at the meeting',
  status: 'PENDING', recordedBy: 50, confirmedAt: null, fund: { id: 2, name: 'Medical fund', fundType: 'MEDICAL' },
  member: { id: 3, memberId: 'M-003', firstName: 'Ada', lastName: 'Obi' }, confirmer: null, ...over,
});

describe('ContributionCard', () => {
  it('shows who paid what into which fund, and lets an allowed officer confirm or reject', async () => {
    const onConfirm = jest.fn();
    const onReject = jest.fn();
    await render(<ContributionCard contribution={contribution()} guard="ok" onConfirm={onConfirm} onReject={onReject} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('M-003 · Medical fund')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('contribution-confirm-5'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('contribution-reject-5'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('one the officer recorded, or made in their own name, shows why and no buttons', async () => {
    await render(<ContributionCard contribution={contribution()} guard="recorder" onConfirm={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('You recorded this contribution, so another officer needs to confirm it.')).toBeTruthy();
    expect(screen.queryByTestId('contribution-confirm-5')).toBeNull();
  });

  it('in their own name says so', async () => {
    await render(<ContributionCard contribution={contribution()} guard="own" onConfirm={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('This contribution is in your own name, so another officer needs to confirm it.')).toBeTruthy();
  });

  it('a decided one has neither buttons nor a note', async () => {
    await render(<ContributionCard contribution={contribution({ status: 'CONFIRMED' })} guard="decided" onConfirm={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.queryByTestId('contribution-confirm-5')).toBeNull();
    expect(screen.queryByTestId('contribution-guard-5')).toBeNull();
  });
});

describe('FundRow', () => {
  const fund = (over: Partial<OfficerFundDTO> = {}): OfficerFundDTO => ({
    id: 2, name: 'Medical fund', description: null, fundType: 'MEDICAL', targetBalance: '500000', currentBalance: '125000', monthlyContribution: null, isContributionMandatory: false,
    minContribution: null, maxPayout: '100000', waitingPeriodDays: 30, minContributionMonths: 3, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', _count: { contributions: 4, payoutRequests: 1 }, ...over,
  });

  it('shows the balance over the target, the rules, and opens on press', async () => {
    const onPress = jest.fn();
    const item = fund();
    await render(<FundRow item={item} position="only" onPress={onPress} />);
    expect(screen.getByText('Medical fund')).toBeTruthy();
    expect(screen.getByText('Pays out up to ₦100,000.00 · waits 30 days · 3 months of contributions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fund-row-2'));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('a closed fund says so', async () => {
    await render(<FundRow item={fund({ status: 'CLOSED' })} position="only" />);
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});

describe('PayoutRow', () => {
  const payout = (over: Partial<OfficerPayoutDTO> = {}): OfficerPayoutDTO => ({
    id: 8, fundId: 2, memberId: 3, requestNumber: 'WPR000008', payoutType: 'MEDICAL', amount: '50000', approvedAmount: null, reason: 'Hospital bill for surgery', supportingDocuments: null,
    status: 'PENDING', reviewComments: null, rejectionReason: null, disbursementMethod: null, disbursementReference: null, requestedAt: '2026-10-20T00:00:00.000Z',
    reviewedAt: null, approvedAt: null, disbursedAt: null, fund: { id: 2, name: 'Medical fund', fundType: 'MEDICAL' }, member: { id: 3, memberId: 'M-003', firstName: 'Ada', lastName: 'Obi' },
    reviewer: null, approver: null, disburser: null, ...over,
  });

  it('shows who asked, for what, from which fund and where it stands', async () => {
    const onPress = jest.fn();
    await render(<PayoutRow item={payout()} position="only" onPress={onPress} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Medical · Medical fund')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payout-row-8'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('an approved request shows the approved amount, not the amount asked', async () => {
    await render(<PayoutRow item={payout({ status: 'APPROVED', approvedAmount: '30000' })} position="only" />);
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('₦30,000.00')).toBeTruthy();
    expect(screen.queryByText('₦50,000.00')).toBeNull();
  });
});
