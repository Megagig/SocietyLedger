import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AssociationBadge } from '@/features/auth/components/AssociationBadge';
import { BiometricOptInSheet } from '@/features/auth/components/BiometricOptInSheet';
import { useLogin } from '@/features/auth/mutations';
import { loginSchema, type LoginFormValues } from '@/features/auth/schemas';
import { landingHref } from '@/features/session/landing';
import { isBiometricAuthAvailable } from '@/lib/biometrics';
import { t } from '@/lib/i18n';
import { useAppLockStore } from '@/stores/appLock';
import { usePrefsStore } from '@/stores/prefs';
import { useSessionStore } from '@/stores/session';
import { useTenantStore } from '@/stores/tenant';

/** architecture.md §6.3's login error table — each `code` routes somewhere specific; everything
 * else (invalid credentials, validation) stays on this screen as a toast. */
const BLOCKED_VARIANT_BY_CODE: Record<string, string> = {
  ACCOUNT_REJECTED: 'account-rejected',
  ACCOUNT_SUSPENDED: 'account-suspended',
  ASSOCIATION_SUSPENDED: 'association-suspended',
  ASSOCIATION_CANCELLED: 'association-cancelled',
  ASSOCIATION_NOT_FOUND: 'association-not-found',
};

export default function LoginScreen() {
  const tenant = useTenantStore((state) => state.current);
  const { email: prefillEmail } = useLocalSearchParams<{ email?: string }>();
  const login = useLogin();
  const biometricSheetRef = useRef<BottomSheetModal>(null);
  const hasSeenBiometricPrompt = usePrefsStore((state) => state.hasSeenBiometricPrompt);
  const markBiometricPromptSeen = usePrefsStore((state) => state.markBiometricPromptSeen);
  const setBiometricsEnabled = usePrefsStore((state) => state.setBiometricsEnabled);

  const { control, handleSubmit } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: prefillEmail ?? '', password: '' },
  });

  // A3 always sets a tenant before pushing here, and nothing else links to this route yet (no
  // deep link reaches it) — this is a safety net, not a real path, so it doesn't warrant a
  // dedicated empty state.
  useEffect(() => {
    if (!tenant) router.replace('/(auth)/association');
  }, [tenant]);

  function handleLoginError(error: unknown, email: string) {
    if (!(error instanceof ApiError)) {
      toast.error(t('errors.generic'));
      return;
    }

    if (error.code === 'EMAIL_NOT_VERIFIED') {
      router.push({ pathname: '/(auth)/verify-email', params: { email } });
      return;
    }
    if (error.code === 'PENDING_APPROVAL') {
      router.push({ pathname: '/(auth)/pending', params: { email } });
      return;
    }
    if (error.code === 'PLATFORM_LOGIN_REQUIRED') {
      router.push('/(auth)/web-only');
      return;
    }
    const blockedVariant = error.code ? BLOCKED_VARIANT_BY_CODE[error.code] : undefined;
    if (blockedVariant) {
      router.push({ pathname: '/(auth)/blocked', params: { variant: blockedVariant } });
      return;
    }
    if (error.status === 429) {
      toast.error(t('auth.login.rateLimited'));
      return;
    }
    // Invalid credentials and anything else unmapped — the message is already written for users
    // (code-standards.md §10).
    toast.error(error.message);
  }

  // A new association's admin goes to the setup wizard first; everyone else lands on Home.
  function goToTabs() {
    router.replace(landingHref(useSessionStore.getState().user));
  }

  // architecture.md §7.5 — "Optional, prompted once after first login." Device-support and
  // once-only checks happen here; the sheet itself is dumb content.
  async function maybeShowBiometricPrompt() {
    if (hasSeenBiometricPrompt) {
      goToTabs();
      return;
    }
    const available = await isBiometricAuthAvailable();
    if (!available) {
      markBiometricPromptSeen();
      goToTabs();
      return;
    }
    biometricSheetRef.current?.present();
  }

  function handleEnableBiometrics() {
    setBiometricsEnabled(true);
    markBiometricPromptSeen();
    useAppLockStore.getState().unlock(); // don't immediately re-lock right after opting in
    biometricSheetRef.current?.dismiss();
    goToTabs();
  }

  function handleSkipBiometrics() {
    markBiometricPromptSeen();
    goToTabs();
  }

  function onSubmit(values: LoginFormValues) {
    login.mutate(values, {
      onSuccess: () => maybeShowBiometricPrompt(),
      onError: (error) => handleLoginError(error, values.email),
    });
  }

  if (!tenant) return null;

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.login.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.login.title')} large onBack={() => router.back()} />
      <View className="gap-4">
        <AssociationBadge tenant={tenant} onPress={() => router.push('/(auth)/association')} />
        <TextField
          control={control}
          name="email"
          label={t('auth.login.emailLabel')}
          keyboardType="email-address"
          returnKeyType="next"
          testID="login-email"
        />
        <PasswordField control={control} name="password" label={t('auth.login.passwordLabel')} testID="login-password" />
        <Button variant="ghost" onPress={() => router.push('/(auth)/forgot-password')} testID="login-forgot-password">
          {t('auth.login.forgotPassword')}
        </Button>
        <Button variant="gradient" size="lg" fullWidth loading={login.isPending} onPress={() => handleSubmit(onSubmit)()} testID="login-submit">
          {t('auth.login.signIn')}
        </Button>
        <Button variant="secondary" size="lg" fullWidth onPress={() => router.push('/(auth)/register')} testID="login-register">
          {t('auth.login.register')}
        </Button>
      </View>
      <BiometricOptInSheet ref={biometricSheetRef} onEnable={handleEnableBiometrics} onSkip={handleSkipBiometrics} />
    </Screen>
  );
}
