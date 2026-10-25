import { Image, View } from 'react-native';
import { Redirect } from 'expo-router';

import { Spinner } from '@/components/ui/Spinner';
import { useSessionBootstrap } from '@/features/session/useBootstrap';

/**
 * architecture.md §7.3/§6.1 (A1) — the real splash decision: `useSessionBootstrap` reads
 * SecureStore, calls `/auth/me` when a token exists, and resolves where to go. "Max 1.5 s" is a
 * UX target, not a hard race against the network call — routing to tabs before a slow `/auth/me`
 * resolves would show an unauthenticated flash, so this just renders the brand mark + spinner for
 * however long the real decision takes (`(app)/_layout.tsx`'s guard is the backstop either way).
 */
export default function SplashRedirect() {
  const destination = useSessionBootstrap();

  if (!destination) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Image source={require('../assets/images/logo-mark.png')} style={{ width: 96, height: 96 }} resizeMode="contain" accessibilityLabel="SocietyLedger" />
        <View className="mt-6">
          <Spinner size="lg" />
        </View>
      </View>
    );
  }

  return <Redirect href={destination} />;
}
