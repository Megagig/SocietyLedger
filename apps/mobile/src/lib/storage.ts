import { createMMKV } from 'react-native-mmkv';

/**
 * One shared instance (library-docs.md's react-native-mmkv note). Keys namespaced:
 * `tenant.*`, `prefs.*`, `rq.cache`. Not encrypted by default — no tokens or PII beyond
 * cached own-data goes here (tokens live only in SecureStore, see `lib/secure.ts`).
 *
 * Absorbs `ThemeProvider.tsx`'s own dedicated instance (F1.2) — same `id`, so existing
 * persisted `prefs.themeMode` values survive the switch; `ThemeProvider`'s public API
 * (`useThemeMode`/`useThemeTokens`) is unchanged.
 */
export const storage = createMMKV({ id: 'societyledger' });

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function getBoolean(key: string): boolean | undefined {
  return storage.getBoolean(key);
}

export function setBoolean(key: string, value: boolean): void {
  storage.set(key, value);
}

export function getNumber(key: string): number | undefined {
  return storage.getNumber(key);
}

export function setNumber(key: string, value: number): void {
  storage.set(key, value);
}

export function getObject<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setObject<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
  storage.remove(key);
}
