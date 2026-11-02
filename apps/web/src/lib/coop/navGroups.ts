/**
 * Which cooperative sidebar group holds a page, so the menu can open it when a member lands there (from a link, a notification or a refresh).
 * Pure, so it is easy to check and shared by the member and the officer sidebars.
 */
const BASE = '/dashboard/cooperatives/';

const GROUPS: Array<{ group: string; pages: string[] }> = [
  { group: 'Savings', pages: ['my-savings', 'my-withdrawal'] },
  { group: 'Transactions', pages: ['my-transactions', 'my-cashbook', 'my-pending-payments'] },
  { group: 'Loans', pages: ['my-loans', 'repay-loan', 'guarantors'] },
];

export function coopGroupForPath(pathname: string): string | null {
  for (const { group, pages } of GROUPS) {
    if (pages.some((page) => pathname === BASE + page || pathname.startsWith(BASE + page + '/'))) return group;
  }
  return null;
}
