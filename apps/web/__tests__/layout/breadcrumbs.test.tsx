/**
 * @jest-environment jsdom
 *
 * The trail above each page links every part of the address. A part with no page of its own (Governance is only a folder holding Meetings, Polls,
 * Elections...) must be plain text: a link to it is a 404, and the browser prefetches it, filling the console with 404s.
 */
import fs from 'fs';
import path from 'path';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';

let mockPath = '/dashboard/governance/meetings';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
jest.mock('@tabler/icons-react', () => ({ IconChevronRight: () => null, IconHome: () => <span>home</span> }));
jest.mock('@/lib/ajo/staffHooks', () => ({ useGroupDetail: () => ({ data: undefined }) }));

import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PATHS_WITHOUT_A_PAGE } from '@/lib/breadcrumb-paths';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const show = async (pathname: string) => {
  mockPath = pathname;
  await act(async () => { root.render(<Breadcrumbs />); });
};
const links = () => Array.from(host.querySelectorAll('a')).map((a) => a.getAttribute('href'));

describe('the trail above a page', () => {
  it('does not link a section that has no page (Governance), but still links the ones that do', async () => {
    await show('/dashboard/governance/meetings');
    expect(host.textContent).toContain('Governance');
    expect(links()).not.toContain('/dashboard/governance');
    expect(links()).toContain('/dashboard'); // Home
    expect(host.textContent).toContain('Meetings'); // the page you are on
  });

  it('keeps linking sections that do have a page', async () => {
    await show('/dashboard/welfare/contributions');
    expect(links()).toContain('/dashboard/welfare');
  });

  it('does not link the other sections that are only folders', async () => {
    await show('/dashboard/finance/payments/12');
    expect(links()).not.toContain('/dashboard/finance/payments');
    expect(links()).toContain('/dashboard/finance');
  });
});

describe('the list of sections without a page', () => {
  /** Every folder under app/dashboard that holds pages but has none of its own (dynamic [id] folders are not addresses by themselves). */
  function foldersWithoutAPage(): string[] {
    const root = path.resolve(__dirname, '../../src/app/dashboard');
    const found: string[] = [];
    const hasAnyPage = (dir: string): boolean =>
      fs.readdirSync(dir, { withFileTypes: true }).some((e) => (e.isFile() && e.name === 'page.tsx') || (e.isDirectory() && hasAnyPage(path.join(dir, e.name))));
    const walk = (dir: string, url: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('[') || entry.name.startsWith('(')) continue;
        const full = path.join(dir, entry.name);
        const next = `${url}/${entry.name}`;
        if (!fs.existsSync(path.join(full, 'page.tsx')) && hasAnyPage(full)) found.push(next);
        walk(full, next);
      }
    };
    walk(root, '/dashboard');
    return found.sort();
  }

  it('matches the folders on disk exactly, so a new section without a page cannot be forgotten', () => {
    expect([...PATHS_WITHOUT_A_PAGE].sort()).toEqual(foldersWithoutAPage());
  });
});
