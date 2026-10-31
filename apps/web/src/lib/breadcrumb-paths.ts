/**
 * Breadcrumb trails turn every part of the address into a link, but these sections are only a folder: they have pages inside them and none of
 * their own, so a link to them lands on a 404 (and the browser quietly prefetches it, which fills the console with 404s). They are shown as plain
 * text instead. A test checks this list against the folders on disk, so a new section without a page cannot be forgotten.
 */
export const PATHS_WITHOUT_A_PAGE: ReadonlySet<string> = new Set([
  '/dashboard/ai',
  '/dashboard/communication',
  '/dashboard/cooperatives/members',
  '/dashboard/finance/payments',
  '/dashboard/governance',
  '/dashboard/subscription/receipt',
]);
