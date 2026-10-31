/**
 * @jest-environment jsdom
 *
 * After a thrift (Ajo) write succeeds, every Ajo screen and everything for this association that adds payments up (the dashboard, reports,
 * balances) is refreshed, and nothing for another association is touched. The write is never undone or turned into an error by the refresh.
 */
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { key } from '@societyledger/query';

type MockUser = { id: number; associationId?: number } | null;
let mockState: { user: MockUser; impersonatedAssociation: { id: number } | null } = { user: { id: 1, associationId: 7 }, impersonatedAssociation: null };
jest.mock('@/store/authStore', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return { useAuthStore: (select: (s: typeof mockState) => unknown) => select(useSyncExternalStore(() => () => undefined, () => mockState, () => mockState)) };
});
jest.mock('@/lib/ajo/staffApi', () => ({ ajoStaffApi: {} }));

import { useAjoAction } from '@/lib/ajo/staffHooks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let client: QueryClient;
let root: Root;
let host: HTMLElement;
let run: (input: number) => Promise<unknown>;
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function Probe({ fn }: { fn: (n: number) => Promise<unknown> }) {
  const action = useAjoAction(fn);
  run = action.mutateAsync;
  return null;
}

const isStale = (k: readonly unknown[]) => client.getQueryState(k)?.isInvalidated === true;

async function mountWith(fn: (n: number) => Promise<unknown>) {
  await act(async () => { root.render(<QueryClientProvider client={client}><Probe fn={fn} /></QueryClientProvider>); });
}

beforeEach(() => {
  mockState = { user: { id: 1, associationId: 7 }, impersonatedAssociation: null };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const t of [7, 8]) {
    client.setQueryData(key(t, 'dashboard', 'overview'), { t });
    client.setQueryData(key(t, 'payments', 'list'), { t });
    client.setQueryData(key(t, 'members', 'list'), { t });
  }
  client.setQueryData(['ajo', 'staff', 'queue', 4], { items: [] });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('after a thrift write succeeds', () => {
  it('refreshes the Ajo screens and this association’s dashboard and money, and leaves other data and other associations alone', async () => {
    await mountWith(async (n) => n);
    await act(async () => { await run(1); await settle(); });
    expect(isStale(['ajo', 'staff', 'queue', 4])).toBe(true);
    expect(isStale(key(7, 'dashboard', 'overview'))).toBe(true);
    expect(isStale(key(7, 'payments', 'list'))).toBe(true);
    expect(isStale(key(7, 'members', 'list'))).toBe(false); // a payment does not change the member list
    expect(isStale(key(8, 'dashboard', 'overview'))).toBe(false); // another association is never touched
    expect(isStale(key(8, 'payments', 'list'))).toBe(false);
  });

  it('refreshes nothing when the write fails, so the screen keeps showing what is true', async () => {
    await mountWith(async () => { throw new Error('refused'); });
    await act(async () => { await run(1).catch(() => undefined); await settle(); });
    expect(isStale(['ajo', 'staff', 'queue', 4])).toBe(false);
    expect(isStale(key(7, 'dashboard', 'overview'))).toBe(false);
  });

  it('still succeeds when no association is known (a platform user): the refresh is skipped, not turned into an error', async () => {
    mockState = { user: { id: 1 }, impersonatedAssociation: null };
    await mountWith(async (n) => n * 2);
    let result: unknown;
    await act(async () => { result = await run(21); await settle(); });
    expect(result).toBe(42);
    expect(isStale(['ajo', 'staff', 'queue', 4])).toBe(true);
  });
});
