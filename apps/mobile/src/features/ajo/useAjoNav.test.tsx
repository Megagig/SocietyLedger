import { renderHook } from '@testing-library/react-native';

import { useSessionStore } from '@/stores/session';
import { useAjoNav } from './useAjoNav';

// The Money and Manage tabs trim themselves to Ajo from these flags, so a standalone group never sees association content.
const mockStatus = jest.fn();
const mockMine = jest.fn(() => ({ data: [] as unknown[] }));
jest.mock('./queries', () => ({
  AJO_MEMBER_ACCESS: ['AJO_VIEW_OWN'],
  AJO_COLLECT_ACCESS: ['AJO_COLLECT'],
  AJO_STAFF_ACCESS: ['AJO_MANAGE', 'AJO_RECONCILE', 'AJO_APPROVE_PAYOUT'],
  useAjoStatus: () => mockStatus(),
  useMyMemberships: () => mockMine(),
}));

const signIn = (permissions: string[]) =>
  useSessionStore.getState().setUser({ id: 1, email: 'a@example.com', role: 'member', permissions, roles: ['member'], requiresOnboarding: false, platformRole: null, member: null });

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

  it('lists the rotating pots a standalone member is in, and no others, for the Circle tab', async () => {
    signIn(['ajo.view_own']);
    mockStatus.mockReturnValue({ isPending: false, data: { kind: 'ok', status: { tenantKind: 'THRIFT_GROUP' } } });
    mockMine.mockReturnValue({
      data: [
        { membershipId: 1, status: 'ACTIVE', group: { id: 10, model: 'ROTATING_POT' } },
        { membershipId: 2, status: 'ACTIVE', group: { id: 11, model: 'COLLECTOR_THRIFT' } },
        { membershipId: 3, status: 'LEFT', group: { id: 12, model: 'ROTATING_POT' } },
      ],
    });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current.circles.map((m) => (m as { membershipId: number }).membershipId)).toEqual([1]);
    mockMine.mockReturnValue({ data: [] });
  });

  it('never waits for someone with no Ajo permission', async () => {
    signIn([]);
    mockStatus.mockReturnValue({ isPending: true, data: undefined });
    const { result } = await renderHook(() => useAjoNav());
    expect(result.current.resolving).toBe(false);
  });
});
