import type { UseQueryResult } from '@tanstack/react-query';
import { useDomainQuery, type DomainQueryOptions } from '@societyledger/query';
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

/**
 * `useScopedQuery({ domain: 'settings', parts: ['association'], queryFn })`: the shared `useDomainQuery` with this app's association and
 * person filled in. Use it for any screen that should be cached; the domain's entry in @societyledger/query/policy.ts sets how long the answer
 * is trusted and whether it is saved on the device.
 */
export function useScopedQuery<TData, TError = Error>(options: Omit<DomainQueryOptions<TData, TError>, 'tenant' | 'userId'>): UseQueryResult<TData, TError> {
  const { tenant, userId } = useQueryScope();
  return useDomainQuery<TData, TError>({ ...options, tenant, userId });
}
