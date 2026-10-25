/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { ApiError } from '@/api/errors';
import type { BudgetPositionDTO, ExpenseDetailDTO, ExpenseDTO } from '@/types/api/expenses';
import ExpenseDetailScreen from '../../../app/(app)/(tabs)/manage/accounting/expenses/[id]';
import ExpenseFormScreen from '../../../app/(app)/(tabs)/manage/accounting/expenses/form';
import ExpensesListScreen from '../../../app/(app)/(tabs)/manage/accounting/expenses';

// Spending: who can record, send, approve and void; that the books are only touched with the approver's password; and the receipt rule.
let mockAllowed: string[] = [];
let mockMe: { id: number; permissions: string[] } = { id: 1, permissions: [] };
let mockParams: Record<string, string> = {};
let mockExpense: ExpenseDetailDTO;
let mockList: ExpenseDTO[] = [];
let mockBudget: BudgetPositionDTO | null = null;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSave = jest.fn();
const mockSubmit = jest.fn();
const mockWithdraw = jest.fn();
const mockApprove = jest.fn();
const mockReject = jest.fn();
const mockVoid = jest.fn();
const mockRemove = jest.fn();
const mockRemoveReceipt = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush, replace: mockReplace }), useLocalSearchParams: () => mockParams }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)) }));
jest.mock('@/stores/session', () => ({ useSessionStore: (select: (s: unknown) => unknown) => select({ user: mockMe }) }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#111111'] }),
  useThemeMode: () => ({ scheme: 'light' }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: ({ rightActions }: { rightActions?: ReactNode }) => rightActions ?? null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/ui/ImageViewerModal', () => ({ ImageViewerModal: () => null }));
jest.mock('@/components/ui/BottomSheet', () => ({ BottomSheet: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/forms/OptionDropdown', () => ({ OptionDropdown: () => null }));
jest.mock('@/components/forms/SearchField', () => ({ SearchField: () => null }));
jest.mock('@/features/financeSetup/components/GroupedRow', () => {
  const actual = jest.requireActual('@/features/financeSetup/components/GroupedRow');
  return {
    ...actual,
    GroupedRow: ({ children, testID, onPress }: { children: ReactNode; testID?: string; onPress?: () => void }) => {
      const { Pressable } = require('react-native');
      return (
        <Pressable testID={testID} onPress={onPress}>
          {children}
        </Pressable>
      );
    },
  };
});
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
      <Pressable testID="reason-confirm" onPress={() => onConfirm('The receipt is for another event')}>
        <Text>Reject expense</Text>
      </Pressable>
    );
  },
}));
// A form field is a plain input wired to the form, so the form's own rules are what is tested
jest.mock('@/components/forms/TextField', () => {
  const { TextInput } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    TextField: ({ control, name, testID }: { control: never; name: string; testID?: string }) => {
      const { field } = useController({ control, name });
      return <TextInput testID={testID ?? `field-${name}`} value={String(field.value ?? '')} onChangeText={field.onChange} />;
    },
  };
});
jest.mock('@/components/forms/AmountField', () => {
  const { TextInput } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    AmountField: ({ control, name, testID }: { control: never; name: string; testID?: string }) => {
      const { field } = useController({ control, name });
      return <TextInput testID={testID ?? `field-${name}`} value={String(field.value ?? '')} onChangeText={field.onChange} />;
    },
  };
});
jest.mock('@/components/forms/PasswordField', () => {
  const { TextInput } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    PasswordField: ({ control, name, testID }: { control: never; name: string; testID?: string }) => {
      const { field } = useController({ control, name });
      return <TextInput testID={testID} value={String(field.value ?? '')} onChangeText={field.onChange} />;
    },
  };
});
jest.mock('@/components/forms/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/forms/SelectSheet', () => {
  const { Pressable, Text } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    SelectSheet: ({ control, name, options }: { control: never; name: string; options: { label: string; value: string }[] }) => {
      const { field } = useController({ control, name });
      return (
        <>
          {options.map((o) => (
            <Pressable key={o.value} testID={`pick-${name}-${o.value}`} onPress={() => field.onChange(o.value)}>
              <Text>{o.label}</Text>
            </Pressable>
          ))}
        </>
      );
    },
  };
});
jest.mock('@/components/forms/FileAttachField', () => {
  const { Pressable, Text } = require('react-native');
  const { useController } = require('react-hook-form');
  return {
    FileAttachField: ({ control, name, testID }: { control: never; name: string; testID?: string }) => {
      const { field } = useController({ control, name });
      return (
        <Pressable testID={testID} onPress={() => field.onChange({ uri: 'file:///receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' })}>
          <Text>Attach</Text>
        </Pressable>
      );
    },
  };
});
jest.mock('@/features/expenses/mutations', () => ({
  useSaveExpense: () => ({ mutate: mockSave, isPending: false }),
  useSubmitExpense: () => ({ mutate: mockSubmit, isPending: false }),
  useWithdrawExpense: () => ({ mutate: mockWithdraw, isPending: false }),
  useApproveExpense: () => ({ mutate: mockApprove, isPending: false }),
  useRejectExpense: () => ({ mutate: mockReject, isPending: false }),
  useVoidExpense: () => ({ mutate: mockVoid, isPending: false }),
  useDeleteExpense: () => ({ mutate: mockRemove, isPending: false }),
  useRemoveReceipt: () => ({ mutate: mockRemoveReceipt, isPending: false }),
}));
const ready = (data: unknown) => ({ data, isPending: false, isError: false, refetch: jest.fn(), isRefetching: false });
jest.mock('@/features/accounting/queries', () => ({ useAccountingAccess: () => mockAllowed.includes('FINANCE_VIEW') }));
jest.mock('@/features/expenses/queries', () => ({
  useExpense: (id: number | undefined) => (id === undefined ? { ...ready(undefined), isPending: true } : ready(mockExpense)),
  useExpensesInfinite: () => ({ ...ready({ pages: [{ vouchers: mockList, totals: { approvedAmount: '120000', approvedCount: 2, waitingForApproval: 1 } }] }), isFetchingNextPage: false, hasNextPage: false, fetchNextPage: jest.fn() }),
  useExpenseOptions: () =>
    ready({ categories: [{ id: 5, code: '5100', name: 'Hall hire', parentId: null }], paidFrom: [{ id: 2, code: '1112', name: 'Bank' }], receiptRequiredAbove: '5000' }),
  useBudgetCheck: () => ready(mockBudget),
  useReceiptLink: () => ready({ url: 'https://files.example/r.jpg', type: 'image/jpeg' }),
}));

const expense = (over: Partial<ExpenseDetailDTO> = {}): ExpenseDetailDTO => ({
  id: 8, voucherNumber: 'EXP-2026-00001', expenseDate: '2026-10-20T12:00:00.000Z', payee: 'Ade Hall', description: 'Hall hire for the AGM', amount: '50000',
  category: { id: 5, code: '5100', name: 'Hall hire' }, paidFrom: { id: 2, code: '1112', name: 'Bank' }, reference: null, noReceiptReason: null, hasReceipt: true, receiptType: 'image/jpeg',
  status: 'PENDING_APPROVAL', createdBy: 3, createdByEmail: 'treasurer@x.ng', submittedAt: '2026-10-20T13:00:00.000Z', approvedBy: null, approvedByEmail: null, approvedAt: null,
  overBudget: false, rejectedByEmail: null, rejectedAt: null, rejectionReason: null, voidedByEmail: null, voidedAt: null, voidReason: null, journalEntryId: null,
  reversalEntryId: null, createdAt: '2026-10-20T12:30:00.000Z', budget: null, otherApprovers: 1, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE', 'FINANCE_APPROVE'];
  mockMe = { id: 1, permissions: [] };
  mockParams = { id: '8' };
  mockExpense = expense();
  mockList = [];
  mockBudget = null;
});

describe('an expense waiting for approval', () => {
  it('lets another officer approve it, but only with the password', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('post-confirm'));
    expect(mockApprove).not.toHaveBeenCalled(); // no password typed
    await fireEvent.changeText(screen.getByTestId('post-password'), 'secret');
    await fireEvent.press(screen.getByTestId('post-confirm'));
    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(1));
    expect(mockApprove.mock.calls[0]?.[0]).toBe('secret');
  });

  it('keeps the sheet open with the reason when the password is wrong', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.changeText(screen.getByTestId('post-password'), 'wrong');
    await fireEvent.press(screen.getByTestId('post-confirm'));
    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(1));
    await act(async () => {
      mockApprove.mock.calls[0]?.[1].onError(new ApiError({ status: 403, code: 'REAUTH_FAILED', message: 'That password is not correct.' }));
    });
    await waitFor(() => expect(screen.getByTestId('post-error')).toBeTruthy());
  });

  it('lets another officer reject it with a reason', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('reason-confirm'));
    expect(mockReject.mock.calls[0]?.[0]).toBe('The receipt is for another event');
  });

  it('never offers the officer who recorded it the chance to approve or reject it', async () => {
    mockMe = { id: 3, permissions: [] };
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-approve')).toBeNull();
    expect(screen.queryByTestId('expense-reject')).toBeNull();
    expect(screen.getByTestId('expense-own-note')).toBeTruthy();
  });

  it('lets the officer who recorded it take it back', async () => {
    mockMe = { id: 3, permissions: [] };
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('expense-withdraw'));
    expect(mockWithdraw).toHaveBeenCalledTimes(1);
  });

  it('shows no approve or reject to someone who may not approve payments', async () => {
    mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE'];
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-approve')).toBeNull();
    expect(screen.queryByTestId('expense-reject')).toBeNull();
  });

  it('tells someone who may not approve payments why there is no button', async () => {
    mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE'];
    await render(<ExpenseDetailScreen />);
    expect(screen.getByTestId('expense-cannot-decide')).toBeTruthy();
    expect(screen.getByText('Waiting for an officer who can approve payments. You can see it, but not decide it.')).toBeTruthy();
  });

  it('does not say that to an approver, or to the officer who recorded it', async () => {
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-cannot-decide')).toBeNull();
    mockMe = { id: 3, permissions: [] };
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-cannot-decide')).toBeNull();
  });

  it('warns the officer who recorded it when nobody else can approve it', async () => {
    mockMe = { id: 3, permissions: [] };
    mockExpense = expense({ otherApprovers: 0 });
    await render(<ExpenseDetailScreen />);
    expect(screen.getByTestId('expense-no-approver')).toBeTruthy();
    expect(screen.getByText(/Give the Treasurer role to someone/)).toBeTruthy();
  });

  it('says nothing about approvers when someone else can approve, or once it is no longer waiting', async () => {
    mockMe = { id: 3, permissions: [] };
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-no-approver')).toBeNull();
    mockExpense = expense({ status: 'APPROVED', otherApprovers: null, journalEntryId: 900 });
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-no-approver')).toBeNull();
  });

  it('tells the approver where the category stands against its budget', async () => {
    mockExpense = expense({ budget: { budgetId: 4, budgetName: '2026 budget', planned: '100000', spent: '80000', thisVoucher: '50000', left: '-30000', overBy: '30000' } });
    await render(<ExpenseDetailScreen />);
    expect(screen.getByTestId('budget-note')).toBeTruthy();
    expect(screen.getByText(/₦30,000.00 over its budget/)).toBeTruthy();
  });
});

describe('a draft', () => {
  beforeEach(() => {
    mockMe = { id: 3, permissions: [] };
    mockExpense = expense({ status: 'DRAFT', submittedAt: null });
  });

  it('can be changed, sent or deleted by the officer who recorded it', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('expense-send'));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('expense-edit'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/(tabs)/manage/accounting/expenses/form', params: { id: '8' } });
    await fireEvent.press(screen.getByTestId('confirm-Delete this draft?'));
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('cannot be changed or sent by anyone else', async () => {
    mockMe = { id: 1, permissions: [] };
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-send')).toBeNull();
    expect(screen.queryByTestId('expense-edit')).toBeNull();
    expect(screen.queryByTestId('expense-delete')).toBeNull();
  });
});

describe('an approved expense', () => {
  beforeEach(() => {
    mockExpense = expense({ status: 'APPROVED', approvedAt: '2026-10-21T10:00:00.000Z', approvedByEmail: 'chair@x.ng', journalEntryId: 900 });
  });

  it('opens the journal entry it made in the books', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('expense-entry'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/accounting/journal/900');
  });

  it('is voided only with a reason and the password', async () => {
    await render(<ExpenseDetailScreen />);
    await fireEvent.press(screen.getByTestId('void-confirm'));
    expect(mockVoid).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('void-reason'), 'Paid twice');
    await fireEvent.press(screen.getByTestId('void-confirm'));
    expect(mockVoid).not.toHaveBeenCalled(); // still no password
    await fireEvent.changeText(screen.getByTestId('void-password'), 'secret');
    await fireEvent.press(screen.getByTestId('void-confirm'));
    await waitFor(() => expect(mockVoid).toHaveBeenCalledTimes(1));
    expect(mockVoid.mock.calls[0]?.[0]).toEqual({ reason: 'Paid twice', password: 'secret' });
  });

  it('offers no void to someone who may not approve payments', async () => {
    mockAllowed = ['FINANCE_VIEW', 'FINANCE_CREATE'];
    await render(<ExpenseDetailScreen />);
    expect(screen.queryByTestId('expense-void')).toBeNull();
  });

  it('says it went over budget when it did', async () => {
    mockExpense = expense({ status: 'APPROVED', overBudget: true, journalEntryId: 900 });
    await render(<ExpenseDetailScreen />);
    expect(screen.getByText('Went over budget')).toBeTruthy();
  });

  it('shows the voided state, with the reversing entry', async () => {
    mockExpense = expense({ status: 'VOIDED', journalEntryId: 900, reversalEntryId: 901, voidReason: 'Paid twice', voidedAt: '2026-10-22T10:00:00.000Z' });
    await render(<ExpenseDetailScreen />);
    expect(screen.getByTestId('expense-voided')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('expense-reversal'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/accounting/journal/901');
    expect(screen.queryByTestId('expense-void')).toBeNull();
  });
});

describe('the receipt', () => {
  it('is shown when there is one, and the reason when there is not', async () => {
    await render(<ExpenseDetailScreen />);
    expect(screen.getByTestId('receipt-image')).toBeTruthy();
    mockExpense = expense({ hasReceipt: false, receiptType: null, noReceiptReason: 'Bus fare, no receipt' });
    await render(<ExpenseDetailScreen />);
    expect(screen.getByText('Reason given: Bus fare, no receipt')).toBeTruthy();
  });
});

describe('the list', () => {
  it('shows each expense and the totals', async () => {
    mockList = [{ ...expense(), id: 8 }];
    await render(<ExpensesListScreen />);
    expect(screen.getByTestId('expense-row-8')).toBeTruthy();
    expect(screen.getByTestId('expense-totals')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('expense-row-8'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(app)/(tabs)/manage/accounting/expenses/[id]', params: { id: '8' } });
  });

  it('offers to record an expense to someone who may', async () => {
    await render(<ExpensesListScreen />);
    expect(screen.getByTestId('expense-new')).toBeTruthy();
  });

  it('offers no way to record one to someone who may only read', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<ExpensesListScreen />);
    expect(screen.queryByTestId('expense-new')).toBeNull();
  });

  it('shows nothing to someone who may not read the books', async () => {
    mockAllowed = [];
    await render(<ExpensesListScreen />);
    expect(screen.queryByTestId('expense-totals')).toBeNull();
  });
});

describe('recording an expense', () => {
  beforeEach(() => {
    mockParams = {};
  });

  const fill = async (amount: string) => {
    await fireEvent.changeText(screen.getByTestId('expense-payee'), 'Ade Hall');
    await fireEvent.changeText(screen.getByTestId('expense-description'), 'Hall hire for the AGM');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), amount);
    await fireEvent.press(screen.getByTestId('pick-categoryAccountId-5'));
    await fireEvent.press(screen.getByTestId('pick-paidFromAccountId-2'));
  };

  it('saves a draft with what was typed, without sending it', async () => {
    await render(<ExpenseFormScreen />);
    await fill('50000');
    await fireEvent.press(screen.getByTestId('expense-save-draft'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ payload: { payee: 'Ade Hall', amount: 50000, categoryAccountId: 5, paidFromAccountId: 2 }, send: false, receipt: null });
  });

  it('sends the picked receipt along, and asks to send for approval', async () => {
    await render(<ExpenseFormScreen />);
    await fill('50000');
    await fireEvent.press(screen.getByTestId('expense-receipt'));
    await fireEvent.press(screen.getByTestId('expense-send'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ send: true, receipt: { uri: 'file:///receipt.jpg', name: 'receipt.jpg', type: 'image/jpeg' } });
  });

  it('does not save with the amount missing', async () => {
    await render(<ExpenseFormScreen />);
    await fireEvent.press(screen.getByTestId('expense-save-draft'));
    await waitFor(() => expect(mockSave).not.toHaveBeenCalled());
  });

  it('says what the receipt rule is for the amount typed', async () => {
    await render(<ExpenseFormScreen />);
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '50000');
    await waitFor(() => expect(screen.getByTestId('expense-receipt-rule').props.children).toContain('needs its receipt'));
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '800');
    await waitFor(() => expect(screen.getByTestId('expense-receipt-rule').props.children).toContain('or say why there is none'));
  });

  it('asks for a reason only while there is no receipt', async () => {
    await render(<ExpenseFormScreen />);
    expect(screen.getByTestId('expense-no-receipt')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('expense-receipt'));
    await waitFor(() => expect(screen.queryByTestId('expense-no-receipt')).toBeNull());
  });

  it('shows the budget note once the category and amount are known', async () => {
    mockBudget = { budgetId: 4, budgetName: '2026 budget', planned: '100000', spent: '60000', thisVoucher: '50000', left: '-10000', overBy: '10000' };
    await render(<ExpenseFormScreen />);
    expect(screen.getByTestId('budget-note')).toBeTruthy();
  });

  it('shows nothing to someone who may not record expenses', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<ExpenseFormScreen />);
    expect(screen.queryByTestId('expense-save-draft')).toBeNull();
  });
});
