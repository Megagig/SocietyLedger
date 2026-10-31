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
