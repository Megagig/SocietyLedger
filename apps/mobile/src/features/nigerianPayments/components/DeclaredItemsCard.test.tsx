import { render, screen } from '@testing-library/react-native';

import type { DeclaredItemDTO } from '@/types/api/paymentProofsManage';
import { DeclaredItemsCard, itemNote } from './DeclaredItemsCard';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const item = (overrides: Partial<DeclaredItemDTO> = {}): DeclaredItemDTO => ({
  id: 1,
  referenceNumber: 'TXN-0001',
  category: { id: 3, name: 'Monthly dues', type: 'income' },
  dueDate: '2026-10-31T00:00:00.000Z',
  status: 'pending',
  isVoided: false,
  amount: '5000.00',
  paid: '0',
  balance: '5000.00',
  ...overrides,
});

describe('itemNote', () => {
  it('is empty for a charge that will record its balance', () => {
    expect(itemNote(item())).toBeNull();
  });

  it('explains why a charge records nothing', () => {
    expect(itemNote(item({ isVoided: true }))).toBe('Voided');
    expect(itemNote(item({ status: 'waived' }))).toBe('Waived');
    expect(itemNote(item({ balance: '0', paid: '5000.00' }))).toBe('Already settled');
  });
});

describe('DeclaredItemsCard', () => {
  it('lists each charge at its balance and the total to compare with the bank statement', async () => {
    await render(
      <DeclaredItemsCard
        items={[item(), item({ id: 2, category: { id: 4, name: 'Building levy', type: 'income' }, amount: '2500.00', paid: '500.00', balance: '2000.00' })]}
        total="7000.00"
      />,
    );

    expect(screen.getByText('Monthly dues')).toBeTruthy();
    expect(screen.getByText('Building levy')).toBeTruthy();
    expect(screen.getByText('₦5,000.00')).toBeTruthy();
    expect(screen.getByText('₦2,000.00')).toBeTruthy();
    expect(screen.getByText('Verifying records')).toBeTruthy();
    expect(screen.getByText('₦7,000.00')).toBeTruthy();
  });

  it('shows a note instead of an amount for a charge that records nothing', async () => {
    await render(<DeclaredItemsCard items={[item({ balance: '0', paid: '5000.00' })]} total="0" />);

    expect(screen.getByText('Already settled')).toBeTruthy();
  });
});
