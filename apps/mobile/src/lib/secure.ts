import * as SecureStore from 'expo-secure-store';

/** library-docs.md's expo-secure-store note — never read from here on a hot path; cached in memory at boot. */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const KEYS = {
  accessToken: 'sl.accessToken',
  refreshToken: 'sl.refreshToken',
  accessTokenExpiresAt: 'sl.accessExpiresAt',
} as const;

export type TokenCache = {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
};

let tokenCache: TokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };

/** Reads all 3 keys into memory — call once at boot (architecture.md §7.3), before any request needs a token. */
export async function loadTokenCache(): Promise<TokenCache> {
  const [accessToken, refreshToken, accessTokenExpiresAt] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken, SECURE_OPTIONS),
    SecureStore.getItemAsync(KEYS.refreshToken, SECURE_OPTIONS),
    SecureStore.getItemAsync(KEYS.accessTokenExpiresAt, SECURE_OPTIONS),
  ]);
  tokenCache = { accessToken, refreshToken, accessTokenExpiresAt };
  return tokenCache;
}

/** Synchronous read of the in-memory cache — never touches the native module. */
export function getTokenCache(): TokenCache {
  return tokenCache;
}

async function writeOrDelete(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  } else {
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
  }
}

/** Updates both the in-memory cache and SecureStore — pass only the keys that changed. */
export async function setTokens(next: Partial<TokenCache>): Promise<void> {
  tokenCache = { ...tokenCache, ...next };
  await Promise.all(
    (Object.entries(next) as [keyof TokenCache, string | null | undefined][])
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => writeOrDelete(KEYS[key], value as string | null)),
  );
}

export async function clearTokens(): Promise<void> {
  tokenCache = { accessToken: null, refreshToken: null, accessTokenExpiresAt: null };
  await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key, SECURE_OPTIONS)));
}
