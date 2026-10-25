/* eslint-disable @typescript-eslint/no-require-imports -- a jest.mock factory can only use require() */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import type { AiAnswerDTO, AiStatusDTO, ReminderSuggestionsDTO } from '@/types/api/ai';
import { clearAllChats } from './history';
import AiCreditsScreen from '../../../app/(app)/(tabs)/manage/ai/credits';
import AiAssistantScreen from '../../../app/(app)/(tabs)/manage/ai/index';
import AiRemindersScreen from '../../../app/(app)/(tabs)/manage/ai/reminders';
import AiReportScreen from '../../../app/(app)/(tabs)/manage/ai/report';

// The assistant screens: who sees what, what happens when the free requests run out, that a reminder goes out with each member's own
// words, and that a payment closed without paying is not left looking like it is waiting.
let mockAllowed: string[] = [];
let mockModuleOff = false;
let mockStatus: AiStatusDTO;
let mockPurchases: { id: number; reference: string; credits: number; amount: string; status: 'pending' | 'success' | 'failed'; paidAt: string | null; createdAt: string }[] = [];
const mockPush = jest.fn();
const mockAsk = jest.fn();
const mockFind = jest.fn();
const mockSend = jest.fn();
const mockStart = jest.fn();
const mockVerify = jest.fn();
const mockOpenAuth = jest.fn();
const mockRefetch = jest.fn();

jest.mock('@/lib/storage', () => ({ getObject: jest.fn(), setObject: jest.fn(), remove: jest.fn(), getString: jest.fn(), setString: jest.fn(), storage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...a: unknown[]) => mockOpenAuth(...a) }));
jest.mock('@/hooks/useCan', () => ({ useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)) }));
jest.mock('@/hooks/useModuleAccess', () => ({ useModuleDisabled: () => mockModuleOff }));
jest.mock('@/hooks/useTenantKey', () => ({ useTenantKey: () => 'oko' }));
jest.mock('@/stores/session', () => ({ useSessionStore: (select: (s: unknown) => unknown) => select({ user: { id: 7 } }) }));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#111111'] }),
  useThemeMode: () => ({ scheme: 'light' }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: ({ rightActions }: { rightActions?: ReactNode }) => rightActions ?? null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/feedback/ModuleLockedScreen', () => ({ ModuleLockedScreen: () => require('react').createElement(require('react-native').Text, null, 'module-locked') }));
jest.mock('@/components/feedback/NoPermission', () => ({ NoPermission: () => require('react').createElement(require('react-native').Text, null, 'no-permission') }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/forms/FieldInput', () => ({ FieldInput: (props: object) => require('react-native').TextInput && require('react').createElement(require('react-native').TextInput, props) }));
jest.mock('@/features/ai/queries', () => ({
  aiKeys: {},
  useAiAccess: () => true,
  useAiCredits: () => ({ data: { status: mockStatus, purchases: mockPurchases }, isPending: false, isRefetching: false, refetch: mockRefetch }),
}));
jest.mock('@/features/ai/mutations', () => ({
  useAskAi: () => ({ mutate: mockAsk, isPending: false }),
  useAiReminders: () => ({ mutate: mockFind, isPending: false, data: undefined }),
  useAiReport: () => ({ mutate: jest.fn(), isPending: false, data: undefined }),
  useStartCreditPurchase: () => ({ mutateAsync: mockStart }),
  useVerifyCreditPurchase: () => ({ mutateAsync: mockVerify }),
}));
jest.mock('@/features/finance/mutations', () => ({ useSendReminders: () => ({ mutateAsync: mockSend, isPending: false }) }));

const status = (over: Partial<AiStatusDTO> = {}): AiStatusDTO => ({
  enabled: true,
  tier: 'PROFESSIONAL',
  allowancePerDay: 30,
  allowanceUsed: 3,
  allowanceLeft: 27,
  credits: 80,
  totalPurchased: 80,
  weights: { question: 1, reminders: 1, report: 5 },
  creditPriceNaira: 20,
  minPurchaseNaira: 3000,
  minimumCredits: 150,
  canAsk: true,
  resetsAt: '2026-10-27T00:00:00Z',
  ...over,
});

const answer = (usage: AiStatusDTO): AiAnswerDTO => ({
  answer: 'Bola Adeyemi owes the most at ₦45,000.00.',
  tables: [{ id: 'owing', title: 'Who owes the most', columns: ['Member', 'Owes'], rows: [['Bola Adeyemi', '₦45,000.00']] }],
  dataUsed: [],
  confidence: 'high',
  period: 'This month',
  units: 1,
  usage,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearAllChats();
  mockAllowed = ['FINANCE_VIEW', 'REPORT_VIEW', 'FINANCE_APPROVE', 'LEDGER_EDIT'];
  mockModuleOff = false;
  mockStatus = status();
  mockPurchases = [];
});

describe('who can open the assistant', () => {
  it('shows a plan without the module why, and a person without finance access no way in', async () => {
    mockModuleOff = true;
    await render(<AiAssistantScreen />);
    expect(screen.getByText('module-locked')).toBeTruthy();
    await screen.unmount();
    mockModuleOff = false;
    mockAllowed = [];
    await render(<AiAssistantScreen />);
    expect(screen.getByText('no-permission')).toBeTruthy();
  });

  it('offers the report only to someone who may write one', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<AiAssistantScreen />);
    expect(screen.queryByTestId('ai-report')).toBeNull();
    expect(screen.getByTestId('ai-reminders')).toBeTruthy();
    await screen.unmount();
    await render(<AiReportScreen />);
    expect(screen.getAllByText('no-permission').length).toBeGreaterThan(0);
  });
});

describe('asking a question', () => {
  it('shows what is left, sends a tapped suggestion, and shows the answer with its table', async () => {
    jest.useFakeTimers();
    mockAsk.mockImplementation((_payload, options) => options.onSuccess(answer(status({ allowanceLeft: 26 }))));
    await render(<AiAssistantScreen />);
    expect(screen.getByTestId('ai-usage-line').props.children).toBe('27 left today · 80 credits');
    await fireEvent.press(screen.getByText('Who owes the most?'));
    expect(mockAsk).toHaveBeenCalledWith({ question: 'Who owes the most?', history: [] }, expect.any(Object));
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Bola Adeyemi owes the most at ₦45,000.00.')).toBeTruthy();
    expect(screen.getByTestId('ai-table-owing')).toBeTruthy();
    jest.useRealTimers();
  });

  it('says plainly and offers to buy credits when nothing is left to pay with', async () => {
    mockAsk.mockImplementation((_payload, options) => options.onError(new ApiError({ status: 429, code: 'AI_ALLOWANCE_EXHAUSTED', message: 'x' })));
    await render(<AiAssistantScreen />);
    await fireEvent.press(screen.getByText('Who owes the most?'));
    expect(screen.getByTestId('ai-out')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ai-buy-out'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/ai/credits');
  });

  it('does not offer to buy to someone who cannot', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    mockStatus = status({ allowanceLeft: 0, credits: 0, canAsk: false });
    await render(<AiAssistantScreen />);
    expect(screen.queryByTestId('ai-buy-out')).toBeNull();
    expect(screen.getByText(/Ask the Treasurer or Administrator to buy credits/)).toBeTruthy();
  });

  it('says so when the assistant is switched off', async () => {
    mockStatus = status({ enabled: false });
    await render(<AiAssistantScreen />);
    expect(screen.getByTestId('ai-off')).toBeTruthy();
  });
});

describe('smart reminders', () => {
  const found: ReminderSuggestionsDTO = {
    suggestions: [
      { memberId: 15, memberName: 'Bola Adeyemi', outstandingAmount: '45000', daysOverdue: 40, suggestedTone: 'formal', suggestedMessage: 'Dear Bola Adeyemi, your ₦45,000.00 is overdue.', reasoning: '', transactionIds: [502] },
      { memberId: 14, memberName: 'Ada Obi', outstandingAmount: '20000', daysOverdue: 12, suggestedTone: 'friendly', suggestedMessage: 'Dear Ada Obi, a reminder.', reasoning: '', transactionIds: [] },
    ],
    totalOwingMembers: 2,
    totalOutstanding: '65000',
    aiWritten: true,
    units: 1,
    usage: status(),
  };

  it('sends each chosen member their own message, and never a member with nothing open', async () => {
    mockFind.mockImplementation((_v, options) => options.onSuccess(found));
    mockSend.mockResolvedValue({ sent: 1, failed: 0, noContact: 0, skippedRecently: 0, message: '' });
    // the screen reads the result from the mutation, so render it with the data present
    jest.requireMock('@/features/ai/mutations').useAiReminders = () => ({ mutate: mockFind, isPending: false, data: found });
    await render(<AiRemindersScreen />);
    expect(screen.getByText('Dear Bola Adeyemi, your ₦45,000.00 is overdue.')).toBeTruthy();
    expect(screen.getByText('No open charge to remind about.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ai-reminder-15'));
    await fireEvent.press(screen.getByTestId('ai-send-reminders'));
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    expect(mockSend).toHaveBeenCalledWith({ transactionIds: [502], message: 'Dear Bola Adeyemi, your ₦45,000.00 is overdue.' });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('says nobody is overdue when there is no one to remind', async () => {
    jest.requireMock('@/features/ai/mutations').useAiReminders = () => ({ mutate: mockFind, isPending: false, data: { ...found, suggestions: [], totalOwingMembers: 0 } });
    await render(<AiRemindersScreen />);
    expect(screen.getByTestId('ai-reminders-none')).toBeTruthy();
  });
});

describe('buying credits', () => {
  beforeEach(() => {
    mockStart.mockResolvedValue({ reference: 'AIC-1', authorizationUrl: 'https://paystack.test/x', credits: 150, amount: 3000 });
  });

  it('is refused to someone who may not spend the association’s money', async () => {
    mockAllowed = ['FINANCE_VIEW'];
    await render(<AiCreditsScreen />);
    expect(screen.getByText('no-permission')).toBeTruthy();
  });

  it('adds the credits and says so when the payment went through', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'success', url: 'societyledger://payments/return?reference=AIC-1' });
    mockVerify.mockResolvedValue({ status: 'success', credits: 150, usage: status() });
    await render(<AiCreditsScreen />);
    await fireEvent.press(screen.getByTestId('ai-pay'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('150 credits added.'));
    expect(mockStart).toHaveBeenCalledWith(150);
  });

  it('stays quiet when Paystack is closed without paying, instead of showing a waiting payment', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'cancel' });
    mockVerify.mockResolvedValue({ status: 'pending', credits: 150, usage: status() });
    await render(<AiCreditsScreen />);
    await fireEvent.press(screen.getByTestId('ai-pay'));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ai-waiting')).toBeNull();
  });

  it('still credits a payment that was made before the page was closed', async () => {
    mockOpenAuth.mockResolvedValue({ type: 'dismiss' });
    mockVerify.mockResolvedValue({ status: 'success', credits: 150, usage: status() });
    await render(<AiCreditsScreen />);
    await fireEvent.press(screen.getByTestId('ai-pay'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('150 credits added.'));
  });

  it('shows a failed start in plain words and charges nothing', async () => {
    mockStart.mockRejectedValue(new ApiError({ status: 400, message: 'The least you can buy is ₦3,000.00.' }));
    await render(<AiCreditsScreen />);
    await fireEvent.press(screen.getByTestId('ai-pay'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The least you can buy is ₦3,000.00.'));
    expect(mockOpenAuth).not.toHaveBeenCalled();
  });
});
