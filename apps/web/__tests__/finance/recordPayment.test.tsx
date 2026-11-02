/**
 * @jest-environment jsdom
 */
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
// jsdom has no layout engine; Mantine reads these.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.HTMLElement.prototype.scrollIntoView = () => {};

const mockOpenCharges = jest.fn();
const mockMutate = jest.fn();
const mockDownload = jest.fn();
const mockToast = jest.fn();

jest.mock('@/lib/finance/collections', () => {
  const actual = jest.requireActual('@/lib/finance/collections');
  return {
    ...actual,
    useOpenCharges: () => mockOpenCharges(),
    useRecordPayments: () => ({ mutateAsync: (...a: unknown[]) => mockMutate(...a), isPending: false }),
    downloadCollection: (...a: unknown[]) => mockDownload(...a),
  };
});
jest.mock('@/lib/toast', () => ({ toast: { error: (m: string) => mockToast(m), success: jest.fn() } }));
jest.mock('@/components/coop/CoopStates', () => ({
  CoopEmpty: ({ title }: { title: string }) => <p>{title}</p>,
  CoopError: () => <p>error</p>,
  CoopLoading: () => <p>loading</p>,
}));

import { RecordPaymentDialog } from '@/components/finance/RecordPaymentDialog';
import { CollectionToolbar } from '@/components/finance/CollectionToolbar';
import { SETTLEMENT_TABS } from '@/lib/finance/collections';

const charges = {
  member: { id: 9, memberNumber: 'MEM0001', name: 'JohnPaul Afuecheta' },
  canRecord: true,
  reason: null,
  totalOwed: 9000,
  charges: [
    { transactionId: 1, kind: 'levy', label: 'Mum Burial Levy', category: 'Burial', purpose: 'Mum Burial Levy', amount: 3000, paid: 0, balance: 3000, status: 'unpaid', dueDate: null },
    { transactionId: 2, kind: 'charge', label: 'Annual Dues', category: 'Dues', purpose: 'Annual Dues', amount: 6000, paid: 1000, balance: 5000, status: 'part', dueDate: null },
    { transactionId: 3, kind: 'penalty', label: 'Late Payment Fine', category: 'Fine', purpose: 'Late Payment Fine', amount: 1000, paid: 0, balance: 1000, status: 'unpaid', dueDate: null },
  ],
};

function mount(node: React.ReactNode): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<MantineProvider env="test">{node}</MantineProvider>));
  return el;
}

const text = () => document.body.textContent ?? '';
const click = (el: Element | null) => act(() => void (el as HTMLElement).click());
const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const buttonByText = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined;
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
const amounts = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="number"]'));

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = '';
  mockOpenCharges.mockReturnValue({ isLoading: false, isError: false, data: charges, refetch: jest.fn() });
});

describe('RecordPaymentDialog', () => {
  it('lists every open debt and ticks them all, at their full balance, when no single debt was chosen (the Member Ledger)', () => {
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="member-ledger" />);
    expect(text()).toContain('JohnPaul Afuecheta');
    expect(text()).toContain('Mum Burial Levy');
    expect(text()).toContain('Burial'); // the category stays, with the real levy named under it
    expect(text()).toContain('Annual Dues');
    expect(boxes().map((b) => b.checked)).toEqual([true, true, true]);
    expect(amounts().map((a) => a.value)).toEqual(['3000', '5000', '1000']);
    expect(text()).toContain('₦9,000.00');
  });

  it('ticks only the debt that was clicked when the screen has just one (levy campaign, donation, penalty)', () => {
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="levy-campaign" preselectTransactionId={1} />);
    expect(boxes().map((b) => b.checked)).toEqual([true, false, false]);
    expect(amounts()).toHaveLength(1);
  });

  it('sends the ticked debts and amounts together, with the method and the screen, then shows a receipt for each', async () => {
    mockMutate.mockResolvedValue([
      { paymentId: 1, transactionId: 1, label: 'Mum Burial Levy', amountPaid: '3000', receiptNumber: 'RCP000001-111111', transactionStatus: 'paid', remainingBalance: '0' },
      { paymentId: 2, transactionId: 2, label: 'Annual Dues', amountPaid: '2000', receiptNumber: 'RCP000002-111111', transactionStatus: 'partial', remainingBalance: '3000' },
    ]);
    const onRecorded = jest.fn();
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="member-ledger" onRecorded={onRecorded} />);
    click(boxes()[2]); // leave the fine for later
    type(amounts()[1], '2000'); // part payment on the dues
    await act(async () => void buttonByText('Record payment')!.click());
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ transactionId: 1, amountPaid: 3000 }, { transactionId: 2, amountPaid: 2000 }], paymentMethod: 'cash', source: 'member-ledger' }),
    );
    expect(onRecorded).toHaveBeenCalled();
    expect(text()).toContain('All 2 payments were saved.');
    expect(text()).toContain('RCP000001-111111');
    expect(text()).toContain('RCP000002-111111');
    expect(text()).toContain('Still owes');
  });

  it('refuses an amount above the balance, or zero, before anything is sent', () => {
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="levy-campaign" preselectTransactionId={1} />);
    type(amounts()[0], '5000');
    expect(text()).toContain('At most 3,000.00');
    expect(buttonByText('Record payment')!.disabled).toBe(true);
    type(amounts()[0], '0');
    expect(text()).toContain('Enter an amount above zero.');
    expect(buttonByText('Record payment')!.disabled).toBe(true);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('cannot record with nothing ticked', () => {
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="member-ledger" />);
    boxes().forEach((b) => click(b));
    expect(buttonByText('Record payment')!.disabled).toBe(true);
  });

  it('marks the debt the server stopped on, says nothing was saved, and keeps the dialog open to fix it', async () => {
    mockMutate.mockRejectedValue({ response: { data: { message: 'Payment amount exceeds balance. Maximum: 3000', code: 'OVER_BALANCE', transactionId: 1 } } });
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="levy-campaign" preselectTransactionId={1} />);
    await act(async () => void buttonByText('Record payment')!.click());
    expect(text()).toContain('Payment amount exceeds balance. Maximum: 3000');
    expect(text()).toContain('Nothing was saved.');
    expect(text()).not.toContain('payments were saved');
  });

  it('shows the reason and blocks the form when an officer is looking at their own debt', () => {
    mockOpenCharges.mockReturnValue({ isLoading: false, isError: false, data: { ...charges, canRecord: false, reason: 'Another officer needs to record your payment.' }, refetch: jest.fn() });
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="member-ledger" />);
    expect(text()).toContain('Another officer needs to record your payment.');
    expect(buttonByText('Record payment')!.disabled).toBe(true);
    expect(boxes().every((b) => b.disabled)).toBe(true);
  });

  it('says so when the member owes nothing', () => {
    mockOpenCharges.mockReturnValue({ isLoading: false, isError: false, data: { ...charges, charges: [], totalOwed: 0 }, refetch: jest.fn() });
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} source="member-ledger" />);
    expect(text()).toContain('Nothing owing');
  });

  it('shows an anonymous donor as anonymous, not by name', () => {
    mount(<RecordPaymentDialog opened onClose={jest.fn()} memberId={9} memberLabel="Anonymous donor" source="donations" preselectTransactionId={1} />);
    expect(text()).toContain('Anonymous donor');
    expect(text()).not.toContain('JohnPaul Afuecheta');
  });
});

describe('CollectionToolbar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const props = { screen: 'levy-campaign' as const, id: 11, search: '', status: 'all' as const, onSearch: jest.fn(), onStatus: jest.fn(), tabs: SETTLEMENT_TABS };

  it('searches after a pause in typing, once, not on every key', () => {
    const onSearch = jest.fn();
    mount(<CollectionToolbar {...props} onSearch={onSearch} />);
    const input = document.querySelector('input[type="search"]') as HTMLInputElement;
    type(input, 'a');
    type(input, 'ad');
    type(input, 'ada');
    expect(onSearch).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(350));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('ada');
  });

  it('offers Everyone, Yet to pay, Not paid, Part paid and Paid, and reports the choice', () => {
    const onStatus = jest.fn();
    mount(<CollectionToolbar {...props} onStatus={onStatus} />);
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map((t) => t.textContent);
    expect(tabs).toEqual(['Everyone', 'Yet to pay', 'Not paid', 'Part paid', 'Paid']);
    click(document.querySelectorAll('[role="tab"]')[1]);
    expect(onStatus).toHaveBeenCalledWith('owing');
  });

  it('exports exactly the current filter and search, as Excel or PDF', async () => {
    mockDownload.mockResolvedValue(undefined);
    mount(<CollectionToolbar {...props} status="owing" search="ada" />);
    await act(async () => void buttonByText('Excel')!.click());
    expect(mockDownload).toHaveBeenLastCalledWith({ screen: 'levy-campaign', format: 'xlsx', status: 'owing', search: 'ada', id: 11, allocationId: undefined });
    await act(async () => void buttonByText('PDF')!.click());
    expect(mockDownload).toHaveBeenLastCalledWith(expect.objectContaining({ format: 'pdf', status: 'owing', search: 'ada' }));
  });

  it('tells the officer when the file could not be made', async () => {
    mockDownload.mockRejectedValue(new Error('boom'));
    mount(<CollectionToolbar {...props} />);
    await act(async () => void buttonByText('PDF')!.click());
    expect(mockToast).toHaveBeenCalledWith('We could not create the file. Please try again.');
  });
});
