import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '@/api/endpoints/auth';
import { clearTokens, getTokenCache } from '@/lib/secure';
import { useAppLockStore } from '@/stores/appLock';
import { useModulesStore } from '@/stores/modules';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';

export type LogoutOptions = { clearTenant?: boolean };

/**
 * architecture.md §7.2 — logout is best-effort server-side (same wording the backend's own
 * comment uses); every local wipe below happens regardless of whether that call succeeds, so the
 * `.catch()` here is a deliberate exception to code-standards.md §10's "never swallow silently",
 * not an oversight. Push-token unregister (F3.1, not built yet) is deliberately not included.
 * `clearTenant: true` is the "Switch association" variant — plain sign-out keeps the tenant so
 * Login can be reached again quickly.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const resetSession = useSessionStore((state) => state.reset);
  const resetModules = useModulesStore((state) => state.reset);
  const clearTenant = useTenantStore((state) => state.clearCurrent);
  const lock = useAppLockStore((state) => state.lock);

  return useMutation({
    mutationFn: async (options?: LogoutOptions) => {
      const { refreshToken } = getTokenCache();
      await authApi.logout({ refreshToken: refreshToken ?? undefined }).catch(() => {});
      await clearTokens();
      return options ?? {};
    },
    onSuccess: (options) => {
      queryClient.clear();
      resetSession();
      resetModules();
      lock();
      if (options.clearTenant) clearTenant();
    },
  });
}
