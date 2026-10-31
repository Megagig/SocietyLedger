import { renderHook } from '@testing-library/react-native';

import { useSessionStore } from '@/stores/session';
import { useAjoCan } from './useAjoCan';

const withPermissions = (permissions: string[]) =>
  useSessionStore.getState().setUser({ id: 1, email: 'a@example.com', role: 'member', permissions, roles: ['member'], requiresOnboarding: false, platformRole: null, member: null });

describe('useAjoCan', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('gives a contributor nothing to run', async () => {
    withPermissions(['ajo.view_own']);
    const { result } = await renderHook(() => useAjoCan());
    expect(result.current).toMatchObject({ manage: false, reconcile: false, approvePayout: false, collect: false, anyOfficer: false });
  });

  it('follows each officer permission on its own', async () => {
    withPermissions(['ajo.reconcile', 'ajo.collect']);
    const { result } = await renderHook(() => useAjoCan());
    expect(result.current).toMatchObject({ manage: false, reconcile: true, approvePayout: false, collect: true, anyOfficer: true });
  });
});
