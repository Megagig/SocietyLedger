import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { WelcomeCarousel } from '@/features/auth/components/WelcomeCarousel';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { t } from '@/lib/i18n';

/** A2 — Welcome screen. Uses a raw View (not Screen) so the carousel's illustration panel can be
 * truly full-width and edge-to-edge without the Screen component's 16dp horizontal padding. Safe
 * area insets are handled manually: `topInset` is passed to the carousel (brand wordmark
 * positioning), `insets.bottom` pads the CTA buttons. */
export default function WelcomeScreen() {
  const { color } = useThemeTokens();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.surface }}>
      {/* Light icons so they read over the dark green illustration panel */}
      <StatusBar style="light" />

      <WelcomeCarousel topInset={insets.top} />

      <View
        style={{
          width: '100%',
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 16,
          gap: 12,
        }}
      >
        <Button
          variant="gradient"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/association')}
          testID="welcome-get-started"
        >
          {t('auth.welcome.getStarted')}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          fullWidth
          onPress={() => toast(t('auth.welcome.createAssociationComingSoon'))}
          testID="welcome-create-association"
        >
          {t('auth.welcome.createAssociation')}
        </Button>
      </View>
    </View>
  );
}
