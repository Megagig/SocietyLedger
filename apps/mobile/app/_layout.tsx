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
import { configureForegroundHandler, setupAndroidChannels } from '@/lib/push';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider, useThemeMode } from '@/providers/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { scheme } = useThemeMode();

  useEffect(() => {
    loadTokenCache();
    // F3.1 — Foreground handler must be set before any notification arrives.
    configureForegroundHandler();
    // Android notification channels; no-op on iOS.
    setupAndroidChannels().catch(() => {});
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
