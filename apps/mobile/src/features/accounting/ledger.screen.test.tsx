/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { ChartAccountDTO, LedgerDTO, LedgerLineDTO } from '@/types/api/accounting';
import AccountsScreen from '../../../app/(app)/(tabs)/manage/accounting/accounts';
import LedgerScreen from '../../../app/(app)/(tabs)/manage/accounting/ledger';

// Opening an account: the chart lists accounts that open their ledger, and a ledger shows how its balance was made up, line by line.
let mockAllowed: string[] = [];
let mockParams: Record<string, string> = {};
let mockLedger: LedgerDTO;
let mockAccounts: ChartAccountDTO[] = [];
const mockPush = jest.fn();
const mockUseLedger = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }), useLocalSearchParams: () => mockParams }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)) }));
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#111111'] }) }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: ({ rightActions }: { rightActions?: ReactNode }) => rightActions ?? null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/forms/OptionDropdown', () => ({ OptionDropdown: () => null }));
jest.mock('@/components/forms/SearchField', () => ({ SearchField: () => null }));
jest.mock('@/features/financeSetup/components/PagedList', () => ({
  PagedList: ({ items, renderItem, header, empty }: { items: unknown[]; renderItem: (item: never, i: number, n: number) => ReactElement; header?: ReactElement; empty: ReactNode }) => {
    const { View } = require('react-native');
    return (
      <View>
        {header}
        {items.length === 0 ? empty : items.map((item, i) => <View key={i}>{renderItem(item as never, i, items.length)}</View>)}
      </View>
    );
  },
}));
jest.mock('@/features/accounting/mutations', () => ({ useInitializeChart: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/features/accounting/queries', () => ({
  useAccountingAccess: () => mockAllowed.includes('FINANCE_VIEW'),
  useAccounts: () => ({ data: mockAccounts, isPending: false, isError: false, refetch: jest.fn(), isRefetching: false }),
  useLedgerInfinite: (...args: unknown[]) => {
    mockUseLedger(...args);
    return { data: { pages: [mockLedger] }, isPending: false, isError: false, refetch: jest.fn(), isRefetching: false, isFetchingNextPage: false, hasNextPage: false, fetchNextPage: jest.fn() };
  },
}));

const line = (over: Partial<LedgerLineDTO> & { lineId: number }): LedgerLineDTO => ({
  entryId: 10, entryNumber: 'JE-2026-00001', entryDate: '2026-10-05T12:00:00.000Z', entryDescription: 'Dues from Ada', lineDescription: null, reference: null, sourceType: null,
  accountId: 1, accountCode: '1112', accountName: 'Bank', debit: '500', credit: '0', effect: '500', balance: '500', ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAllowed = ['FINANCE_VIEW', 'FINANCE_EDIT'];
  mockParams = { accountId: '1', title: 'Bank' };
  mockAccounts = [
    { id: 1, code: '1112', name: 'Bank', type: 'ASSET', subType: 'current_asset', description: null, parentId: null, isActive: true, isSystemAccount: false, normalBalance: 'DEBIT', balance: '800' },
  ];
  mockLedger = {
    accounts: [{ id: 1, code: '1112', name: 'Bank', type: 'ASSET', normalBalance: 'DEBIT', parentId: null, isActive: true }],
    range: { from: null, to: null },
    opening: '0',
    totalDebit: '800',
    totalCredit: '200',
    movement: '600',
    closing: '600',
    subAccounts: [],
    lines: [line({ lineId: 1 }), line({ lineId: 2, entryId: 11, entryNumber: 'JE-2026-00002', debit: '0', credit: '200', effect: '-200', balance: '300' })],
    pagination: { page: 1, limit: 30, totalCount: 2, totalPages: 1, hasMore: false },
  };
});

describe('the chart of accounts', () => {
  it('opens an account as its ledger, for every officer who can read the books', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<AccountsScreen />);
    await fireEvent.press(screen.getByTestId('account-row-1'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/accounting/ledger?accountId=1&title=Bank');
  });
});

describe('a ledger', () => {
  it('asks for the account it was opened for, carrying the dates it was opened with', async () => {
    mockParams = { accountId: '1', title: 'Bank', from: '2026-10-01', to: '2026-10-31' };
    await render(<LedgerScreen />);
    expect(mockUseLedger.mock.calls[0]?.[0]).toMatchObject({ accountId: 1, from: '2026-10-01', to: '2026-10-31' });
  });

  it('asks for a whole section by its scope', async () => {
    mockParams = { scope: 'INCOME', title: 'Income' };
    await render(<LedgerScreen />);
    expect(mockUseLedger.mock.calls[0]?.[0]).toMatchObject({ scope: 'INCOME', accountId: undefined });
  });

  it('shows how the balance was made: opening, debits, credits and closing', async () => {
    await render(<LedgerScreen />);
    expect(screen.getByTestId('ledger-opening')).toBeTruthy();
    expect(screen.getByTestId('ledger-closing')).toBeTruthy();
    expect(screen.getByTestId('ledger-debits')).toBeTruthy();
    expect(screen.getByTestId('ledger-credits')).toBeTruthy();
  });

  it('lists each posted line and opens its journal entry', async () => {
    await render(<LedgerScreen />);
    expect(screen.getByTestId('ledger-line-1')).toBeTruthy();
    expect(screen.getByTestId('ledger-line-2')).toBeTruthy();
    expect(screen.getAllByText('Balance after')).toHaveLength(2);
    await fireEvent.press(screen.getByTestId('ledger-line-1'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/accounting/journal/10');
  });

  it('says so when nothing has been posted', async () => {
    mockLedger = { ...mockLedger, lines: [], totalDebit: '0', totalCredit: '0', movement: '0', closing: '0' };
    await render(<LedgerScreen />);
    expect(screen.getByText('Nothing posted')).toBeTruthy();
  });

  it('lists sub-accounts that open their own ledger for the same dates', async () => {
    mockParams = { accountId: '1', title: 'Bank', from: '2026-10-01', to: '2026-10-31' };
    mockLedger = { ...mockLedger, subAccounts: [{ id: 5, code: '1113', name: 'Savings bank', balance: '300' }] };
    await render(<LedgerScreen />);
    await fireEvent.press(screen.getByTestId('ledger-sub-5'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/accounting/ledger?accountId=5&title=Savings%20bank&from=2026-10-01&to=2026-10-31');
  });

  it('offers to change a single account to someone who may edit', async () => {
    await render(<LedgerScreen />);
    expect(screen.getByTestId('ledger-edit')).toBeTruthy();
  });

  it('offers no change to someone who may only read', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<LedgerScreen />);
    expect(screen.queryByTestId('ledger-edit')).toBeNull();
  });

  it('shows nothing to someone who may not read the books', async () => {
    mockAllowed = [];
    await render(<LedgerScreen />);
    expect(screen.queryByTestId('ledger-summary')).toBeNull();
  });
});
