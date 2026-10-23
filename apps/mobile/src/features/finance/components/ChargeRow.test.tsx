import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ChargeListItemDTO } from '@/types/api/financeManage';
import { ChargeRow } from './ChargeRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const charge = (over: Partial<ChargeListItemDTO> = {}): ChargeListItemDTO => ({
  id: 12, memberId: 7, categoryId: 3, amount: '10000', referenceNumber: 'TXN1', status: 'pending', dueDate: '2026-11-01T00:00:00.000Z', paymentDate: null, notes: null,
  isVoided: false, voidReason: null, createdAt: '2026-10-20T09:00:00.000Z',
  member: { id: 7, memberId: 'M-007', firstName: 'Ada', lastName: 'Obi', email: null }, category: { id: 3, name: 'Annual dues', type: 'due' },
  payments: [], totalPaid: '0', balance: '10000', ...over,
});

describe('ChargeRow', () => {
  it('shows who owes it, what for, the amount and its status, and opens on press', async () => {
    const onPress = jest.fn();
    const row = charge();
    await render(<ChargeRow charge={row} position="only" onPress={onPress} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Annual dues')).toBeTruthy();
    expect(screen.getByText(/^Due /)).toBeTruthy();
    expect(screen.getByText('Unpaid')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('charge-row-12'));
    expect(onPress).toHaveBeenCalledWith(row);
  });

  it('says what is left on a part-paid charge', async () => {
    await render(<ChargeRow charge={charge({ status: 'partial', totalPaid: '4000', balance: '6000' })} position="only" onPress={() => undefined} />);
    expect(screen.getByText('Part paid')).toBeTruthy();
    expect(screen.getByText(/left/)).toBeTruthy();
  });

  it('marks a voided charge', async () => {
    await render(<ChargeRow charge={charge({ isVoided: true })} position="only" onPress={() => undefined} />);
    expect(screen.getByText('Voided')).toBeTruthy();
  });
});
