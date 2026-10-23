import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BankAccountDTO } from '@/types/api/bankManage';
import { BankAccountRow } from './BankAccountRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const account = (overrides: Partial<BankAccountDTO> = {}): BankAccountDTO => ({
  id: 4,
  associationId: 1,
  bankName: 'Guaranty Trust Bank',
  accountName: 'Opuogun State Union',
  accountNumber: '0123456789',
  bankCode: '058',
  isDefault: false,
  isActive: true,
  description: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  ...overrides,
});

describe('BankAccountRow', () => {
  it('shows the bank, the grouped number and the account name', async () => {
    await render(<BankAccountRow account={account()} />);

    expect(screen.getByText('Guaranty Trust Bank')).toBeTruthy();
    expect(screen.getByText('0123 456 789')).toBeTruthy();
    expect(screen.getByText('Opuogun State Union')).toBeTruthy();
  });

  it('marks the default and an inactive account', async () => {
    await render(
      <>
        <BankAccountRow account={account({ isDefault: true })} />
        <BankAccountRow account={account({ id: 5, isActive: false })} />
      </>,
    );

    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Inactive')).toBeTruthy();
  });

  it('opens the account actions only when it can be pressed', async () => {
    const onPress = jest.fn();
    const row = account();
    await render(<BankAccountRow account={row} onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('bank-account-4'));

    expect(onPress).toHaveBeenCalledWith(row);
  });
});
