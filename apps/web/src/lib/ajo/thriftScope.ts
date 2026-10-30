/**
 * What a standalone thrift group (an account that is only Ajo) may open on the web. Hiding a menu entry is not enough: a typed address,
 * a bookmark or an old link would still open an association page (finances, meetings, cooperatives ...), which the server refuses
 * because the group has no such module. This is the one list the layout checks, so those pages are closed however they were reached.
 */

/** Page prefixes a standalone group keeps. A prefix matches itself and anything below it. */
const ALLOWED_PREFIXES = [
  '/dashboard/ajo',
  '/dashboard/my-thrift',
  '/dashboard/members',
  '/dashboard/notifications',
  '/dashboard/help',
  '/dashboard/subscription',
  '/dashboard/member/my-profile',
  '/dashboard/member/settings',
  '/dashboard/settings',
];

/** Settings pages a standalone group keeps (the rest of Settings is an association's own: members' signup, finance, payment gateways, accounting). */
export const THRIFT_SETTINGS_HREFS: readonly string[] = [
  '/dashboard/settings',
  '/dashboard/settings/association',
  '/dashboard/settings/roles',
  '/dashboard/settings/users',
  '/dashboard/settings/notifications',
  '/dashboard/settings/audit-logs',
  '/dashboard/settings/data-privacy',
  '/dashboard/subscription',
];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** True when a standalone thrift group may open this page. */
export function isThriftPathAllowed(pathname: string): boolean {
  // The two home routes show the Thrift home for a standalone group, so they are fine too.
  if (pathname === '/dashboard' || pathname === '/dashboard/member' || pathname === '/dashboard/admin') return true;
  if (!pathname.startsWith('/dashboard')) return true;
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return THRIFT_SETTINGS_HREFS.some((h) => pathname === h || (h !== '/dashboard/settings' && matches(pathname, h)));
  }
  return ALLOWED_PREFIXES.some((p) => matches(pathname, p));
}

/** Words an association uses that a standalone group should not see. */
export const THRIFT_WORDS: Record<string, string> = {
  'Association Profile': 'Group profile',
  'Admin Portal': 'Group admin',
  'Member Portal': 'Thrift group',
  'My Member Area': 'My account',
  Administration: 'Group admin',
};
export const thriftWord = (text: string, thriftOnly: boolean) => (thriftOnly ? (THRIFT_WORDS[text] ?? text) : text);
