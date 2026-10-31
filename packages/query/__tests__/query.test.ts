import { QueryClient } from '@tanstack/react-query';
import {
  INVALIDATION,
  PERSIST_MAX_AGE_MS,
  QueryScopeError,
  createQueryClient,
  domainOf,
  freshnessLabel,
  freshnessState,
  invalidateFor,
  key,
  persistBuster,
  policyFor,
  queryDefaults,
  resetClientCache,
  retryDelay,
  shouldPersistQuery,
  tenantOf,
  trimInfiniteData,
  userKey,
  userOf,
} from '../src';

const A = 7;
const B = 8;

describe('keys are scoped to the association and, for personal data, the person', () => {
  it('always start with the tenant, then the domain', () => {
    expect(key(A, 'members', 'list', { page: 1 })).toEqual([A, 'members', 'list', { page: 1 }]);
    expect(tenantOf(key(A, 'members'))).toBe(A);
    expect(domainOf(key(A, 'members'))).toBe('members');
  });

  it('differ between two associations, so one can never read the other from the cache', () => {
    expect(key(A, 'members', 'list')).not.toEqual(key(B, 'members', 'list'));
  });

  it('refuse to be built without a tenant', () => {
    expect(() => key(undefined, 'members')).toThrow(QueryScopeError);
    expect(() => key(null, 'members')).toThrow(QueryScopeError);
    expect(() => key('', 'members')).toThrow(QueryScopeError);
    expect(() => key(Number.NaN, 'members')).toThrow(QueryScopeError);
  });

  it('put the person in personal keys, and refuse to be built without one', () => {
    expect(userKey(A, 42, 'ajoSavings', 9)).toEqual([A, 'ajoSavings', 'u', 42, 9]);
    expect(userOf(userKey(A, 42, 'ajoSavings'))).toBe(42);
    expect(userOf(key(A, 'members'))).toBeUndefined();
    expect(userKey(A, 42, 'ajoSavings')).not.toEqual(userKey(A, 43, 'ajoSavings'));
    expect(() => userKey(A, undefined, 'ajoSavings')).toThrow(QueryScopeError);
    expect(() => userKey(undefined, 42, 'ajoSavings')).toThrow(QueryScopeError);
  });
});

describe('freshness policy', () => {
  it('trusts settings for 30 minutes, members for 5, dashboards for 90 seconds and money for 30', () => {
    expect(queryDefaults('settings').staleTime).toBe(30 * 60_000);
    expect(queryDefaults('members').staleTime).toBe(5 * 60_000);
    expect(queryDefaults('dashboard').staleTime).toBe(90_000);
    expect(queryDefaults('payments').staleTime).toBe(30_000);
  });

  it('always checks money against the server when a screen opens, and nothing else', () => {
    expect(queryDefaults('payments').refetchOnMount).toBe('always');
    expect(queryDefaults('ajo').refetchOnMount).toBe('always');
    expect(queryDefaults('settings').refetchOnMount).toBeUndefined();
  });

  it('keeps an unknown domain short and off the device', () => {
    expect(policyFor('somethingNew')).toEqual({ freshness: 'directory', persist: false });
  });
});

describe('what is written to the device', () => {
  const ctx = { tenant: A, userId: 42 };
  const ok = (queryKey: readonly unknown[], status = 'success') => shouldPersistQuery({ queryKey, state: { status } }, ctx);

  it('saves allow-listed data for this association', () => {
    expect(ok(key(A, 'settings', 'association'))).toBe(true);
    expect(ok(key(A, 'settings', 'notifications'))).toBe(true);
    expect(ok(key(A, 'members', 'list'))).toBe(true);
    expect(ok(userKey(A, 42, 'profile'))).toBe(true);
  });

  it('never saves payment, contribution or payout state, or anything unknown', () => {
    for (const domain of ['payments', 'contributions', 'payouts', 'ajo', 'ajoPayments', 'ajoPayouts', 'dues', 'cash', 'somethingNew']) {
      expect(ok(key(A, domain, 'x'))).toBe(false);
    }
  });

  it('never saves a secret or a one-time value, even in an allowed domain', () => {
    for (const part of ['bank-account', 'payout-account', 'reveal', 'proof', 'file-link', 'otp', 'integrations', 'payments']) {
      expect(ok(key(A, 'profile', part))).toBe(false);
    }
  });

  it('never saves a query that opts out, such as a filtered or searched list', () => {
    expect(shouldPersistQuery({ queryKey: key(A, 'members', 'list'), state: { status: 'success' }, meta: { persist: false } }, ctx)).toBe(false);
    expect(shouldPersistQuery({ queryKey: key(A, 'members', 'list'), state: { status: 'success' }, meta: { persist: true } }, ctx)).toBe(true);
  });

  it('never saves a failed or pending query', () => {
    expect(ok(key(A, 'members'), 'error')).toBe(false);
    expect(ok(key(A, 'members'), 'pending')).toBe(false);
  });

  it('never saves another association’s or another person’s data, or anything while signed out', () => {
    expect(ok(key(B, 'members'))).toBe(false);
    expect(ok(userKey(A, 99, 'profile'))).toBe(false);
    expect(shouldPersistQuery({ queryKey: key(A, 'members'), state: { status: 'success' } }, { tenant: A, userId: null })).toBe(false);
    expect(shouldPersistQuery({ queryKey: key(A, 'members'), state: { status: 'success' } }, { tenant: null, userId: 42 })).toBe(false);
  });

  it('drops the saved cache when the app version, the association or the person changes', () => {
    const base = persistBuster({ appVersion: '1.0.0', tenant: A, userId: 42 });
    expect(persistBuster({ appVersion: '1.0.1', tenant: A, userId: 42 })).not.toBe(base);
    expect(persistBuster({ appVersion: '1.0.0', tenant: B, userId: 42 })).not.toBe(base);
    expect(persistBuster({ appVersion: '1.0.0', tenant: A, userId: 43 })).not.toBe(base);
    expect(PERSIST_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('saves only the first page of a long list', () => {
    const data = { pages: [[1], [2], [3]], pageParams: [0, 1, 2] };
    expect(trimInfiniteData(data)).toEqual({ pages: [[1]], pageParams: [0] });
    expect(trimInfiniteData({ any: 'thing' })).toEqual({ any: 'thing' });
  });
});

describe('invalidation touches the right domains of the right association, and nothing else', () => {
  function seeded() {
    const qc = new QueryClient();
    const domains = ['payments', 'dues', 'balances', 'memberFinance', 'ajoSavings', 'ajoBoard', 'dashboard', 'reports', 'members', 'settings', 'meetings', 'ajoPayouts'];
    for (const t of [A, B]) for (const d of domains) qc.setQueryData(key(t, d, 'x'), { d });
    return qc;
  }
  const stale = (qc: QueryClient, tenant: number, domain: string) => qc.getQueryState(key(tenant, domain, 'x'))?.isInvalidated === true;

  it('after a payment, refreshes every screen that shows money, in this association only', async () => {
    const qc = seeded();
    await invalidateFor(qc, A, 'payment.changed');
    for (const d of ['payments', 'dues', 'balances', 'memberFinance', 'ajoSavings', 'ajoBoard', 'dashboard', 'reports']) expect(stale(qc, A, d)).toBe(true);
    for (const d of ['members', 'settings', 'meetings']) expect(stale(qc, A, d)).toBe(false); // unrelated data is left alone
    for (const d of ['payments', 'balances', 'dashboard']) expect(stale(qc, B, d)).toBe(false); // another association is never touched
  });

  it('after a payout, refreshes payouts, the board and the dashboard', async () => {
    const qc = seeded();
    await invalidateFor(qc, A, 'payout.changed');
    for (const d of ['ajoPayouts', 'ajoBoard', 'dashboard']) expect(stale(qc, A, d)).toBe(true);
    expect(stale(qc, A, 'members')).toBe(false);
    expect(stale(qc, B, 'ajoPayouts')).toBe(false);
  });

  it('after dues change, refreshes dues, balances and what adds them up', async () => {
    const qc = seeded();
    await invalidateFor(qc, A, 'dues.changed');
    for (const d of ['dues', 'balances', 'memberFinance', 'dashboard', 'reports']) expect(stale(qc, A, d)).toBe(true);
    expect(stale(qc, A, 'settings')).toBe(false);
  });

  it('after a member or a setting changes, leaves the money alone', async () => {
    const qc = seeded();
    await invalidateFor(qc, A, 'member.changed');
    expect(stale(qc, A, 'members')).toBe(true);
    expect(stale(qc, A, 'payments')).toBe(false);
    await invalidateFor(qc, A, 'settings.changed');
    expect(stale(qc, A, 'settings')).toBe(true);
  });

  it('every event refreshes the dashboard or names a reason not to', () => {
    // money and structure events feed the dashboard; the rest are display-only and are listed here on purpose
    const displayOnly = ['profile.changed', 'settings.changed', 'notification.changed'];
    for (const [event, domains] of Object.entries(INVALIDATION)) {
      if (displayOnly.includes(event)) continue;
      expect(domains).toContain('dashboard');
    }
  });

  it('does nothing, and does not throw, without an association (it runs after a write that has already succeeded)', async () => {
    const qc = seeded();
    await expect(invalidateFor(qc, undefined, 'payment.changed')).resolves.toBeUndefined();
    await expect(invalidateFor(qc, null, 'payment.changed')).resolves.toBeUndefined();
    expect(stale(qc, A, 'payments')).toBe(false);
  });
});

describe('clearing the cache', () => {
  it('on logout or switching association, empties memory and the saved copy', async () => {
    const qc = new QueryClient();
    qc.setQueryData(key(A, 'members', 'list'), [1, 2]);
    qc.setQueryData(userKey(A, 42, 'ajoSavings'), { kobo: '100' });
    const persister = { removeClient: jest.fn().mockResolvedValue(undefined) };
    await resetClientCache(qc, persister);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(qc.getQueryData(key(A, 'members', 'list'))).toBeUndefined();
    expect(persister.removeClient).toHaveBeenCalledTimes(1);
  });

  it('forgets pending writes too, so nothing is sent for the person who left', async () => {
    const qc = new QueryClient();
    await qc.getMutationCache().build(qc, { mutationFn: async () => 1 }).execute(undefined);
    expect(qc.getMutationCache().getAll()).toHaveLength(1);
    await resetClientCache(qc);
    expect(qc.getMutationCache().getAll()).toHaveLength(0);
  });
});

describe('the client', () => {
  it('retries a failed read twice at most, only when the error is retryable, and never retries a write', () => {
    const qc = createQueryClient({ isRetryable: (e) => e === 'network' });
    const retry = qc.getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, 'network')).toBe(true);
    expect(retry(1, 'network')).toBe(true);
    expect(retry(2, 'network')).toBe(false);
    expect(retry(0, 'forbidden')).toBe(false);
    expect(qc.getDefaultOptions().mutations?.retry).toBe(false);
    expect(qc.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    expect(qc.getDefaultOptions().queries?.networkMode).toBe('online');
    expect(createQueryClient({ isRetryable: () => true, offlineFirst: true }).getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
  });

  it('waits longer after each failure, up to 15 seconds', () => {
    const mid = () => 0.5; // no spread
    expect(retryDelay(0, mid)).toBe(1000);
    expect(retryDelay(1, mid)).toBe(2000);
    expect(retryDelay(2, mid)).toBe(4000);
    expect(retryDelay(10, mid)).toBe(15000);
  });
});

describe('the offline / updating line', () => {
  it('says nothing without data, offline when there is none, updating while it fetches, and nothing when fresh', () => {
    expect(freshnessState({ isOnline: false, isFetching: false, hasData: false })).toBe('fresh');
    expect(freshnessState({ isOnline: false, isFetching: false, hasData: true })).toBe('offline');
    expect(freshnessState({ isOnline: true, isFetching: true, hasData: true })).toBe('updating');
    expect(freshnessState({ isOnline: true, isFetching: false, hasData: true })).toBe('fresh');
    expect(freshnessLabel('fresh', 1)).toBeNull();
    expect(freshnessLabel('updating', 1)).toBe('Updating…');
    expect(freshnessLabel('offline', new Date(2027, 0, 5, 10, 42).getTime())).toBe('Offline · last updated 10:42');
    expect(freshnessLabel('offline', 0)).toBe('Offline');
  });
});
