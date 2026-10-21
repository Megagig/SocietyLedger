import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/api/endpoints/auth';
import { memberInvitesApi } from '@/api/endpoints/memberInvites';
import { setTokens } from '@/lib/secure';
import { useSessionStore } from '@/stores/session';
import { mapLoginUserToSessionUser } from './mappers';

/** architecture.md §7.2 — stores the mobile token pair (always present; `client.ts` always sends
 * `X-Client: mobile`) and populates the session store. Navigation is the screen's own job
 * (code-standards.md §4 — routes compose feature hooks, they don't disappear into them). */
export function useLogin() {
  const setUser = useSessionStore((state) => state.setUser);

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async ({ user, token, refreshToken, accessTokenExpiresAt }) => {
      await setTokens({ accessToken: token, refreshToken, accessTokenExpiresAt });
      setUser(mapLoginUserToSessionUser(user));
    },
  });
}

export function useVerifyEmail() {
  return useMutation({ mutationFn: authApi.verifyEmail });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

export function useSelfRegister() {
  return useMutation({ mutationFn: memberInvitesApi.selfRegister });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword });
}

/** A9 — deliberately doesn't map a `SessionUser` (the response is thin: no `permissions`/`roles`/
 * `requiresOnboarding`, unlike login/`/me`). Stores the token pair only; the caller navigates to
 * `/` so `features/session/useBootstrap.ts` re-bootstraps the full session from `/auth/me`,
 * reusing F2.1's flow instead of a third, duplicate mapper. */
export function useAcceptInvite() {
  return useMutation({
    mutationFn: memberInvitesApi.acceptInvite,
    onSuccess: async ({ token, refreshToken, accessTokenExpiresAt }) => {
      if (token && refreshToken && accessTokenExpiresAt) {
        await setTokens({ accessToken: token, refreshToken, accessTokenExpiresAt });
      }
    },
  });
}
