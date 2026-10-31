import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { domainQueryOptions, type DomainQuerySpec } from '@societyledger/query';
import { useAuthStore } from '@/store/authStore';
import { queryScope, type QueryScope } from './identity';

export { QueryBoundary } from './QueryBoundary';
export { queryScope, ANONYMOUS_SCOPE, type QueryScope } from './identity';
export { isRetryableRead } from './client';

/**
 * The association and person whose data a query is for. Build keys with it:
 *   const { tenant, userId } = useQueryScope();
 *   useQuery({ queryKey: key(tenant, 'members', 'list'), ...queryDefaults('members'), enabled: tenant !== null });
 * A key cannot be built without a tenant, so always pair it with `enabled`.
 */
export function useQueryScope(): QueryScope {
  const user = useAuthStore((s) => s.user);
  const impersonated = useAuthStore((s) => s.impersonatedAssociation);
  return queryScope(user, impersonated);
}

export type ScopedQueryOptions<TData, TError> = Omit<DomainQuerySpec, 'tenant' | 'userId'> &
  Omit<UseQueryOptions<TData, TError, TData, readonly unknown[]>, 'queryKey' | 'enabled'> & { queryFn: () => Promise<TData> };

/**
 * useScopedQuery({ domain: 'settings', parts: ['association'], queryFn }): a cached query for the signed-in association (and person, for
 * `personal` data). The key, the freshness window and whether the answer may be saved on the device come from the domain's entry in
 * @societyledger/query (policy.ts); the query waits until the association is known. Anything else useQuery accepts can be passed to override.
 */
export function useScopedQuery<TData, TError = Error>(options: ScopedQueryOptions<TData, TError>): UseQueryResult<TData, TError> {
  const { tenant, userId } = useQueryScope();
  const { domain, parts, personal, enabled, ...rest } = options;
  return useQuery<TData, TError, TData, readonly unknown[]>({ ...domainQueryOptions({ tenant, userId, personal, domain, parts, enabled }), ...rest });
}
