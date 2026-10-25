import { render, screen } from '@testing-library/react-native';

import type { GuaranteedLoanDTO } from '@/types/api/cooperatives';
import { GuaranteeRow } from './GuaranteeRow';

// Only Avatar reads the theme (its chart palette) — mock the provider, which pulls in native MMKV storage.
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000', '#111111'] }),
}));

describe('GuaranteeRow', () => {
  const base: GuaranteedLoanDTO = {
    id: 1,
    loanApplicationId: 5,
    guaranteeAmount: '25000',
    acceptedAt: '2026-10-21T10:00:00.000Z',
    applicationNumber: 'LA-2610-00001',
    applicantName: 'Austin Anthony',
    productName: 'Emergency Loan',
    applicationStatus: 'DISBURSED',
    loanNumber: null,
    principalAmount: null,
    outstandingBalance: null,
    loanStatus: null,
  };

  it('says "awaiting payout" until a loan number exists', async () => {
    await render(<GuaranteeRow guarantee={base} />);
    expect(screen.getByText(/Emergency Loan.*awaiting payout/)).toBeTruthy();
  });

  it('shows the loan number and loan status once the loan exists', async () => {
    await render(<GuaranteeRow guarantee={{ ...base, loanNumber: 'LN-2610-000001', loanStatus: 'ACTIVE' }} />);
    expect(screen.getByText(/Emergency Loan.*LN-2610-000001/)).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
