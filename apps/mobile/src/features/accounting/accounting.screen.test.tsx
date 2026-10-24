/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@/api/errors';
import type { AccountingDashboardDTO, BalanceSheetDTO, BudgetDTO, BudgetVarianceDTO, CashFlowDTO, IncomeStatementDTO, JournalEntryDTO } from '@/types/api/accounting';
import AccountingDashboardScreen from '../../../app/(app)/(tabs)/manage/accounting/index';
import BudgetDetailScreen from '../../../app/(app)/(tabs)/manage/accounting/budgets/[id]';
import JournalDetailScreen from '../../../app/(app)/(tabs)/manage/accounting/journal/[id]';
import JournalFormScreen from '../../../app/(app)/(tabs)/manage/accounting/journal/form';
import StatementsScreen from '../../../app/(app)/(tabs)/manage/accounting/statements';
import SyncStatusScreen from '../../../app/(app)/(tabs)/manage/accounting/sync';

// The books: who can do what to an entry, that an unbalanced entry is never saved, and that a statement says what it adds up to.
let mockAllowed: string[] = [];
let mockMe: { id: number; permissions: string[] } = { id: 1, permissions: [] };
let mockParams: Record<string, string> = {};
let mockEntry: JournalEntryDTO;
let mockBudget: BudgetDTO;
let mockVariance: BudgetVarianceDTO;
let mockDashboard: AccountingDashboardDTO;
let mockIncome: IncomeStatementDTO;
let mockBalance: BalanceSheetDTO;
let mockCash: CashFlowDTO | undefined;
let mockUnsynced = 0;
const mockSave = jest.fn();
const mockSubmit = jest.fn();
const mockDecide = jest.fn();
const mockPost = jest.fn();
const mockApproveBudget = jest.fn();
const mockActivate = jest.fn();
const mockSync = jest.fn();
const mockShare = jest.fn();
const mockPdf = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)) }));
jest.mock('@/stores/session', () => ({ useSessionStore: (select: (s: unknown) => unknown) => select({ user: mockMe }) }));
jest.mock('@/stores/tenant', () => ({ useTenantStore: (select: (s: unknown) => unknown) => select({ current: { name: 'Opuogun Union' } }) }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#111111', '#222222'] }),
  useThemeMode: () => ({ scheme: 'light' }),
}));
jest.mock('react-native-gifted-charts', () => ({ BarChart: () => null }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({
  ScreenHeader: ({ rightActions }: { rightActions?: ReactNode }) => rightActions ?? null,
}));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/ui/SummaryHero', () => ({ SummaryHero: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/forms/SelectSheet', () => ({ SelectSheet: () => null }));
jest.mock('@/components/forms/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/feedback/ConfirmSheet', () => ({
  ConfirmSheet: ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={`confirm-${title}`} onPress={onConfirm}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/features/coopManage/components/ReasonSheet', () => ({
  ReasonSheet: ({ onConfirm }: { onConfirm: (r: string) => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="reason-confirm" onPress={() => onConfirm('Wrong account')}>
        <Text>Reject entry</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/features/reports/components/PeriodPicker', () => ({ PeriodPicker: () => null }));
jest.mock('@/features/reports/labels', () => ({
  ...jest.requireActual('@/features/reports/labels'),
  EXPORT_FINANCIAL_ACCESS: 'EXPORT_FINANCIAL',
}));
jest.mock('@/components/forms/OptionDropdown', () => ({ OptionDropdown: () => null }));
jest.mock('@/features/financeSetup/components/GroupedRow', () => {
  const actual = jest.requireActual('@/features/financeSetup/components/GroupedRow');
  return { ...actual, GroupedRow: ({ children, testID }: { children: ReactNode; testID?: string }) => {
    const { View } = require('react-native');
    return <View testID={testID}>{children}</View>;
  } };
});
jest.mock('react-native/Libraries/Share/Share', () => ({ share: (...a: unknown[]) => mockShare(...a) }));
jest.mock('@/features/accounting/mutations', () => ({
  useSaveEntry: () => ({ mutate: mockSave, isPending: false }),
  useSubmitEntry: () => ({ mutate: mockSubmit, isPending: false }),
  useDecideEntry: () => ({ mutate: mockDecide, isPending: false }),
  usePostEntry: () => ({ mutate: mockPost, isPending: false }),
  useApproveBudget: () => ({ mutate: mockApproveBudget, isPending: false }),
  useActivateBudget: () => ({ mutate: mockActivate, isPending: false }),
  useRunSync: () => ({ mutate: mockSync, isPending: false }),
  useShareStatementPdf: () => ({ mutate: mockPdf, isPending: false }),
}));
const ready = (data: unknown) => ({ data, isPending: false, isError: false, refetch: jest.fn(), isRefetching: false });
jest.mock('@/features/accounting/queries', () => ({
  useAccountingAccess: () => mockAllowed.includes('FINANCE_VIEW'),
  useEntry: () => ready(mockEntry),
  useAccounts: () => ready([{ id: 1, code: '5100', name: 'Hall hire', type: 'EXPENSE', isActive: true }]),
  useBudget: () => ready(mockBudget),
  useBudgetVariance: () => ready(mockVariance),
  useAccountingDashboard: () => ready(mockDashboard),
  useSyncStatus: () => ({
    data: (() => {
      const c = (total: number, unsynced: number) => ({ total, synced: total - unsynced, unsynced, syncRate: '0' });
      return {
        finance: { transactions: c(4, mockUnsynced), payments: c(3, 0) },
        welfare: { contributions: c(2, 0), payouts: c(1, 0) },
        cooperatives: { savingsTransactions: c(0, 0), loans: c(0, 0), loanRepayments: c(0, 0) },
        overall: c(10, mockUnsynced),
      };
    })(),
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useSyncErrors: () => ({ data: [] }),
  useIncomeStatement: () => ready(mockIncome),
  useBalanceSheet: () => ready(mockBalance),
  useCashFlow: () => ready(mockCash),
}));

const entry = (over: Partial<JournalEntryDTO> = {}): JournalEntryDTO => ({
  id: 50, entryNumber: 'JE-2026-00001', entryDate: '2026-10-20T12:00:00.000Z', description: 'Hall hire', reference: null, sourceType: 'manual', sourceId: null,
  status: 'APPROVED', totalDebit: '5000', totalCredit: '5000', createdBy: 3, createdByEmail: 'a@x.ng', approvedBy: 9, approvedByEmail: 'b@x.ng', approvedAt: '2026-10-21T10:00:00.000Z',
  rejectionReason: null, rejectedAt: null, postedAt: null, createdAt: '2026-10-20T10:00:00.000Z',
  lines: [
    { id: 1, accountId: 1, accountCode: '5100', accountName: 'Hall hire', debitAmount: '5000', creditAmount: '0', description: null },
    { id: 2, accountId: 2, accountCode: '1112', accountName: 'Bank', debitAmount: '0', creditAmount: '5000', description: null },
  ],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE', 'FINANCE_EDIT', 'FINANCE_APPROVE'];
  mockMe = { id: 1, permissions: [] };
  mockParams = { id: '50' };
  mockEntry = entry();
  mockUnsynced = 0;
  mockCash = undefined;
  mockBudget = { id: 4, name: '2026 budget', description: null, fiscalYear: 2026, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T22:59:59.999Z', status: 'DRAFT', totalBudget: '100000', createdBy: 3, items: [] };
  mockVariance = {
    budget: mockBudget, period: { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-12-31T22:59:59.999Z' },
    items: [
      { accountId: 4, accountCode: '5100', accountName: 'Hall hire', accountType: 'EXPENSE', budgetAmount: '1000', actualAmount: '1500', variance: '-500', variancePercentage: -50, status: 'over' },
      { accountId: 3, accountCode: '4110', accountName: 'Dues', accountType: 'INCOME', budgetAmount: '9000', actualAmount: '2000', variance: '7000', variancePercentage: 77, status: 'under' },
    ],
    summary: { totalBudget: '10000', totalActual: '3500', totalVariance: '6500', variancePercentage: 65 },
    incomeSummary: { totalBudget: '9000', totalActual: '2000', totalVariance: '7000', variancePercentage: 77 },
    expenseSummary: { totalBudget: '1000', totalActual: '1500', totalVariance: '-500', variancePercentage: -50 },
  };
  mockDashboard = {
    quickStats: { totalAssets: '90000', totalLiabilities: '20000', totalEquity: '70000', netIncome: '15000', cashBalance: '45000' },
    recentEntries: [entry({ status: 'POSTED' })], pendingApprovals: 2, monthlyTrend: [],
  };
  mockIncome = { period: { startDate: '', endDate: '', label: 'October 2026' }, revenue: { total: '12500', accounts: [{ accountId: 3, accountCode: '4110', accountName: 'Dues', balance: '12500' }] }, expenses: { total: '2500', accounts: [] }, netIncome: '10000' };
  mockBalance = {
    asOfDate: '', assets: { current: [], fixed: [], other: [], totalCurrent: '0', totalFixed: '0', totalOther: '0', total: '9000' },
    liabilities: { current: [], longTerm: [], totalCurrent: '0', totalLongTerm: '0', total: '4000' }, equity: { accounts: [], retainedEarnings: '0', total: '4000' },
    totalLiabilitiesAndEquity: '8000', isBalanced: false,
  };
});

describe('an entry on its way to the books', () => {
  it('offers a draft its owner can send for approval, or change', async () => {
    mockEntry = entry({ status: 'DRAFT', createdBy: 1 });
    await render(<JournalDetailScreen />);
    expect(screen.getByTestId('entry-send')).toBeTruthy();
    expect(screen.getByTestId('entry-edit')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('entry-send'));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('lets another officer approve or reject an entry waiting for approval', async () => {
    mockEntry = entry({ status: 'PENDING_APPROVAL', createdBy: 3 });
    await render(<JournalDetailScreen />);
    await fireEvent.press(screen.getByTestId('confirm-Approve this entry?'));
    expect(mockDecide.mock.calls[0]?.[0]).toEqual({ action: 'approve' });
    await fireEvent.press(screen.getByTestId('reason-confirm'));
    expect(mockDecide.mock.calls[1]?.[0]).toEqual({ action: 'reject', reason: 'Wrong account' });
  });

  it('never offers the writer of an entry the chance to approve it', async () => {
    mockEntry = entry({ status: 'PENDING_APPROVAL', createdBy: 1 });
    await render(<JournalDetailScreen />);
    expect(screen.queryByTestId('entry-approve')).toBeNull();
    expect(screen.queryByTestId('entry-reject')).toBeNull();
    expect(screen.getByTestId('entry-own-note')).toBeTruthy();
  });

  it('posts an approved entry only with the password, and keeps the sheet open to try again when it is wrong', async () => {
    await render(<JournalDetailScreen />);
    await fireEvent.press(screen.getByTestId('post-confirm'));
    expect(mockPost).not.toHaveBeenCalled(); // no password typed
    await fireEvent.changeText(screen.getByTestId('post-password'), 'wrong-one');
    await fireEvent.press(screen.getByTestId('post-confirm'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0]?.[0]).toBe('wrong-one');
    await act(async () => {
      mockPost.mock.calls[0]?.[1].onError(new ApiError({ status: 403, code: 'REAUTH_FAILED', message: 'That password is not correct.' }));
    });
    await waitFor(() => expect(screen.getByTestId('post-error')).toBeTruthy());
    expect(screen.getByText('That password is not correct.')).toBeTruthy();
  });

  it('shows the wait on the sheet when too many wrong passwords have been tried', async () => {
    await render(<JournalDetailScreen />);
    await fireEvent.changeText(screen.getByTestId('post-password'), 'whatever');
    await fireEvent.press(screen.getByTestId('post-confirm'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    await act(async () => {
      mockPost.mock.calls[0]?.[1].onError(new ApiError({ status: 429, code: 'REAUTH_LOCKED', message: 'Too many wrong passwords. Try again in about 12 minutes.' }));
    });
    await waitFor(() => expect(screen.getByText('Too many wrong passwords. Try again in about 12 minutes.')).toBeTruthy());
  });

  it('offers nothing to someone who can only read the books', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<JournalDetailScreen />);
    expect(screen.queryByTestId('entry-post')).toBeNull();
    expect(screen.queryByTestId('entry-edit')).toBeNull();
  });

  it('shows why an entry was rejected, and says an entry made by the app is automatic', async () => {
    mockEntry = entry({ status: 'REJECTED', rejectionReason: 'Wrong account', rejectedAt: '2026-10-22T10:00:00.000Z', createdBy: 1 });
    await render(<JournalDetailScreen />);
    expect(screen.getByTestId('entry-rejection')).toBeTruthy();
    expect(screen.getByText('Wrong account')).toBeTruthy();
    mockEntry = entry({ status: 'POSTED', sourceType: 'auto_sync:Payment' });
    await render(<JournalDetailScreen />);
    expect(screen.getByText('Made by the app for a payment')).toBeTruthy();
  });
});

describe('writing an entry', () => {
  it('does not save when debits and credits differ, and says by how much', async () => {
    mockParams = { id: '50' };
    mockEntry = entry({
      status: 'DRAFT',
      lines: [
        { id: 1, accountId: 1, accountCode: '5100', accountName: 'Hall hire', debitAmount: '100', creditAmount: '0', description: null },
        { id: 2, accountId: 2, accountCode: '1112', accountName: 'Bank', debitAmount: '0', creditAmount: '90', description: null },
      ],
    });
    await render(<JournalFormScreen />);
    await waitFor(() => expect(screen.getByTestId('entry-balance-note')).toBeTruthy());
    expect(screen.getByText(/Out by ₦10.00/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('entry-send'));
    await waitFor(() => expect(screen.getByTestId('entry-balance-note')).toBeTruthy());
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('refuses to open an entry that is no longer a draft', async () => {
    mockEntry = entry({ status: 'POSTED' });
    await render(<JournalFormScreen />);
    expect(screen.getByTestId('entry-locked')).toBeTruthy();
    expect(screen.queryByTestId('entry-send')).toBeNull();
  });
});

describe('the accounting dashboard', () => {
  it('shows entries waiting for approval, and the catch-up button to someone who can write entries', async () => {
    mockUnsynced = 4;
    await render(<AccountingDashboardScreen />);
    expect(screen.getByTestId('accounting-pending')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('accounting-sync'));
    expect(mockSync).toHaveBeenCalledTimes(1);
  });

  it('offers the catch-up button to someone who can change the books, not to someone who can only write entries', async () => {
    mockUnsynced = 4;
    mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE'];
    await render(<AccountingDashboardScreen />);
    expect(screen.queryByTestId('accounting-sync')).toBeNull();
  });

  it('offers no catch-up button to someone who can only read', async () => {
    mockUnsynced = 4;
    mockAllowed = ['FINANCE_VIEW'];
    await render(<AccountingDashboardScreen />);
    expect(screen.getByTestId('accounting-unsynced')).toBeTruthy();
    expect(screen.queryByTestId('accounting-sync')).toBeNull();
  });

  it('shows nothing of the books without the permission', async () => {
    mockAllowed = [];
    await render(<AccountingDashboardScreen />);
    expect(screen.queryByTestId('accounting-hero')).toBeNull();
  });
});

describe('the statements', () => {
  it('shows income, spending and the surplus, and offers to share the statement', async () => {
    await render(<StatementsScreen />);
    expect(screen.getByTestId('income-statement')).toBeTruthy();
    expect(screen.getByText('Dues')).toBeTruthy();
    expect(screen.getByTestId('net-income')).toBeTruthy();
    expect(screen.getByTestId('statement-share')).toBeTruthy();
  });

  it('offers the PDF only to someone who may export, and asks the server for the statement on screen', async () => {
    await render(<StatementsScreen />);
    expect(screen.queryByTestId('statement-pdf')).toBeNull();
    mockAllowed = [...mockAllowed, 'EXPORT_FINANCIAL'];
    await render(<StatementsScreen />);
    await fireEvent.press(screen.getByTestId('statement-pdf'));
    expect(mockPdf).toHaveBeenCalledTimes(1);
    expect(mockPdf.mock.calls[0]?.[0]).toMatchObject({ statement: 'income', period: 'this_month' });
  });

  it('warns when the balance sheet does not balance', async () => {
    await render(<StatementsScreen />);
    await fireEvent.press(screen.getByText('Balance sheet'));
    expect(screen.getByTestId('balance-warning')).toBeTruthy();
  });
});

describe('a budget', () => {
  it('lets another officer approve a draft, but not the one who planned it', async () => {
    mockParams = { id: '4' };
    await render(<BudgetDetailScreen />);
    expect(screen.getByTestId('budget-approve')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-Approve this budget?'));
    expect(mockApproveBudget).toHaveBeenCalledTimes(1);

    mockMe = { id: 3, permissions: [] };
    await render(<BudgetDetailScreen />);
    expect(screen.queryByTestId('budget-approve')).toBeNull();
    expect(screen.getByTestId('budget-own-note')).toBeTruthy();
  });

  it('shows spending and income against the plan, each on its own', async () => {
    mockParams = { id: '4' };
    await render(<BudgetDetailScreen />);
    expect(screen.getByTestId('variance-4')).toBeTruthy();
    expect(screen.getByTestId('variance-3')).toBeTruthy();
    expect(screen.getByText('Over budget')).toBeTruthy();
    expect(screen.getByText('Spending against the plan')).toBeTruthy();
    expect(screen.getByText('Income against the plan')).toBeTruthy();
  });

  it('puts an approved budget in force only for someone who can approve', async () => {
    mockParams = { id: '4' };
    mockBudget = { ...mockBudget, status: 'APPROVED' };
    await render(<BudgetDetailScreen />);
    await fireEvent.press(screen.getByTestId('confirm-Put this budget in force?'));
    expect(mockActivate).toHaveBeenCalledTimes(1);
  });
});

describe('as on the website: statements', () => {
  it('shows how the income statement changed since the period before', async () => {
    mockIncome = { ...mockIncome, comparison: { previousPeriod: { revenue: '8000', expenses: '3000', netIncome: '5000' }, changes: { revenue: { amount: '4500', percentage: 56.3 }, expenses: { amount: '-500', percentage: -16.7 }, netIncome: { amount: '5000', percentage: 100 } } } };
    await render(<StatementsScreen />);
    expect(screen.getByTestId('income-comparison')).toBeTruthy();
    expect(screen.getByText('+₦4,500.00 (56.3%)')).toBeTruthy();
    expect(screen.getByText('-₦500.00 (-16.7%)')).toBeTruthy();
  });

  it('shows no comparison unless it was asked for', async () => {
    await render(<StatementsScreen />);
    expect(screen.queryByTestId('income-comparison')).toBeNull();
  });

  it('groups the balance sheet into current and fixed assets and the kinds of liability', async () => {
    mockBalance = { ...mockBalance, isBalanced: true, assets: { ...mockBalance.assets, current: [{ accountId: 1, accountCode: '1112', accountName: 'Bank', balance: '6000' }], fixed: [{ accountId: 2, accountCode: '1210', accountName: 'Equipment', balance: '3000' }], totalCurrent: '6000', totalFixed: '3000' } };
    await render(<StatementsScreen />);
    await fireEvent.press(screen.getByText('Balance sheet'));
    expect(screen.getByText('Current assets')).toBeTruthy();
    expect(screen.getByText('Fixed assets')).toBeTruthy();
    expect(screen.getByText('Long-term liabilities')).toBeTruthy();
    expect(screen.getByText('Equipment')).toBeTruthy();
  });

  it('itemises the cash flow by activity, and says how much the cash changed', async () => {
    const none = { inflows: [], outflows: [], netCash: '0' };
    mockCash = {
      period: { startDate: '', endDate: '', label: 'October 2026' },
      operating: { inflows: [{ description: 'October dues', amount: '3000' }], outflows: [{ description: 'Hall hire', amount: '800' }], netCash: '2200' },
      investing: none, financing: none, netCashChange: '2200', beginningCash: '1000', endingCash: '3200', reconciles: true,
    };
    await render(<StatementsScreen />);
    await fireEvent.press(screen.getByText('Cash flow'));
    expect(screen.getByTestId('cash-operating')).toBeTruthy();
    expect(screen.getByText('In: October dues')).toBeTruthy();
    expect(screen.getByText('Out: Hall hire')).toBeTruthy();
    expect(screen.queryByTestId('cash-investing')).toBeNull(); // nothing moved there
    expect(screen.getByTestId('cash-change-percent')).toBeTruthy();
    expect(screen.getByText('That is a change of 220.0% on the cash at the start.')).toBeTruthy();
  });
});

describe('as on the website: sync status', () => {
  it('lists each kind of record with what is missing, and catches up just that kind', async () => {
    mockUnsynced = 3;
    await render(<SyncStatusScreen />);
    expect(screen.getByTestId('sync-overall')).toBeTruthy();
    expect(screen.getByText('1 of 4 in the books')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sync-transactions'));
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync.mock.calls[0]?.[0]).toBe('transactions');
  });

  it('catches up everything from the top', async () => {
    mockUnsynced = 3;
    await render(<SyncStatusScreen />);
    await fireEvent.press(screen.getByTestId('sync-all'));
    expect(mockSync.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('only shows what is missing to someone who cannot change the books', async () => {
    mockUnsynced = 3;
    mockAllowed = ['FINANCE_VIEW'];
    await render(<SyncStatusScreen />);
    expect(screen.queryByTestId('sync-transactions')).toBeNull();
    expect(screen.queryByTestId('sync-all')).toBeNull();
    expect(screen.getByText('3 missing')).toBeTruthy();
  });

  it('says when everything is in', async () => {
    mockUnsynced = 0;
    await render(<SyncStatusScreen />);
    expect(screen.getByText('Everything is in the books.')).toBeTruthy();
  });
});
