import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChargeRow, DrillFigure, PaymentRow } from './Drill';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

describe('DrillFigure', () => {
  it('opens the list behind it when tapped', async () => {
    const onPress = jest.fn();
    await render(<DrillFigure label="Money received" value={25000} onPress={onPress} testID="fig" />);
    expect(screen.getByText('₦25,000.00')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('fig'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a figure of nothing has nothing behind it, so it is not a button', async () => {
    const onPress = jest.fn();
    await render(<DrillFigure label="Still owed" value={0} onPress={onPress} testID="fig" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('₦0.00')).toBeTruthy();
  });

  it('shows a count as a plain number, not as money', async () => {
    await render(<DrillFigure label="Overdue charges" value={1200} format="count" />);
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.queryByText('₦1,200.00')).toBeNull();
  });
});

const charge = { id: 4, referenceNumber: 'R4', memberId: 2, memberNumber: 'M-002', memberName: 'Ada Obi', categoryId: 1, categoryName: 'Monthly dues', categoryType: 'due', amount: '10000', paid: '2500', balance: '7500', status: 'overdue', dueDate: '2026-09-01T00:00:00Z', createdAt: '2026-08-01T00:00:00Z' };

describe('rows', () => {
  it('a charge says who owes it, what for, how much is left, and opens the charge', async () => {
    const onPress = jest.fn();
    await render(<ChargeRow item={charge} position="only" onPress={onPress} />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('₦7,500.00')).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('charge-row-4'));
    expect(onPress).toHaveBeenCalledWith(charge);
  });

  it('a payment says who paid, how much, and flags one made for a cancelled charge', async () => {
    const payment = { id: 9, amountPaid: '5000', paymentDate: '2026-10-02T09:00:00Z', paymentMethod: 'cash', receiptNumber: 'RC-1', chargeId: 4, chargeReference: 'R4', chargeVoided: true, memberId: 2, memberNumber: 'M-002', memberName: 'Ada Obi', categoryId: 1, categoryName: 'Monthly dues', categoryType: 'due' };
    const onPress = jest.fn();
    await render(<PaymentRow item={payment} position="only" onPress={onPress} />);
    expect(screen.getByText('₦5,000.00')).toBeTruthy();
    expect(screen.getByText(/cancelled/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payment-row-9'));
    expect(onPress).toHaveBeenCalledWith(payment);
  });
});
