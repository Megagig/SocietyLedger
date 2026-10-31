/**
 * Which screens a standalone thrift group may open. Hiding a tab or a menu entry is not enough, because a deep link, a push
 * notification or a remembered route can still open an association screen (Finance, Cooperative, Welfare, Meetings ...). This is the one
 * list the tabs layout checks, so those screens are closed for a standalone group however they were reached.
 *
 * `segments` is Expo Router's `useSegments()`: ['(app)', '(tabs)', 'manage', 'cash'].
 */

/** Manage screens a standalone group keeps (everything else under Manage is the association's own). */
const MANAGE_ALLOWED = new Set(['thrift', 'members', 'settings', 'support']);
/** Money screens a standalone group keeps. */
const MONEY_ALLOWED = new Set(['thrift']);
/** Profile screens are personal and shared. */
const TAB_ALLOWED = new Set(['money', 'manage', 'circle', 'profile']);

/** Where to send a standalone group that opened an association-only screen, or null when the screen is fine. */
export function thriftRedirectFor(segments: readonly string[], thriftOnly: boolean): string | null {
  if (!thriftOnly) return null;
  const tabs = segments.indexOf('(tabs)');
  if (tabs === -1) return null;
  const tab = segments[tabs + 1];
  const sub = segments[tabs + 2];
  if (tab === undefined) return null;
  if (!TAB_ALLOWED.has(tab)) return '/(app)/(tabs)/money';
  if (tab === 'money' && sub !== undefined && !MONEY_ALLOWED.has(sub)) return '/(app)/(tabs)/money';
  if (tab === 'manage' && sub !== undefined && !MANAGE_ALLOWED.has(sub)) return '/(app)/(tabs)/manage';
  return null;
}
