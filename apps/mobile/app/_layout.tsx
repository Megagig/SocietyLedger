import '../src/theme/global.css';
import '../src/theme/interop';

import { useEffect } from 'react';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';

import { loadTokenCache } from '@/lib/secure';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider, useThemeMode } from '@/providers/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme } = useThemeMode();

  // F1.7 — `api/client.ts` needs the token cache loaded before any request can attach an
  // Authorization header. Just the cache load; calling `/auth/me` and routing on the result is
  // F1.8's job (there's no real boot sequence to hang that off yet).
  useEffect(() => {
    loadTokenCache();
  }, []);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <Toaster />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <RootNavigator />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
