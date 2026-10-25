import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ProofListItemDTO } from '@/types/api/paymentProofsManage';
import { ProofRow } from './ProofRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const proof = (overrides: Partial<ProofListItemDTO> = {}): ProofListItemDTO => ({
  id: 9,
  associationId: 1,
  transactionId: null,
  transactionIds: [100, 101],
  bankTransferId: null,
  memberId: 40,
  filename: 'receipt.png',
  fileSize: 1000,
  mimeType: 'image/png',
  declarationNote: null,
  paymentMethod: 'bank_transfer',
  status: 'PENDING',
  uploadedAt: new Date().toISOString(),
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  notes: null,
  hasFile: true,
  member: { id: 40, memberId: 'MEM0040', firstName: 'Ngozi', lastName: 'Eze' },
  transaction: null,
  bankTransfer: null,
  ...overrides,
});

describe('ProofRow', () => {
  it('shows who sent it, how they paid, how many charges and its status', async () => {
    await render(<ProofRow proof={proof()} position="only" onPress={() => undefined} />);

    expect(screen.getByText('Ngozi Eze')).toBeTruthy();
    expect(screen.getByText('MEM0040 · Bank transfer')).toBeTruthy();
    expect(screen.getByText(/^2 charges/)).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('counts a single linked charge, and uses the verified wording', async () => {
    await render(<ProofRow proof={proof({ transactionIds: [], transactionId: 7, status: 'APPROVED' })} position="middle" onPress={() => undefined} />);

    expect(screen.getByText(/^1 charge ·/)).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('opens the proof when pressed', async () => {
    const onPress = jest.fn();
    const row = proof();
    await render(<ProofRow proof={row} position="first" onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('proof-row-9'));

    expect(onPress).toHaveBeenCalledWith(row);
  });
});
