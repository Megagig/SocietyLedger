import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BankTransferListItemDTO } from '@/types/api/bankManage';
import { TransferRow } from './TransferRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const transfer = (overrides: Partial<BankTransferListItemDTO> = {}): BankTransferListItemDTO => ({
  id: 31,
  associationId: 1,
  transactionId: null,
  bankAccountId: 4,
  memberId: 40,
  senderBankName: 'Access Bank',
  senderAccountNumber: null,
  senderAccountName: 'N. Eze',
  amount: '25000.00',
  reference: 'TRF-2026-001',
  transferDate: '2026-10-20T09:00:00.000Z',
  narration: null,
  status: 'PENDING',
  verifiedBy: null,
  verifiedAt: null,
  notes: null,
  createdAt: '2026-10-20T09:00:00.000Z',
  transaction: null,
  member: { id: 40, memberId: 'MEM0040', firstName: 'Ngozi', lastName: 'Eze' },
  bankAccount: { id: 4, bankName: 'GTBank', accountNumber: '0123456789' },
  paymentProofs: [],
  ...overrides,
});

describe('TransferRow', () => {
  it('shows who it is from, the reference, the sender bank, the amount and its status', async () => {
    await render(<TransferRow transfer={transfer()} position="only" onPress={() => undefined} />);

    expect(screen.getByText('Ngozi Eze')).toBeTruthy();
    expect(screen.getByText(/^TRF-2026-001 · /)).toBeTruthy();
    expect(screen.getByText('Access Bank')).toBeTruthy();
    expect(screen.getByText('₦25,000.00')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('falls back to the sender when no member is named, and uses the matched wording', async () => {
    await render(<TransferRow transfer={transfer({ member: null, memberId: null, status: 'MATCHED' })} position="middle" onPress={() => undefined} />);

    expect(screen.getByText('N. Eze')).toBeTruthy();
    expect(screen.getByText('Matched')).toBeTruthy();
  });

  it('opens the transfer when pressed', async () => {
    const onPress = jest.fn();
    const row = transfer();
    await render(<TransferRow transfer={row} position="first" onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('transfer-row-31'));

    expect(onPress).toHaveBeenCalledWith(row);
  });
});
