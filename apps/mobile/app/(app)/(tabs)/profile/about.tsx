import { router } from 'expo-router';
import { ExternalLink } from 'lucide-react-native';
import { Image, Linking, View } from 'react-native';
import Constants from 'expo-constants';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';
import { useThemeTokens } from '@/providers/ThemeProvider';

/** project-overview.md §6.7 — About screen (F3.3). App version + legal links. */
export default function AboutScreen() {
  const { color } = useThemeTokens();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('profile.about.title')} onBack={() => router.back()} />

      <View className="gap-4">
        {/* Version chip */}
        <View className="items-center py-4 gap-1">
          <Image
            source={require('../../../../assets/images/logo-mark.png')}
            style={{ width: 72, height: 72 }}
            resizeMode="contain"
            accessibilityLabel="SocietyLedger"
          />
          <Text variant="h2">SocietyLedger</Text>
          <Text variant="caption" tone="tertiary">
            {t('profile.about.version')} {version}
          </Text>
        </View>

        <ListGroup>
          <ListItem
            title={t('profile.about.privacyPolicy')}
            trailing={<ExternalLink size={16} color={color.textTertiary} strokeWidth={1.75} />}
            onPress={() => Linking.openURL('https://societyledger.com/privacy').catch(() => {})}
          />
          <ListItem
            title={t('profile.about.terms')}
            trailing={<ExternalLink size={16} color={color.textTertiary} strokeWidth={1.75} />}
            onPress={() => Linking.openURL('https://societyledger.com/terms').catch(() => {})}
          />
          <ListItem
            title={t('profile.about.licenses')}
            trailing={<ExternalLink size={16} color={color.textTertiary} strokeWidth={1.75} />}
            onPress={() => Linking.openURL('https://societyledger.com/licenses').catch(() => {})}
          />
        </ListGroup>
      </View>
    </Screen>
  );
}
