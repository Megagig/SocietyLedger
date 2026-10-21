import { useEffect, useState } from 'react';
import { Pressable, Switch as RNSwitch, View } from 'react-native';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner-native';

import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { authenticateWithDevice, isBiometricAuthAvailable } from '@/lib/biometrics';
import { t } from '@/lib/i18n';
import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useThemeTokens } from '@/providers/ThemeProvider';

// `t()` is a plain placeholder-replace, no pluralization — explicit literal keys per option
// rather than a shared "{{count}} minute(s)" template.
const AUTO_LOCK_OPTIONS = [
  { label: t('profile.security.autoLock1'), value: '1' },
  { label: t('profile.security.autoLock5'), value: '5' },
  { label: t('profile.security.autoLock15'), value: '15' },
  { label: t('profile.security.autoLock30'), value: '30' },
];

/**
 * P3 — biometric unlock toggle + auto-lock timeout only (F2.4's scope; password change and the
 * signed-in devices list are F3.3's). Deliberately a **plain-controlled** toggle, not the
 * RHF-bound `components/forms/Switch` — this row applies immediately on change, the same
 * "no submitted form value" reasoning F1.5 already used for `SearchField`/`SegmentedControl`.
 * Turning biometrics on re-verifies with a real device prompt first (not just flipping the
 * flag), and unlocks the app-lock store so the user isn't immediately re-challenged.
 */
export default function SecurityScreen() {
  const { color } = useThemeTokens();
  const biometricsEnabled = usePrefsStore((state) => state.biometricsEnabled);
  const autoLockMinutes = usePrefsStore((state) => state.autoLockMinutes);
  const setBiometricsEnabled = usePrefsStore((state) => state.setBiometricsEnabled);
  const setAutoLockMinutes = usePrefsStore((state) => state.setAutoLockMinutes);
  const [verifying, setVerifying] = useState(false);

  // `SelectSheet` is RHF-bound only — a single-field form with no submit button is still the
  // simplest way to reuse it for a plain "pick one, apply immediately" picker. There's no
  // `onChange` prop to hook, so the selection is applied via `useWatch` + effect instead.
  const { control } = useForm<{ autoLockMinutes: string }>({
    defaultValues: { autoLockMinutes: String(autoLockMinutes) },
  });
  const selectedAutoLockMinutes = useWatch({ control, name: 'autoLockMinutes' });

  useEffect(() => {
    if (selectedAutoLockMinutes && Number(selectedAutoLockMinutes) !== autoLockMinutes) {
      setAutoLockMinutes(Number(selectedAutoLockMinutes));
    }
  }, [selectedAutoLockMinutes, autoLockMinutes, setAutoLockMinutes]);

  async function handleToggleBiometrics(next: boolean) {
    if (!next) {
      setBiometricsEnabled(false);
      return;
    }
    const available = await isBiometricAuthAvailable();
    if (!available) {
      toast.error(t('profile.security.noDeviceAuth'));
      return;
    }
    setVerifying(true);
    const result = await authenticateWithDevice(t('profile.security.confirmEnable'));
    setVerifying(false);
    if (result.success) {
      setBiometricsEnabled(true);
      useAppLockStore.getState().unlock();
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={t('profile.security.title')} large onBack={() => router.back()} />
      <View className="gap-1">
        <Pressable
          onPress={() => handleToggleBiometrics(!biometricsEnabled)}
          disabled={verifying}
          accessibilityRole="switch"
          accessibilityState={{ checked: biometricsEnabled, disabled: verifying }}
          className="flex-row items-center justify-between gap-3 py-3"
        >
          <View className="flex-1">
            <Text variant="body">{t('profile.security.biometricToggle')}</Text>
            <Text variant="caption" tone="secondary">
              {t('profile.security.biometricHelper')}
            </Text>
          </View>
          <RNSwitch
            testID="security-biometric-switch"
            value={biometricsEnabled}
            disabled={verifying}
            onValueChange={handleToggleBiometrics}
            trackColor={{ false: color.borderStrong, true: color.primary }}
            thumbColor={color.surface}
          />
        </Pressable>
        {biometricsEnabled ? (
          <SelectSheet
            control={control}
            name="autoLockMinutes"
            label={t('profile.security.autoLockLabel')}
            options={AUTO_LOCK_OPTIONS}
            testID="security-auto-lock"
          />
        ) : null}
      </View>
    </Screen>
  );
}
