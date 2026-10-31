/**
 * @jest-environment jsdom
 *
 * useScopedQuery: the way a web screen asks for cached data. It waits until the association is known, scopes the key to the association (and the
 * person, for personal data), uses the freshness window of its domain, and is refreshed by the named events.
 */
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { invalidateFor, key, userKey } from '@societyledger/query';

type MockUser = { id: number; associationId?: number } | null;
let mockState: { user: MockUser; impersonatedAssociation: { id: number } | null } = { user: { id: 1, associationId: 7 }, impersonatedAssociation: null };
const mockListeners = new Set<() => void>();
jest.mock('@/store/authStore', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useAuthStore: (select: (s: typeof mockState) => unknown) =>
      select(useSyncExternalStore((l: () => void) => { mockListeners.add(l); return () => mockListeners.delete(l); }, () => mockState, () => mockState)),
  };
});

import { useScopedQuery } from '@/lib/query';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let client: QueryClient;
let root: Root;
let host: HTMLElement;
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const seen: Record<string, unknown> = {};

function Settings() {
  const q = useScopedQuery({ domain: 'settings', parts: ['association'], queryFn: async () => ({ name: 'Ajo Ltd' }) });
  seen.settings = q.data;
  return null;
}
function Savings() {
  const q = useScopedQuery({ domain: 'ajoSavings', personal: true, parts: [9], queryFn: async () => ({ kobo: '100' }) });
  seen.savings = q.data;
  return null;
}

function setUser(user: MockUser) {
  mockState = { user, impersonatedAssociation: null };
  mockListeners.forEach((l) => l());
}

beforeEach(async () => {
  Object.keys(seen).forEach((k) => delete seen[k]);
  mockState = { user: { id: 1, associationId: 7 }, impersonatedAssociation: null };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const mount = async (node: React.ReactNode) => {
  await act(async () => { root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>); });
  await act(async () => { await settle(50); }); // the answer arrives, then the screen draws it
};

describe('useScopedQuery', () => {
  it('keys the query to the association and the person’s domain', async () => {
    await mount(<Settings />);
    expect(seen.settings).toEqual({ name: 'Ajo Ltd' });
    expect(client.getQueryData(key(7, 'settings', 'association'))).toEqual({ name: 'Ajo Ltd' });
    expect(client.getQueryCache().getAll().map((q) => q.queryKey)).toEqual([[7, 'settings', 'association']]);
  });

  it('keys personal data to the person as well', async () => {
    await mount(<Savings />);
    expect(client.getQueryData(userKey(7, 1, 'ajoSavings', 9))).toEqual({ kobo: '100' });
  });

  it('uses the freshness window of the domain: settings 30 minutes, ajo money 30 seconds', async () => {
    await mount(<><Settings /><Savings /></>);
    const byDomain = (d: string) => client.getQueryCache().getAll().find((q) => q.queryKey[1] === d)!;
    expect((byDomain('settings').options as { staleTime: number }).staleTime).toBe(30 * 60_000);
    expect((byDomain('ajoSavings').options as { staleTime: number }).staleTime).toBe(30_000);
    expect((byDomain('ajoSavings').options as { refetchOnMount?: string }).refetchOnMount).toBe('always');
  });

  it('waits, and builds no key, while the association is not known', async () => {
    setUser({ id: 1 }); // a platform user with no association
    await mount(<Settings />);
    expect(seen.settings).toBeUndefined();
    const keys = client.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys.every((k) => k[0] === '__waiting__')).toBe(true);
    expect(client.getQueryCache().getAll().every((q) => q.state.fetchStatus === 'idle' && q.state.data === undefined)).toBe(true);
  });

  it('does not share a cached answer between two associations', async () => {
    await mount(<Settings />);
    await act(async () => { setUser({ id: 1, associationId: 8 }); await settle(); });
    const keys = client.getQueryCache().getAll().map((q) => JSON.stringify(q.queryKey)).sort();
    expect(keys).toEqual([JSON.stringify([7, 'settings', 'association']), JSON.stringify([8, 'settings', 'association'])]);
  });
});

describe('refreshing after a change', () => {
  it('a confirmed payment makes the money screens and the dashboard refetch, and leaves settings alone', async () => {
    await mount(<><Settings /><Savings /></>);
    let savingsFetches = 0;
    client.getQueryCache().find({ queryKey: userKey(7, 1, 'ajoSavings', 9) })!.setOptions({ queryKey: userKey(7, 1, 'ajoSavings', 9), queryFn: async () => ({ kobo: String(100 + ++savingsFetches) }) });
    await act(async () => { await invalidateFor(client, 7, 'payment.changed'); await settle(); });
    expect(savingsFetches).toBe(1);
    expect(client.getQueryState([7, 'settings', 'association'])?.isInvalidated).toBe(false);
  });
});
