import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch as RNSwitch, View } from 'react-native';
import { router } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner-native';
import { formatDistanceToNow } from 'date-fns';
import { Laptop, Smartphone } from 'lucide-react-native';

import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { SelectSheet } from '@/components/forms/SelectSheet';
import { PasswordField } from '@/components/forms/PasswordField';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { authenticateWithDevice, isBiometricAuthAvailable } from '@/lib/biometrics';
import { t } from '@/lib/i18n';
import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useSessions } from '@/features/session/queries';
import { useChangePassword, useRevokeSession } from '@/features/session/mutations';

const AUTO_LOCK_OPTIONS = [
  { label: t('profile.security.autoLock1'), value: '1' },
  { label: t('profile.security.autoLock5'), value: '5' },
  { label: t('profile.security.autoLock15'), value: '15' },
  { label: t('profile.security.autoLock30'), value: '30' },
];

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, t('profile.changePassword.minLength')),
    confirmPassword: z.string().min(1, 'Required'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: t('profile.changePassword.mismatch'),
    path: ['confirmPassword'],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

/** P3 — biometrics + auto-lock (F2.4) extended with password change form and signed-in devices (F3.3). */
export default function SecurityScreen() {
  const { color } = useThemeTokens();
  const biometricsEnabled = usePrefsStore((state) => state.biometricsEnabled);
  const autoLockMinutes = usePrefsStore((state) => state.autoLockMinutes);
  const setBiometricsEnabled = usePrefsStore((state) => state.setBiometricsEnabled);
  const setAutoLockMinutes = usePrefsStore((state) => state.setAutoLockMinutes);
  const [verifying, setVerifying] = useState(false);

  const sessionsQuery = useSessions();
  const changePassword = useChangePassword();
  const revokeSession = useRevokeSession();

  const autoLockForm = useForm<{ autoLockMinutes: string }>({
    defaultValues: { autoLockMinutes: String(autoLockMinutes) },
  });
  const selectedAutoLockMinutes = useWatch({ control: autoLockForm.control, name: 'autoLockMinutes' });

  useEffect(() => {
    if (selectedAutoLockMinutes && Number(selectedAutoLockMinutes) !== autoLockMinutes) {
      setAutoLockMinutes(Number(selectedAutoLockMinutes));
    }
  }, [selectedAutoLockMinutes, autoLockMinutes, setAutoLockMinutes]);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

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

  function onSubmitPassword(data: PasswordFormValues) {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          toast.success(t('profile.changePassword.success'));
          passwordForm.reset();
        },
        onError: () => toast.error('Could not update password. Check your current password.'),
      },
    );
  }

  function confirmRevoke(familyId: string) {
    Alert.alert(
      t('profile.security.revokeConfirm'),
      undefined,
      [
        { text: t('profile.security.revokeConfirmNo'), style: 'cancel' },
        {
          text: t('profile.security.revokeConfirmYes'),
          style: 'destructive',
          onPress: () =>
            revokeSession.mutate(familyId, {
              onError: () => toast.error('Could not sign out that device. Try again.'),
            }),
        },
      ],
    );
  }

  return (
    <Screen edges={['top', 'bottom']} scroll keyboard>
      <ScreenHeader title={t('profile.security.title')} large onBack={() => router.back()} />

      {/* Biometrics + auto-lock */}
      <Section>
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
              control={autoLockForm.control}
              name="autoLockMinutes"
              label={t('profile.security.autoLockLabel')}
              options={AUTO_LOCK_OPTIONS}
              testID="security-auto-lock"
            />
        ) : null}
      </Section>

      {/* Password change */}
      <Section title={t('profile.security.passwordSection')}>
        <PasswordField
          control={passwordForm.control}
          name="currentPassword"
          label={t('profile.changePassword.current')}
        />
        <PasswordField
          control={passwordForm.control}
          name="newPassword"
          label={t('profile.changePassword.new')}
          showStrength
        />
        <PasswordField
          control={passwordForm.control}
          name="confirmPassword"
          label={t('profile.changePassword.confirm')}
        />
        <View className="pt-2">
          <Button
            variant="secondary"
            loading={changePassword.isPending}
            onPress={() => { passwordForm.handleSubmit(onSubmitPassword)(); }}
            fullWidth
          >
            {t('profile.changePassword.submit')}
          </Button>
        </View>
      </Section>

      {/* Signed-in devices */}
      <Section title={t('profile.security.sessionsSection')}>
        <Text variant="caption" tone="secondary" className="-mt-1">
          {t('profile.security.sessionsHelper')}
        </Text>
        {sessionsQuery.isPending && (
          <View className="gap-2 px-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={56} />
            ))}
          </View>
        )}
        {sessionsQuery.isSuccess && (
          <ListGroup>
            {(sessionsQuery.data ?? []).map((session) => {
              const isPhone = session.platform?.toLowerCase().includes('ios') ||
                session.platform?.toLowerCase().includes('android');
              const Icon = isPhone ? Smartphone : Laptop;
              const label = session.deviceName ?? session.platform ?? 'Unknown device';
              const lastUsed = formatDistanceToNow(new Date(session.lastUsedAt), { addSuffix: true });
              return (
                <ListItem
                  key={session.familyId}
                  leading={<Icon size={20} color={color.textSecondary} strokeWidth={1.75} />}
                  title={label}
                  meta={`Last active ${lastUsed}`}
                  trailing={
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => confirmRevoke(session.familyId)}
                      loading={revokeSession.isPending}
                    >
                      {t('profile.security.revokeSession')}
                    </Button>
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </Section>
    </Screen>
  );
}
