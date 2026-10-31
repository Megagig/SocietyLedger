import { renderHook } from '@testing-library/react-native';

import { useSessionStore } from '@/stores/session';
import { useAjoNav } from './useAjoNav';

// The Money and Manage tabs trim themselves to Ajo from these flags, so a standalone group never sees association content.
const mockStatus = jest.fn();
const mockCircles = jest.fn(() => ({ circles: [] as unknown[] }));
jest.mock('./queries', () => ({
  AJO_MEMBER_ACCESS: ['AJO_VIEW_OWN'],
  AJO_COLLECT_ACCESS: ['AJO_COLLECT'],
  AJO_STAFF_ACCESS: ['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT'],
  useAjoStatus: () => mockStatus(),
  useRotatingCircles: () => mockCircles(),
}));

const signIn = (permissions: string[], tenantKind?: 'ASSOCIATION' | 'THRIFT_GROUP') =>
  useSessionStore.getState().setUser({ id: 1, email: 'a@example.com', role: 'member', permissions, roles: ['member'], requiresOnboarding: false, platformRole: null, member: null, tenantKind });

describe('useAjoNav', () => {
  beforeEach(() => useSessionStore.getState().reset());

  it('treats a THRIFT_GROUP account as thrift-only', async () => {
    signIn(['ajo.view_own']);
    mockStatus.mockReturnValue({ isPending: false, data: { kind: 'ok', status: { tenantKind: 'THRIFT_GROUP' } } });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current).toMatchObject({ member: true, thriftOnly: true, resolving: false });
  });

  it('leaves an association alone', async () => {
    signIn(['ajo.view_own']);
    mockStatus.mockReturnValue({ isPending: false, data: { kind: 'ok', status: { tenantKind: 'ASSOCIATION' } } });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current).toMatchObject({ thriftOnly: false, resolving: false });
  });

  it('is still resolving until the account kind is known, so the association screen is not drawn first', async () => {
    signIn(['ajo.view_own']);
    mockStatus.mockReturnValue({ isPending: true, data: undefined });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current).toMatchObject({ thriftOnly: false, resolving: true });
  });

  it('knows a standalone group from the session alone, before any Ajo call answers (no association flash)', async () => {
    signIn(['ajo.manage'], 'THRIFT_GROUP');
    mockStatus.mockReturnValue({ isPending: true, data: undefined });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current).toMatchObject({ thriftOnly: true, resolving: false });
  });

  it('knows an association from the session alone', async () => {
    signIn(['ajo.manage'], 'ASSOCIATION');
    mockStatus.mockReturnValue({ isPending: true, data: undefined });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current).toMatchObject({ thriftOnly: false, resolving: false });
  });

  it('hands the Circle tab its list of rotating pots, for an officer as well as a member', async () => {
    signIn(['ajo.manage'], 'THRIFT_GROUP');
    mockStatus.mockReturnValue({ isPending: false, data: { kind: 'ok', status: { tenantKind: 'THRIFT_GROUP' } } });
    mockCircles.mockReturnValue({ circles: [{ id: 10 }] });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current.circles).toHaveLength(1);
    mockCircles.mockReturnValue({ circles: [] });
  });

  it('never waits for someone with no Ajo permission', async () => {
    signIn([]);
    mockStatus.mockReturnValue({ isPending: true, data: undefined });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current.resolving).toBe(false);
  });
});
