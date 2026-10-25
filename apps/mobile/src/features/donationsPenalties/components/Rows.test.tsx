import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AllocationDTO, DonationListItemDTO, PenaltyRuleDTO, WaiverDTO } from '@/types/api/donationsPenalties';
import { AllocationRow, DonationRow, RuleRow, WaiverRow } from './Rows';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const donation = (over: Partial<DonationListItemDTO> = {}): DonationListItemDTO => ({
  id: 12, receiptNumber: 'DON-1', amount: 25000, paidAmount: 25000, status: 'paid', isVoided: false, dueDate: null, isPledge: false,
  donor: { id: 3, memberId: 'M3', name: 'Ada Obi' }, category: 'Building fund', allocation: { id: 2, name: 'Hall roof', type: 'project' },
  donorMessage: null, createdAt: '2026-10-20T10:00:00.000Z', ...over,
});

const rule = (over: Partial<PenaltyRuleDTO> = {}): PenaltyRuleDTO => ({
  id: 4, name: 'Late dues fee', description: null, categoryId: null, category: null, triggerType: 'late_payment', gracePeriodDays: 7,
  feeType: 'fixed', feeAmount: '500', maxFeeAmount: null, isCompounding: false, compoundingDays: null, isActive: true, ...over,
});

describe('DonationRow', () => {
  it('shows the donor, the cause and fund, the amount and that it was received, and opens on press', async () => {
    const onPress = jest.fn();
    const item = donation();
    await render(<DonationRow item={item} position="only" onPress={onPress} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Building fund · Hall roof')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('donation-row-12'));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('a pledge says it is pledged and when, an anonymous donor stays anonymous', async () => {
    await render(<DonationRow item={donation({ isPledge: true, status: 'pending', paidAmount: 0, dueDate: '2026-12-01T00:00:00.000Z', donor: { name: 'Anonymous' } })} position="only" />);
    expect(screen.getByText('Pledged')).toBeTruthy();
    expect(screen.getByText('Anonymous')).toBeTruthy();
    expect(screen.getByText(/^Pledged for /)).toBeTruthy();
  });
});

describe('AllocationRow', () => {
  const fund = (over: Partial<AllocationDTO> = {}): AllocationDTO => ({
    id: 2, name: 'Hall roof', description: null, type: 'project', targetAmount: '500000', isActive: true,
    stats: { totalDonated: 100000, donationCount: 4, progressPercentage: 20, remaining: 400000 }, ...over,
  });

  it('shows the kind, what it has received over its target and the number of gifts', async () => {
    await render(<AllocationRow item={fund()} position="only" onPress={jest.fn()} />);
    expect(screen.getByText('Hall roof')).toBeTruthy();
    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByText(/4 donations/)).toBeTruthy();
  });

  it('a fund with no target shows no bar, and a switched-off fund says so', async () => {
    await render(<AllocationRow item={fund({ targetAmount: null, isActive: false, stats: { totalDonated: 0, donationCount: 1, progressPercentage: null, remaining: null } })} position="only" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Inactive')).toBeTruthy();
    expect(screen.getByText(/1 donation$/)).toBeTruthy();
  });
});

describe('RuleRow', () => {
  it('shows whether the rule is on, what it charges, when and what it covers', async () => {
    await render(<RuleRow item={rule()} position="only" onPress={jest.fn()} />);
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('₦500.00 flat')).toBeTruthy();
    expect(screen.getByText('After 7 days · once · All dues and levies')).toBeTruthy();
  });

  it('a switched-off rule says Off', async () => {
    await render(<RuleRow item={rule({ isActive: false })} position="only" />);
    expect(screen.getByText('Off')).toBeTruthy();
  });
});

describe('WaiverRow', () => {
  it('shows who was forgiven, the amount and the reason', async () => {
    const waiver: WaiverDTO = {
      id: 9, transactionId: 40, waivedAmount: '2000', reason: 'First offence', waivedAt: '2026-10-25T09:00:00.000Z',
      transaction: { member: { id: 3, memberId: 'M3', firstName: 'Ada', lastName: 'Obi' }, category: { id: 5, name: 'Late Payment Fee' } },
    };
    await render(<WaiverRow item={waiver} position="only" />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('First offence')).toBeTruthy();
    expect(screen.getByText(/Late Payment Fee/)).toBeTruthy();
  });
});
