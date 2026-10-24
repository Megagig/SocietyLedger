import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { FinancialSettingsDTO, PaymentsSettingsDTO } from '@/types/api/settings';
import FinancialSettingsScreen from '../../../app/(app)/(tabs)/manage/settings/financial';
import PaymentSettingsScreen from '../../../app/(app)/(tabs)/manage/settings/payments';
import SettingsHubScreen from '../../../app/(app)/(tabs)/manage/settings/index';

// A settings form saves only what changed through the server's checks, and a screen shows only to the officer who may use it.
let mockFinancial: FinancialSettingsDTO;
let mockPayments: PaymentsSettingsDTO;
let mockAllowed: string[] = [];
const mockSaveFinancial = jest.fn();
const mockSavePayments = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush }) }));
jest.mock('sonner-native', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/hooks/useCan', () => ({
  useCan: (alias: string | string[]) => (Array.isArray(alias) ? alias.some((a) => mockAllowed.includes(a)) : mockAllowed.includes(alias)),
}));
jest.mock('@/providers/ThemeProvider', () => ({
  useThemeTokens: () => ({ color: new Proxy({}, { get: () => '#000000' }), chart: ['#000000'] }),
}));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/layout/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/components/layout/StickyFooter', () => ({ StickyFooter: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/components/forms/SelectSheet', () => ({ SelectSheet: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/settings/mutations', () => ({
  useSaveFinancial: () => ({ mutate: mockSaveFinancial, isPending: false }),
  useSavePayments: () => ({ mutate: mockSavePayments, isPending: false }),
}));
jest.mock('@/features/settings/queries', () => ({
  useFinancialSettings: () => ({ data: mockFinancial, isPending: false, isError: false, refetch: jest.fn() }),
  usePaymentsSettings: () => ({ data: mockPayments, isPending: false, isError: false, refetch: jest.fn() }),
  useIntegrationsSettings: () => ({ data: { paystackEnabled: true, nombaEnabled: false, smsProvider: 'none' } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAllowed = ['SETTINGS_EDIT', 'SETTINGS_VIEW'];
  mockFinancial = { enableLateFees: false, lateFeeType: 'fixed', lateFeeAmount: 0, defaultGracePeriodDays: 7, enablePartialPayments: true };
  mockPayments = { enabledChannels: ['bank_transfer', 'cash'], enablePartialPayments: true, receiptAutoGenerate: true, cashLodgmentDueDays: 3 };
});

describe('Financial settings', () => {
  it('keeps Save off until something changes', async () => {
    await render(<FinancialSettingsScreen />);
    expect(screen.getByTestId('fin-save').props.accessibilityState.disabled).toBe(true);
  });

  it('saves a late fee once the officer switches it on and enters an amount', async () => {
    await render(<FinancialSettingsScreen />);
    await fireEvent(screen.getByTestId('fin-late-fees'), 'valueChange', true);
    await fireEvent.changeText(await screen.findByTestId('fin-late-amount'), '500');
    await fireEvent.press(screen.getByTestId('fin-save'));
    await waitFor(() => expect(mockSaveFinancial).toHaveBeenCalledTimes(1));
    expect(mockSaveFinancial.mock.calls[0]?.[0]).toEqual({
      enableLateFees: true,
      lateFeeType: 'fixed',
      lateFeeAmount: 500,
      defaultGracePeriodDays: 7,
      enablePartialPayments: true,
    });
  });

  it('does not save late fees switched on without an amount', async () => {
    await render(<FinancialSettingsScreen />);
    await fireEvent(screen.getByTestId('fin-late-fees'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('fin-save'));
    await waitFor(() => expect(screen.getByText('Enter the late fee, or switch late fees off')).toBeTruthy());
    expect(mockSaveFinancial).not.toHaveBeenCalled();
  });

  it('shows no form to an officer without the edit permission', async () => {
    mockAllowed = ['SETTINGS_VIEW'];
    await render(<FinancialSettingsScreen />);
    expect(screen.queryByTestId('fin-save')).toBeNull();
  });
});

describe('Payment settings', () => {
  it('saves the methods that are on', async () => {
    await render(<PaymentSettingsScreen />);
    await fireEvent(screen.getByTestId('pay-card'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('pay-save'));
    await waitFor(() => expect(mockSavePayments).toHaveBeenCalledTimes(1));
    expect(mockSavePayments.mock.calls[0]?.[0]).toMatchObject({ enabledChannels: ['bank_transfer', 'cash', 'card'] });
  });

  it('will not save with every method switched off', async () => {
    await render(<PaymentSettingsScreen />);
    await fireEvent(screen.getByTestId('pay-bank_transfer'), 'valueChange', false);
    await fireEvent(screen.getByTestId('pay-cash'), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('pay-save'));
    await waitFor(() => expect(screen.getByText('Keep at least one way to pay switched on')).toBeTruthy());
    expect(mockSavePayments).not.toHaveBeenCalled();
  });

  it('shows whether card payments are on, read-only', async () => {
    await render(<PaymentSettingsScreen />);
    expect(screen.getByText('Card payments (Paystack)')).toBeTruthy();
    expect(screen.getByText('On')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('a billing officer without the edit permission can still open it', async () => {
    mockAllowed = ['SETTINGS_BILLING'];
    await render(<PaymentSettingsScreen />);
    expect(screen.getByTestId('pay-save')).toBeTruthy();
  });
});

describe('Settings hub', () => {
  it('lists every settings screen for an officer who can edit', async () => {
    await render(<SettingsHubScreen />);
    for (const id of ['association', 'members-access', 'financial', 'payments', 'notifications']) {
      expect(screen.getByTestId(`settings-${id}`)).toBeTruthy();
    }
    // settings.view is enough to see the plan, as it is on the server
    expect(screen.getByTestId('settings-subscription')).toBeTruthy();
  });

  it('shows a billing officer only payments and the subscription', async () => {
    mockAllowed = ['SETTINGS_BILLING'];
    await render(<SettingsHubScreen />);
    expect(screen.getByTestId('settings-payments')).toBeTruthy();
    expect(screen.getByTestId('settings-subscription')).toBeTruthy();
    expect(screen.queryByTestId('settings-financial')).toBeNull();
    expect(screen.queryByTestId('settings-association')).toBeNull();
  });

  it('opens a screen from its row', async () => {
    await render(<SettingsHubScreen />);
    await fireEvent.press(screen.getByTestId('settings-financial'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/manage/settings/financial');
  });

  it('shows nothing to open to someone with no settings permission', async () => {
    mockAllowed = [];
    await render(<SettingsHubScreen />);
    expect(screen.queryByTestId('settings-financial')).toBeNull();
  });
});
