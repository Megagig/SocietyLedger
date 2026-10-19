import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createMMKV } from 'react-native-mmkv';

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import { tokens, type ThemeMode } from '@/theme/tokens';

type ColorSchemePreference = ThemeMode | 'system';

type ThemeContextValue = {
  preference: ColorSchemePreference;
  scheme: ThemeMode;
  setPreference: (preference: ColorSchemePreference) => void;
};

const THEME_STORAGE_KEY = 'prefs.themeMode';

// Dedicated instance for this one preference key. The shared MMKV wrapper
// (src/lib/storage.ts) lands in a later feature (F1.6) — this gets folded
// into it then without changing ThemeProvider's public API.
const themeStorage = createMMKV({ id: 'societyledger' });

function parsePreference(stored: string | undefined): ColorSchemePreference {
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function subscribeToThemeStorage(onStoreChange: () => void) {
  const listener = themeStorage.addOnValueChangedListener((changedKey) => {
    if (changedKey === THEME_STORAGE_KEY) {
      onStoreChange();
    }
  });
  return () => listener.remove();
}

function getThemeStorageSnapshot(): ColorSchemePreference {
  return parsePreference(themeStorage.getString(THEME_STORAGE_KEY));
}

// Never touches storage — Expo Router's static-export prerendering runs on
// Node, where this MMKV instance's web shim has no localStorage to read.
function getThemeStorageServerSnapshot(): ColorSchemePreference {
  return 'system';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
}

export function useThemeTokens() {
  const { scheme } = useThemeMode();
  return tokens[scheme];
}

type ThemeProviderProps = {
  children: ReactNode;
  /** Rendered instead of children while fonts are still loading. */
  fallback?: ReactNode;
};

export function ThemeProvider({ children, fallback = null }: ThemeProviderProps) {
  const { colorScheme, setColorScheme } = useNativeWindColorScheme();
  const preference = useSyncExternalStore(
    subscribeToThemeStorage,
    getThemeStorageSnapshot,
    getThemeStorageServerSnapshot,
  );

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const scheme: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';

  const setPreference = useCallback((next: ColorSchemePreference) => {
    themeStorage.set(THEME_STORAGE_KEY, next);
    // Triggers subscribeToThemeStorage's listener synchronously, which
    // updates `preference` via useSyncExternalStore — no local setState here.
  }, []);

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  useEffect(() => {
    const backgroundColor = tokens[scheme].color.bg;
    SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => {
      // Best-effort only — not critical to app function.
    });
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, setPreference }),
    [preference, scheme, setPreference],
  );

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden — safe to ignore.
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <>{fallback}</>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
