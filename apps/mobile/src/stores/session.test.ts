import { useSessionStore, type SessionUser } from './session';

const fakeUser: SessionUser = {
  id: 1,
  email: 'ada@example.com',
  role: 'member',
  permissions: ['ledger.view_own'],
  roles: ['member'],
  requiresOnboarding: false,
  platformRole: null,
  member: { id: 1, firstName: 'Ada', lastName: 'Eze', memberId: 'MEM0001' },
};

describe('useSessionStore', () => {
  // Deliberately no shared `beforeEach(reset)` — `reset()` itself sets `unauthenticated`, which
  // would make the true module-initial `'idle'` state untestable. This first test runs before
  // anything else touches the store; every later test calls `reset()` itself when it needs one.
  it('starts idle with no user', () => {
    expect(useSessionStore.getState().status).toBe('idle');
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('setUser(user) flips status to authenticated', () => {
    useSessionStore.getState().reset();
    useSessionStore.getState().setUser(fakeUser);
    expect(useSessionStore.getState().status).toBe('authenticated');
    expect(useSessionStore.getState().user).toEqual(fakeUser);
  });

  it('setUser(null) flips status to unauthenticated', () => {
    useSessionStore.getState().reset();
    useSessionStore.getState().setUser(fakeUser);
    useSessionStore.getState().setUser(null);
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useSessionStore.getState().user).toBeNull();
  });

  describe('markSubscriptionBlocked', () => {
    it('flips the signed-in user to blocked, remembering whether it was the trial that ended', () => {
      useSessionStore.getState().setUser(fakeUser);
      useSessionStore.getState().markSubscriptionBlocked('TRIAL_ENDED');
      expect(useSessionStore.getState().user?.subscriptionAccess).toMatchObject({ allowed: false, reason: 'TRIAL_ENDED' });
      useSessionStore.getState().markSubscriptionBlocked('anything else');
      expect(useSessionStore.getState().user?.subscriptionAccess).toMatchObject({ allowed: false, reason: 'EXPIRED' });
    });

    it('does nothing when nobody is signed in, and never blocks platform staff', () => {
      useSessionStore.getState().reset();
      useSessionStore.getState().markSubscriptionBlocked('TRIAL_ENDED');
      expect(useSessionStore.getState().user).toBeNull();

      useSessionStore.getState().setUser({ ...fakeUser, platformRole: 'SUPER_ADMIN' });
      useSessionStore.getState().markSubscriptionBlocked('TRIAL_ENDED');
      expect(useSessionStore.getState().user?.subscriptionAccess).toBeUndefined();
    });
  });

  it('reset clears the user and sets unauthenticated', () => {
    useSessionStore.getState().setUser(fakeUser);
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().status).toBe('unauthenticated');
    expect(useSessionStore.getState().user).toBeNull();
  });
});
