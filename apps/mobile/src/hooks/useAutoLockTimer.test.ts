import { renderHook } from '@testing-library/react-native';
import type { AppStateStatus } from 'react-native';

import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';

let mockAppState: AppStateStatus = 'active';
jest.mock('./useAppState', () => ({ useAppState: () => mockAppState }));

// `prefs.ts` persists via the real `lib/storage.ts` → `react-native-mmkv`, unavailable under
// Jest — mocked with the same in-memory fake `client.test.ts` already established.
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

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { useAutoLockTimer } = require('./useAutoLockTimer');

describe('useAutoLockTimer', () => {
  beforeEach(() => {
    mockAppState = 'active';
    usePrefsStore.getState().setBiometricsEnabled(true);
    usePrefsStore.getState().setAutoLockMinutes(5);
    useAppLockStore.getState().unlock();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('does nothing while biometrics is disabled', async () => {
    usePrefsStore.getState().setBiometricsEnabled(false);
    const { rerender } = await renderHook(() => useAutoLockTimer());
    mockAppState = 'background';
    await rerender({});
    jest.setSystemTime(new Date('2026-01-01T00:10:00Z'));
    mockAppState = 'active';
    await rerender({});
    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it('locks after returning from background longer than the configured timeout', async () => {
    const { rerender } = await renderHook(() => useAutoLockTimer());

    mockAppState = 'background';
    await rerender({});
    jest.setSystemTime(new Date('2026-01-01T00:06:00Z')); // 6 min > 5 min timeout
    mockAppState = 'active';
    await rerender({});

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it('does not lock when returning from background sooner than the timeout', async () => {
    const { rerender } = await renderHook(() => useAutoLockTimer());

    mockAppState = 'background';
    await rerender({});
    jest.setSystemTime(new Date('2026-01-01T00:02:00Z')); // 2 min < 5 min timeout
    mockAppState = 'active';
    await rerender({});

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });
});
