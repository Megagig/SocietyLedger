/**
 * What to refresh after something changes. Name the event, not the screens: every app calls `invalidateFor(queryClient, tenant, 'payment.confirmed')`
 * and the table below decides which cached domains of that association are now out of date. Only that association is touched, and never the
 * whole cache.
 *
 * Adding a mutation: find its event below (or add one) and call `invalidateFor` in `onSuccess`. A mutation that changes money must name every
 * domain that shows that money, including the dashboard and reports that add it up.
 *
 * Money is never confirmed optimistically: these run after the server has answered, or after the app learns the result of a payment.
 */
import type { QueryClient } from '@tanstack/query-core';
import { domainPrefix, type TenantId } from './keys';

export const INVALIDATION = {
  // A payment or contribution was recorded, confirmed, turned down or reversed, by anyone, in Ajo or in the association.
  'payment.changed': ['payments', 'dues', 'balances', 'memberFinance', 'memberLedger', 'cash', 'contributions', 'ajo', 'ajoSavings', 'ajoPayments', 'ajoBoard', 'dashboard', 'reports', 'ajoReports'],
  // A payout was prepared, approved, paid, voided or reversed.
  'payout.changed': ['payouts', 'ajoPayouts', 'ajo', 'ajoSavings', 'ajoBoard', 'dashboard', 'reports', 'ajoReports', 'balances'],
  // Dues, levies, charges or late fees were created, edited, waived or settled.
  'dues.changed': ['dues', 'balances', 'memberFinance', 'memberLedger', 'payments', 'dashboard', 'reports'],
  // An expense or transaction on the association's books.
  'ledger.changed': ['expenses', 'cash', 'balances', 'dashboard', 'reports'],
  // A circle, its rules, its people, its order or its start changed.
  'circle.changed': ['ajo', 'ajoBoard', 'ajoStatus', 'ajoSavings', 'ajoReports', 'dashboard'],
  'member.changed': ['members', 'profile', 'dashboard', 'ajo', 'reports'],
  'profile.changed': ['profile', 'session', 'members'],
  'settings.changed': ['settings', 'roles', 'categories', 'plans', 'modules', 'permissions', 'association', 'session'],
  'meeting.changed': ['meetings', 'dashboard'],
  'vote.changed': ['voting', 'polls', 'elections', 'dashboard'],
  'notification.changed': ['notifications', 'inbox'],
} as const satisfies Record<string, readonly string[]>;

export type InvalidationEvent = keyof typeof INVALIDATION;

export function domainsFor(event: InvalidationEvent): readonly string[] {
  return INVALIDATION[event];
}

/**
 * Mark the affected domains of one association stale and refetch those on screen. With no association known nothing is cached for anyone, so
 * there is nothing to refresh: it returns quietly, because it runs after a write has already succeeded and must never turn that into an error.
 */
export async function invalidateFor(queryClient: QueryClient, tenant: TenantId | null | undefined, ...events: InvalidationEvent[]): Promise<void> {
  if (tenant === null || tenant === undefined || tenant === '') return;
  const domains = new Set<string>();
  for (const event of events) for (const domain of INVALIDATION[event]) domains.add(domain);
  await Promise.all(Array.from(domains).map((domain) => queryClient.invalidateQueries({ queryKey: domainPrefix(tenant, domain) })));
}
