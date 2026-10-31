/**
 * @jest-environment jsdom
 *
 * The dashboard prefetches the Members page's first screen, which only helps if it is exactly the entry the page asks for on first open.
 * And the quiet status line says "Updating…" or "Offline · last updated" only when saved data is on screen.
 */
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { onlineManager } from '@tanstack/react-query';
import { domainQueryKey, key } from '@societyledger/query';
import { DEFAULT_MEMBERS_FILTERS, membersListParts } from '@/lib/api/members-list';
import { FreshnessNote } from '@/components/common/FreshnessNote';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('prefetching the Members page', () => {
  it('uses the same cache entry the page asks for when it first opens', () => {
    // What the page starts with: page 1, 10 a page, no search and no filters.
    const pageStart = { page: 1, limit: 10, search: '', statusFilter: '', categoryFilter: '', loginFilter: '' };
    const asked = domainQueryKey({ tenant: 7, domain: 'members', parts: membersListParts(pageStart) }).queryKey;
    const prefetched = key(7, 'members', ...membersListParts(DEFAULT_MEMBERS_FILTERS));
    expect(prefetched).toEqual(asked);
  });

  it('is a different entry once the person searches or filters, and for another association', () => {
    const searched = domainQueryKey({ tenant: 7, domain: 'members', parts: membersListParts({ ...DEFAULT_MEMBERS_FILTERS, search: 'ada' }) }).queryKey;
    expect(searched).not.toEqual(key(7, 'members', ...membersListParts(DEFAULT_MEMBERS_FILTERS)));
    expect(key(8, 'members', ...membersListParts(DEFAULT_MEMBERS_FILTERS))).not.toEqual(key(7, 'members', ...membersListParts(DEFAULT_MEMBERS_FILTERS)));
  });
});

describe('the status line', () => {
  let root: Root;
  let host: HTMLElement;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    onlineManager.setOnline(true);
    await act(async () => root.unmount());
    host.remove();
  });
  const show = (query: { isFetching: boolean; data: unknown; dataUpdatedAt: number }) => act(async () => { root.render(<FreshnessNote query={query} />); });

  it('says nothing when the data is fresh, or when there is none yet', async () => {
    await show({ isFetching: false, data: [1], dataUpdatedAt: Date.now() });
    expect(host.textContent).toBe('');
    await show({ isFetching: true, data: undefined, dataUpdatedAt: 0 });
    expect(host.textContent).toBe('');
  });

  it('says it is updating while saved data is on screen and the server is being asked', async () => {
    await show({ isFetching: true, data: [1], dataUpdatedAt: Date.now() });
    expect(host.textContent).toBe('Updating…');
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });

  it('says it is offline, with the time the data was last updated', async () => {
    onlineManager.setOnline(false);
    const at = new Date(2027, 0, 5, 10, 42).getTime();
    await show({ isFetching: false, data: [1], dataUpdatedAt: at });
    expect(host.textContent).toBe('Offline · last updated 10:42');
  });
});
