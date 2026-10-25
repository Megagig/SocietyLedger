import { renderHook } from '@testing-library/react-native';

import { useCan } from './useCan';
import { useSessionStore } from '@/stores/session';

describe('useCan', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('is false when the user has no permissions', async () => {
    const { result } = await renderHook(() => useCan('LEDGER_VIEW'));
    expect(result.current).toBe(false);
  });

  it('is true for a single alias the user has', async () => {
    useSessionStore.getState().setUser({
      id: 1,
      email: 'ada@example.com',
      role: 'member',
      permissions: ['ledger.view'],
      roles: ['member'],
      requiresOnboarding: false,
      platformRole: null,
      member: null,
    });

    const { result } = await renderHook(() => useCan('LEDGER_VIEW'));
    expect(result.current).toBe(true);
  });

  it('is true for an array alias when at least one matches (canAny)', async () => {
    useSessionStore.getState().setUser({
      id: 1,
      email: 'ada@example.com',
      role: 'member',
      permissions: ['members.view'],
      roles: ['member'],
      requiresOnboarding: false,
      platformRole: null,
      member: null,
    });

    const { result } = await renderHook(() => useCan(['LEDGER_VIEW', 'MEMBER_VIEW']));
    expect(result.current).toBe(true);
  });
});
