import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CashCollectionDTO, CashLodgmentDTO, CashReceiptDTO } from '@/types/api/cash';
import { CollectionRow } from './CollectionRow';
import { LodgmentRow } from './LodgmentRow';
import { PayableAmountRow } from './PayableAmountRow';
import { ReceiptRow } from './ReceiptRow';

jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));

const collection = (over: Partial<CashCollectionDTO> = {}): CashCollectionDTO => ({
  id: 3, title: 'October meeting', meetingId: null, status: 'OPEN', notes: null, openedAt: '2026-10-20T09:00:00.000Z', closedAt: null,
  collectedBy: { id: 10, name: 'Bola Ade' }, receiptCount: 2, collected: 15000, lodged: 0, toLodge: 15000, ...over,
});

const receipt = (over: Partial<CashReceiptDTO> = {}): CashReceiptDTO => ({
  id: 8, receiptNumber: 'CSH8', collectionId: 3, status: 'ACTIVE', total: 6000, createdAt: '2026-10-20T10:00:00.000Z', createdBy: { id: 10, name: 'Bola Ade' },
  voidedAt: null, voidReason: null, member: { id: 7, memberId: 'M-007', name: 'Ada Obi' }, items: [{ id: 1, kind: 'DUES', label: 'Annual dues', amount: 6000 }], ...over,
});

const lodgment = (over: Partial<CashLodgmentDTO> = {}): CashLodgmentDTO => ({
  id: 5, status: 'PENDING', amount: 9000, expectedAmount: 9000, shortfall: 0, shortfallReason: null, depositDate: '2026-10-21T00:00:00.000Z', bankReference: null, hasSlip: true,
  bankAccount: { id: 3, bankName: 'GTBank', accountName: 'Assoc', accountNumber: '0123456789' }, lodgedBy: { id: 10, name: 'Bola Ade' },
  verifiedBy: null, verifiedAt: null, rejectionReason: null, createdAt: '2026-10-21T09:00:00.000Z', collections: [], ...over,
});

describe('CollectionRow', () => {
  it('shows the name, receipts, total and status, and opens on press', async () => {
    const onPress = jest.fn();
    const row = collection();
    await render(<CollectionRow collection={row} position="only" onPress={onPress} />);
    expect(screen.getByText('October meeting')).toBeTruthy();
    expect(screen.getByText(/2 receipts/)).toBeTruthy();
    expect(screen.getByText('₦15,000.00')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('collection-row-3'));
    expect(onPress).toHaveBeenCalledWith(row);
  });

  it('names the collector only when asked', async () => {
    await render(<CollectionRow collection={collection({ status: 'CLOSED' })} position="only" showCollector onPress={() => undefined} />);
    expect(screen.getByText('Collected by Bola Ade')).toBeTruthy();
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});

describe('ReceiptRow', () => {
  it('shows the member, what was paid and the total', async () => {
    await render(<ReceiptRow receipt={receipt()} position="only" />);
    expect(screen.getByText('Ada Obi')).toBeTruthy();
    expect(screen.getByText('Annual dues')).toBeTruthy();
    expect(screen.getByText('₦6,000.00')).toBeTruthy();
  });

  it('marks a voided receipt and shows why', async () => {
    await render(<ReceiptRow receipt={receipt({ status: 'VOIDED', voidReason: 'Wrong member' })} position="only" />);
    expect(screen.getByText('Voided')).toBeTruthy();
    expect(screen.getByText('Voided: Wrong member')).toBeTruthy();
  });

  it('opens the receipt only when it can be acted on', async () => {
    const onPress = jest.fn();
    const row = receipt();
    await render(<ReceiptRow receipt={row} position="only" onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('receipt-row-8'));
    expect(onPress).toHaveBeenCalledWith(row);
  });
});

describe('LodgmentRow', () => {
  it('shows the bank, who lodged it, the amount and its status', async () => {
    await render(<LodgmentRow lodgment={lodgment()} position="only" onPress={() => undefined} />);
    expect(screen.getByText('GTBank')).toBeTruthy();
    expect(screen.getByText(/^Bola Ade · /)).toBeTruthy();
    expect(screen.getByText('₦9,000.00')).toBeTruthy();
    expect(screen.getByText('Waiting')).toBeTruthy();
  });

  it('flags a lodgment that was lodged short', async () => {
    await render(<LodgmentRow lodgment={lodgment({ shortfall: 500, amount: 8500 })} position="only" onPress={() => undefined} />);
    expect(screen.getByText('Lodged short')).toBeTruthy();
  });
});

describe('PayableAmountRow', () => {
  it('offers a one-tap fill for the suggested amount while the box is empty', async () => {
    const onChange = jest.fn();
    await render(<PayableAmountRow label="Annual dues" hint="Owes ₦6,000" value="" onChange={onChange} suggested={6000} testID="row" />);
    await fireEvent.press(screen.getByTestId('row-fill'));
    expect(onChange).toHaveBeenCalledWith('6000');
  });

  it('hides the fill once an amount is typed, and keeps only digits and kobo', async () => {
    const onChange = jest.fn();
    await render(<PayableAmountRow label="Annual dues" hint="Owes ₦6,000" value="5000" onChange={onChange} suggested={6000} testID="row" />);
    expect(screen.queryByTestId('row-fill')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('row-input'), '1,2a3.456');
    expect(onChange).toHaveBeenCalledWith('123.45');
  });

  it('shows why an amount is not acceptable', async () => {
    await render(<PayableAmountRow label="Annual dues" hint="Owes ₦6,000" value="9000" onChange={() => undefined} error="only ₦6,000 is owed." />);
    expect(screen.getByText('only ₦6,000 is owed.')).toBeTruthy();
  });
});
