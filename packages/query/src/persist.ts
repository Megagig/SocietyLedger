/**
 * What may be written to the device, and when a saved cache is thrown away.
 *
 * Deny by default. A query is saved only when all of these hold: it succeeded, its domain is on the allow-list (policy.ts), it belongs to the
 * signed-in person (a per-person key for someone else is never saved), and nothing in its key marks it as sensitive.
 */
import { domainOf, tenantOf, userOf, type TenantId, type UserId } from './keys';
import { policyFor } from './policy';

/** Key parts that mean "this holds a secret or a one-time value". Any key containing one is never saved. */
export const NEVER_PERSIST_PARTS: readonly string[] = [
  'bank-account',
  'payout-account',
  'reveal',
  'proof',
  'file-link',
  'slip-link',
  'receipt-link',
  'evidence',
  'otp',
  'phone-code',
  'token',
  'password',
];

export interface PersistableQuery {
  queryKey: readonly unknown[];
  state: { status: string };
}

export interface PersistContext {
  /** The association the app is signed in to. A query from another association is never saved. */
  tenant: TenantId | null | undefined;
  /** The signed-in person. */
  userId: UserId | null | undefined;
}

function hasSensitivePart(queryKey: readonly unknown[]): boolean {
  return queryKey.some((part) => typeof part === 'string' && NEVER_PERSIST_PARTS.includes(part));
}

export function shouldPersistQuery(query: PersistableQuery, context: PersistContext): boolean {
  if (query.state.status !== 'success') return false;
  if (context.tenant === null || context.tenant === undefined || context.userId === null || context.userId === undefined) return false;
  if (tenantOf(query.queryKey) !== context.tenant) return false;
  if (!policyFor(domainOf(query.queryKey)).persist) return false;
  if (hasSensitivePart(query.queryKey)) return false;
  const owner = userOf(query.queryKey);
  if (owner !== undefined && String(owner) !== String(context.userId)) return false;
  return true;
}

/**
 * The saved cache is only used when this string matches. A new app version, another association or another person changes it, so the
 * old cache is dropped instead of being shown to the wrong person.
 */
export function persistBuster(input: { appVersion: string; tenant: TenantId; userId: UserId }): string {
  return `${input.appVersion}|${input.tenant}|${input.userId}`;
}

/** How long a saved cache may be shown on the next open. */
export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface InfiniteLike {
  pages?: unknown[];
  pageParams?: unknown[];
}

/** A long infinite list is saved as its first page only; the rest is fetched when the person scrolls. */
export function trimInfiniteData<T>(data: T): T {
  const infinite = data as unknown as InfiniteLike;
  if (infinite && Array.isArray(infinite.pages) && Array.isArray(infinite.pageParams) && infinite.pages.length > 1) {
    return { ...infinite, pages: infinite.pages.slice(0, 1), pageParams: infinite.pageParams.slice(0, 1) } as unknown as T;
  }
  return data;
}
