import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { OpenChargesDTO } from '@/types/api/collections';
import { RecordPaymentSheet } from './RecordPaymentSheet';

const mockCharges = jest.fn();
const mockMutate = jest.fn();

jest.mock('../queries', () => ({
  useOpenCharges: () => mockCharges(),
  useRecordPayments: () => ({ mutateAsync: (...a: unknown[]) => mockMutate(...a), isPending: false }),
}));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/ui/BottomSheet', () => {
  const { forwardRef } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { BottomSheet: forwardRef(({ children }: { children: React.ReactNode }, _ref: unknown) => <View>{children}</View>) };
});
jest.mock('@/components/forms/FieldInput', () => {
  const { TextInput } = jest.requireActual('react-native');
  return { FieldInput: (props: object) => <TextInput {...props} /> };
});
jest.mock('@/components/forms/SelectSheet', () => ({ SelectSheet: () => null }));
jest.mock('@/components/forms/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/forms/TextField', () => ({ TextField: () => null }));
jest.mock('@/components/feedback/ErrorState', () => ({ ErrorState: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));

const data = (over: Partial<OpenChargesDTO> = {}): OpenChargesDTO => ({
  member: { id: 9, memberNumber: 'MEM0001', name: 'JohnPaul Afuecheta' },
  canRecord: true,
  reason: null,
  totalOwed: 9000,
  charges: [
    { transactionId: 1, kind: 'levy', label: 'Mum Burial Levy', category: 'Burial', purpose: 'Mum Burial Levy', amount: 3000, paid: 0, balance: 3000, status: 'unpaid', dueDate: null },
    { transactionId: 2, kind: 'charge', label: 'Annual Dues', category: 'Dues', purpose: 'Annual Dues', amount: 6000, paid: 1000, balance: 5000, status: 'part', dueDate: null },
    { transactionId: 3, kind: 'penalty', label: 'Late Payment Fine', category: 'Fine', purpose: 'Late Payment Fine', amount: 1000, paid: 0, balance: 1000, status: 'unpaid', dueDate: null },
  ],
  ...over,
});

const ref = { current: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockCharges.mockReturnValue({ isPending: false, isError: false, data: data(), refetch: jest.fn() });
});

describe('RecordPaymentSheet', () => {
  it('lists every open debt and ticks them all at their full balance when no single debt was chosen', async () => {
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9 }} source="member-ledger" />);
    expect(screen.getByText(/JohnPaul Afuecheta/)).toBeTruthy();
    expect(screen.getByText('Mum Burial Levy')).toBeTruthy();
    expect(screen.getByText('Annual Dues')).toBeTruthy();
    expect(screen.getByTestId('amount-1').props.value).toBe('3000');
    expect(screen.getByTestId('amount-2').props.value).toBe('5000');
    expect(screen.getByTestId('amount-3').props.value).toBe('1000');
  });

  it('ticks only the debt that was chosen on a screen that has just one', async () => {
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9, preselectTransactionId: 2 }} source="levy-campaign" />);
    expect(screen.queryByTestId('amount-1')).toBeNull();
    expect(screen.getByTestId('amount-2')).toBeTruthy();
  });

  it('refuses an amount above the balance, in full naira, and keeps the button off', async () => {
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9, preselectTransactionId: 1 }} source="levy-campaign" />);
    await fireEvent.changeText(screen.getByTestId('amount-1'), '5000');
    expect(screen.getByText('At most ₦3,000.00.')).toBeTruthy();
    expect(screen.getByTestId('payment-submit').props.accessibilityState?.disabled ?? screen.getByTestId('payment-submit').props.disabled).toBeTruthy();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('sends the ticked debts together, then shows a receipt for each', async () => {
    mockMutate.mockResolvedValue([
      { paymentId: 1, transactionId: 1, label: 'Mum Burial Levy', amountPaid: '3000', receiptNumber: 'RCP000001-1', transactionStatus: 'paid', remainingBalance: '0' },
      { paymentId: 2, transactionId: 2, label: 'Annual Dues', amountPaid: '2000', receiptNumber: 'RCP000002-1', transactionStatus: 'partial', remainingBalance: '3000' },
    ]);
    const onRecorded = jest.fn();
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9 }} source="member-ledger" onRecorded={onRecorded} />);
    await fireEvent.press(screen.getByTestId('charge-3')); // leave the fine for later
    await fireEvent.changeText(screen.getByTestId('amount-2'), '2000');
    await act(async () => {
      fireEvent.press(screen.getByTestId('payment-submit'));
    });
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ items: [{ transactionId: 1, amountPaid: 3000 }, { transactionId: 2, amountPaid: 2000 }], source: 'member-ledger' }));
    expect(onRecorded).toHaveBeenCalled();
    expect(screen.getByText('All 2 payments were saved.')).toBeTruthy();
    expect(screen.getByText('Receipt RCP000001-1')).toBeTruthy();
    expect(screen.getByText('Receipt RCP000002-1')).toBeTruthy();
  });

  it('says nothing was saved and marks the debt the server stopped on', async () => {
    mockMutate.mockRejectedValue({ message: 'Payment amount exceeds balance. Maximum: 3000', transactionId: 1 });
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9, preselectTransactionId: 1 }} source="levy-campaign" />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('payment-submit'));
    });
    expect(screen.getByText('Payment amount exceeds balance. Maximum: 3000')).toBeTruthy();
    expect(screen.getByText('Nothing was saved. Fix the debt marked above and try again.')).toBeTruthy();
  });

  it('shows the reason and blocks recording when an officer is looking at their own debt', async () => {
    mockCharges.mockReturnValue({ isPending: false, isError: false, data: data({ canRecord: false, reason: 'Another officer needs to record your payment.' }), refetch: jest.fn() });
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9 }} source="member-ledger" />);
    expect(screen.getByText('Another officer needs to record your payment.')).toBeTruthy();
    expect(screen.getByTestId('payment-submit').props.accessibilityState?.disabled ?? screen.getByTestId('payment-submit').props.disabled).toBeTruthy();
  });

  it('says so when the member owes nothing, and shows an anonymous donor as anonymous', async () => {
    mockCharges.mockReturnValue({ isPending: false, isError: false, data: data({ charges: [], totalOwed: 0 }), refetch: jest.fn() });
    await render(<RecordPaymentSheet ref={ref} target={{ memberId: 9, memberLabel: 'Anonymous donor' }} source="donations" />);
    expect(screen.getByText('Anonymous donor has no unpaid charges.')).toBeTruthy();
  });
});
