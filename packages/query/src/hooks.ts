/**
 * How a screen asks for cached data. The pieces that decide things live here and are pure (no React), so web and mobile, which run different
 * React versions, share them without sharing a copy of React. Each app wraps them in its own few-line hook:
 *
 *   function useScopedQuery(spec) {                       // apps/web/src/lib/query/index.ts
 *     const { tenant, userId } = useQueryScope();
 *     const { queryFn, ...rest } = spec;
 *     return useQuery({ ...domainQueryOptions({ ...spec, tenant, userId }), queryFn, ...rest });
 *   }
 *
 * `domainQueryOptions` gives the scoped key, the freshness window of the domain, and `enabled`, which stays false until the association (and,
 * for personal data, the person) is known so a key without a tenant is never built.
 */
import { key, userKey, type KeyPart, type TenantId, type UserId } from './keys';
import { queryDefaults, type QueryDefaults } from './policy';

export interface DomainQuerySpec {
  /** The association. Null/undefined while it is not known yet: the query waits. */
  tenant: TenantId | null | undefined;
  /** The person, for `personal` data. */
  userId?: UserId | null;
  /** Data that belongs to one person (their own savings, contributions, profile): the key carries their id. */
  personal?: boolean;
  domain: string;
  parts?: readonly KeyPart[];
  /** Set false to hold the query back for a reason of the screen's own (a permission, a closed panel). */
  enabled?: boolean;
}

/** Placed in the key while the tenant is unknown: the query is disabled, never fetched, never saved. */
const WAITING = '__waiting__';

export function domainQueryKey(spec: Pick<DomainQuerySpec, 'tenant' | 'userId' | 'personal' | 'domain' | 'parts'>): { queryKey: readonly unknown[]; ready: boolean } {
  const parts = spec.parts ?? [];
  if (spec.tenant === null || spec.tenant === undefined || spec.tenant === '') return { queryKey: [WAITING, spec.domain, ...parts], ready: false };
  if (spec.personal) {
    if (spec.userId === null || spec.userId === undefined) return { queryKey: [WAITING, spec.domain, ...parts], ready: false };
    return { queryKey: userKey(spec.tenant, spec.userId, spec.domain, ...parts), ready: true };
  }
  return { queryKey: key(spec.tenant, spec.domain, ...parts), ready: true };
}

export interface DomainQueryOptions extends QueryDefaults {
  queryKey: readonly unknown[];
  enabled: boolean;
}

export function domainQueryOptions(spec: DomainQuerySpec): DomainQueryOptions {
  const { queryKey, ready } = domainQueryKey(spec);
  return { ...queryDefaults(spec.domain), queryKey, enabled: ready && spec.enabled !== false };
}
