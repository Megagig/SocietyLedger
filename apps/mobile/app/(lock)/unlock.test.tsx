import { render, waitFor } from '@testing-library/react-native';

import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';

import UnlockScreen from './unlock';

jest.mock('@/lib/storage', () => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => map.get(key),
      set: (key: string, value: string) => map.set(key, String(value)),
      remove: (key: string) => map.delete(key),
    },
  };
});

const mockAuthenticate = jest.fn();
jest.mock('@/lib/biometrics', () => ({ authenticateWithDevice: (...args: unknown[]) => mockAuthenticate(...args) }));

jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/features/session/mutations', () => ({ useLogout: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/providers/ThemeProvider', () => ({ useThemeTokens: () => ({ color: { primary: '#000' } }) }));
jest.mock('@/components/layout/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- after the jest.mock calls above
const { toast } = require('sonner-native');

describe('UnlockScreen', () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    (toast.error as jest.Mock).mockClear();
    useAppLockStore.getState().lock();
    usePrefsStore.getState().setBiometricsEnabled(true);
  });

  it('unlocks when the device confirms it is the owner', async () => {
    mockAuthenticate.mockResolvedValue({ success: true });
    await render(<UnlockScreen />);
    await waitFor(() => expect(useAppLockStore.getState().isLocked).toBe(false));
    expect(usePrefsStore.getState().biometricsEnabled).toBe(true);
  });

  it('shows why it failed and stays locked on an ordinary failure', async () => {
    mockAuthenticate.mockResolvedValue({ success: false, error: 'lockout' });
    const screen = await render(<UnlockScreen />);
    await waitFor(() => expect(screen.getByTestId('unlock-failure')).toBeTruthy());
    expect(screen.getByTestId('unlock-failure').props.children).toContain('lockout');
    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it('says nothing when the person simply cancels', async () => {
    mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
    const screen = await render(<UnlockScreen />);
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalled());
    expect(screen.queryByTestId('unlock-failure')).toBeNull();
    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it.each(['not_enrolled', 'passcode_not_set', 'not_available'])('turns app lock off and lets the person in when the device reports %s', async (error) => {
    mockAuthenticate.mockResolvedValue({ success: false, error });
    await render(<UnlockScreen />);
    await waitFor(() => expect(useAppLockStore.getState().isLocked).toBe(false));
    expect(usePrefsStore.getState().biometricsEnabled).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });
});
