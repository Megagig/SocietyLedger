import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi, type ChangePasswordPayload } from '@/api/endpoints/auth';
import { membersApi, type UpdateProfilePayload } from '@/api/endpoints/members';
import { clearTokens, getTokenCache } from '@/lib/secure';
import { unregisterPushToken } from '@/lib/push';
import { useAppLockStore } from '@/stores/appLock';
import { useModulesStore } from '@/stores/modules';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';
import { sessionKeys } from './queries';

export type LogoutOptions = { clearTenant?: boolean };

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authApi.changePassword(payload),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => membersApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.profile() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (familyId: string) => authApi.revokeSession(familyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.sessions() });
    },
  });
}

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
      // F3.1 — unregister push token before clearing credentials (architecture.md §8.1.3)
      await unregisterPushToken();
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
