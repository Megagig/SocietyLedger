import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { toast } from 'sonner-native';

import { clearTokens, getTokenCache, setTokens } from '@/lib/secure';
import { useModulesStore } from '@/stores/modules';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';
import { ApiError } from './errors';

// In dev, derive the host from the Expo dev server so the URL survives network changes.
// In production, use the built-in env var.
function resolveApiUrl(): string {
  if (__DEV__) {
    const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (expoHost) return `http://${expoHost}:4001/api`;
  }
  return `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4001'}/api`;
}

const BASE_URL = resolveApiUrl();

// architecture.md §13 — "<version>+<build>".
function appVersionHeader(): string {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = Platform.select({
    ios: Constants.expoConfig?.ios?.buildNumber,
    android: Constants.expoConfig?.android?.versionCode ? String(Constants.expoConfig.android.versionCode) : undefined,
    default: undefined,
  });
  return build ? `${version}+${build}` : version;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string | null> | null = null;

/** Single-flight — concurrent 401s share one in-flight refresh rather than each triggering their own (architecture.md §7.2, this feature's DoD). */
async function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  const { refreshToken } = getTokenCache();
  if (!refreshToken) return null;

  try {
    // A bare axios call, not `client.post(...)` — bypasses this instance's own interceptors so
    // a failed refresh can't recursively trigger another 401-refresh cycle against itself.
    const response = await axios.post<{ data: { token: string; refreshToken: string; accessTokenExpiresAt: string } }>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 15000, headers: { 'X-Client': 'mobile' } },
    );
    const { token, refreshToken: nextRefreshToken, accessTokenExpiresAt } = response.data.data;
    await setTokens({ accessToken: token, refreshToken: nextRefreshToken, accessTokenExpiresAt });
    return token;
  } catch {
    return null;
  }
}

/**
 * architecture.md §7.2's "sign out with toast 'Session expired'" — scoped to exactly what
 * `api/**` is allowed to touch (`lib/secure`, `stores/session`): clears the invalid tokens and
 * flips session status to `unauthenticated` (F1.8's auth guard reacts to that and navigates).
 * Does NOT clear the query cache or navigate itself — `providers/*` and `app/*` aren't in
 * `api/**`'s allowed-import list (architecture.md §5); the full logout sequence (query cache,
 * push-token unregister, navigation) is a `features/auth` concern (F2.x).
 */
async function forceSignOut(): Promise<void> {
  await clearTokens();
  useSessionStore.getState().reset();
  useModulesStore.getState().reset();
  toast.error('Session expired');
}

function isModuleDisabledError(data: unknown): data is { error: 'MODULE_DISABLED' | 'FEATURE_DISABLED'; module: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    (data.error === 'MODULE_DISABLED' || data.error === 'FEATURE_DISABLED') &&
    'module' in data &&
    typeof (data as { module: unknown }).module === 'string'
  );
}

// eslint-disable-next-line import/no-named-as-default-member -- axios's default export is the real API; it also happens to re-export `create` as a named export of the same name, which is what this rule is cautioning about, not an actual misuse here.
export const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

client.interceptors.request.use(async (config) => {
  const tenant = useTenantStore.getState().current?.subdomain;
  if (tenant) {
    config.headers.set('X-Tenant', tenant);
  }

  let { accessToken } = getTokenCache();
  const { accessTokenExpiresAt, refreshToken } = getTokenCache();

  // Proactive refresh when < 60s remain (architecture.md §7.2) — reactive 401 handling in the
  // response interceptor below still exists as a fallback for whatever this misses (clock
  // skew, a request already in flight when the token expired).
  if (accessToken && refreshToken && accessTokenExpiresAt) {
    const msRemaining = new Date(accessTokenExpiresAt).getTime() - Date.now();
    if (msRemaining < 60_000) {
      accessToken = (await refreshSession()) ?? accessToken;
    }
  }

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  config.headers.set('X-Client', 'mobile');
  config.headers.set('X-App-Version', appVersionHeader());

  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!error.response) {
      throw ApiError.fromAxiosError(error);
    }

    const { status, data } = error.response;
    const config = error.config as RetryableConfig | undefined;
    const isRefreshCall = config?.url?.includes('/auth/refresh');

    if (status === 401 && config && !config._retry && !isRefreshCall) {
      config._retry = true;
      const newToken = await refreshSession();
      if (newToken) {
        config.headers.set('Authorization', `Bearer ${newToken}`);
        return client(config);
      }
      await forceSignOut();
    }

    if (status === 403 && isModuleDisabledError(data)) {
      useModulesStore.getState().markDisabled(data.module);
    }

    // The association's free trial or subscription has ended: the whole app is paused until it pays, so swap it for the blocked screen
    // instead of letting every list fail on its own.
    if (status === 403 && typeof data === 'object' && data !== null && (data as { code?: unknown }).code === 'SUBSCRIPTION_INACTIVE') {
      useSessionStore.getState().markSubscriptionBlocked((data as { reason?: string }).reason);
    }

    // 429: never retried here — architecture.md §6.3 ("never auto-retry"); this interceptor adds
    // no retry logic for it, so it simply falls through to the throw below like any other error.

    throw ApiError.fromAxiosError(error);
  },
);
