/**
 * The way a screen asks for cached data. It builds the scoped key, applies the freshness window for the domain, and stays switched off until
 * the association (and, for personal data, the person) is known, so a key without a tenant is never built.
 *
 *   const { tenant } = useQueryScope();                       // each app has its own, from its own session
 *   const settings = useDomainQuery({ tenant, domain: 'settings', parts: ['association'], queryFn: () => api.get('/settings/association') });
 *   const mine     = useDomainQuery({ tenant, userId, personal: true, domain: 'ajoSavings', parts: [membershipId], queryFn: ... });
 *
 * The freshness window and whether the answer may be saved on the device come from the domain's entry in policy.ts. Pass `staleTime` only
 * when one screen really needs something different.
 */
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { key, userKey, type KeyPart, type TenantId, type UserId } from './keys';
import { queryDefaults } from './policy';

export interface DomainQueryOptions<TData, TError = Error> extends Omit<UseQueryOptions<TData, TError, TData, readonly unknown[]>, 'queryKey' | 'queryFn'> {
  /** The association. Null/undefined while it is not known yet: the query waits. */
  tenant: TenantId | null | undefined;
  /** The person, for `personal` data. */
  userId?: UserId | null;
  /** Data that belongs to one person (their own savings, contributions, profile): the key carries their id. */
  personal?: boolean;
  domain: string;
  parts?: readonly KeyPart[];
  queryFn: () => Promise<TData>;
}

/** Placed in the key while the tenant is unknown: the query is disabled, never fetched, never saved. */
const WAITING = '__waiting__';

export function domainQueryKey(options: Pick<DomainQueryOptions<unknown>, 'tenant' | 'userId' | 'personal' | 'domain' | 'parts'>): { queryKey: readonly unknown[]; ready: boolean } {
  const parts = options.parts ?? [];
  if (options.tenant === null || options.tenant === undefined || options.tenant === '') return { queryKey: [WAITING, options.domain, ...parts], ready: false };
  if (options.personal) {
    if (options.userId === null || options.userId === undefined) return { queryKey: [WAITING, options.domain, ...parts], ready: false };
    return { queryKey: userKey(options.tenant, options.userId, options.domain, ...parts), ready: true };
  }
  return { queryKey: key(options.tenant, options.domain, ...parts), ready: true };
}

export function useDomainQuery<TData, TError = Error>(options: DomainQueryOptions<TData, TError>): UseQueryResult<TData, TError> {
  const { tenant, userId, personal, domain, parts, queryFn, enabled, ...rest } = options;
  const { queryKey, ready } = domainQueryKey({ tenant, userId, personal, domain, parts });
  return useQuery<TData, TError, TData, readonly unknown[]>({
    ...queryDefaults(domain),
    ...rest,
    queryKey,
    queryFn,
    enabled: ready && enabled !== false,
  });
}
