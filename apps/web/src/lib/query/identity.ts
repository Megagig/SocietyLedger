/**
 * Who the cache belongs to. One identity = one query client = one saved cache. When the person, or the association they are acting in,
 * changes, the identity changes and everything cached for the old one is dropped (QueryBoundary.tsx).
 */
import type { User } from '@/types';

export interface QueryScope {
  /** The association whose data is on screen: the one being impersonated, else the user's own. Null for platform staff and signed-out visitors. */
  tenant: number | null;
  userId: number | null;
  /** Stable text for comparing and naming. 'anonymous' when nobody is signed in. */
  id: string;
}

export const ANONYMOUS_SCOPE: QueryScope = { tenant: null, userId: null, id: 'anonymous' };

export function queryScope(user: Pick<User, 'id' | 'associationId'> | null | undefined, impersonated?: { id: number } | null): QueryScope {
  if (!user) return ANONYMOUS_SCOPE;
  const tenant = impersonated?.id ?? user.associationId ?? null;
  // A platform user with no association still gets their own scope, so their cache is never shared with anyone else's.
  return { tenant, userId: user.id, id: `${tenant ?? 'platform'}:${user.id}` };
}
