import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { ListGroup } from '@/components/layout/ListItem';
import { Text } from '@/components/ui/Text';
import { t } from '@/lib/i18n';
import { useThemeMode } from '@/providers/ThemeProvider';
import { useThemeTokens } from '@/providers/ThemeProvider';

type ThemeOption = {
  value: 'light' | 'dark' | 'system';
  label: string;
};

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: t('profile.appearance.light') },
  { value: 'dark', label: t('profile.appearance.dark') },
  { value: 'system', label: t('profile.appearance.system') },
];

/** project-overview.md §6.7 — Appearance screen (F3.3). Theme preference persisted via ThemeProvider. */
export default function AppearanceScreen() {
  const { preference, setPreference } = useThemeMode();
  const { color } = useThemeTokens();

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('profile.appearance.title')} onBack={() => router.back()} />

      <View className="gap-2">
        <Text variant="caption" tone="secondary" className="mb-3">
          {t('profile.appearance.themeLabel')}
        </Text>
        <ListGroup>
          {OPTIONS.map(({ value, label }) => {
            const active = preference === value;
            return (
              <Pressable
                key={value}
                onPress={() => setPreference(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                android_ripple={{ color: `${color.primary}1F` }}
                className="flex-row items-center justify-between px-4 py-4"
              >
                <Text variant="body-lg">{label}</Text>
                {active && <Check size={20} color={color.primary} strokeWidth={2} />}
              </Pressable>
            );
          })}
        </ListGroup>
      </View>
    </Screen>
  );
}
