import { fireEvent, render, screen } from '@testing-library/react-native';
import { ShieldCheck } from 'lucide-react-native';

import { Money } from '@/components/ui/Money';
import { SummaryHero } from '@/components/ui/SummaryHero';
import type { GuarantorRequestDTO } from '@/types/api/loans';
import { GuarantorRequestCard } from './GuarantorRequestCard';

// The components only read theme colours for SVG/icon fills — mock the provider (it pulls in native MMKV storage)
// so these stay unit tests of the components' own output.
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000', '#111111'] }),
}));

const request: GuarantorRequestDTO = {
  id: 9,
  status: 'PENDING',
  guaranteedAmount: '50000',
  createdAt: '2026-10-21T10:00:00.000Z',
  loanApplication: {
    id: 5,
    amount: '100000',
    purpose: 'Stock for my shop',
    member: { firstName: 'Austin', lastName: 'Anthony', membershipId: 'M-0073' },
    loanProduct: { name: 'Emergency Loan' },
  },
};

describe('SummaryHero', () => {
  it('shows the eyebrow, headline figure, caption and stats', async () => {
    await render(
      <SummaryHero icon={ShieldCheck} eyebrow="Guaranteed on active loans" caption="You may be liable." stats={[{ label: 'Waiting for you', value: '2' }]}>
        <Money value={150000} size="display" tone="onPassbook" />
      </SummaryHero>,
    );
    expect(screen.getByText('Guaranteed on active loans')).toBeTruthy();
    expect(screen.getByText('₦150,000.00')).toBeTruthy();
    expect(screen.getByText('You may be liable.')).toBeTruthy();
    expect(screen.getByText('Waiting for you')).toBeTruthy();
  });
});

describe('GuarantorRequestCard', () => {
  it('shows who is asking, the amounts and the purpose, and wires Accept and Decline', async () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    await render(<GuarantorRequestCard request={request} onAccept={onAccept} onDecline={onDecline} />);

    expect(screen.getByText('Austin Anthony')).toBeTruthy();
    expect(screen.getByText('wants you to guarantee their Emergency Loan')).toBeTruthy();
    expect(screen.getByText('₦100,000.00')).toBeTruthy();
    expect(screen.getByText('₦50,000.00')).toBeTruthy();
    expect(screen.getByText('Stock for my shop')).toBeTruthy();

    fireEvent.press(screen.getByText('Accept'));
    fireEvent.press(screen.getByText('Decline'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
