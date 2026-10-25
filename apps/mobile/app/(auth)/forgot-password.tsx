import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { TextField } from '@/components/forms/TextField';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useForgotPassword } from '@/features/auth/mutations';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/features/auth/schemas';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

/** A7 — "always shows the same success message (no account enumeration)." Reached only from
 * Login, which already has a tenant set; the guard below is a safety net, not a real path. */
export default function ForgotPasswordScreen() {
  const tenant = useTenantStore((state) => state.current);
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!tenant) router.replace('/(auth)/association');
  }, [tenant]);

  function onSubmit(values: ForgotPasswordFormValues) {
    forgotPassword.mutate(values, {
      onSuccess: () => setSent(true),
      onError: (error) => toast.error(error instanceof ApiError ? error.message : t('errors.generic')),
    });
  }

  if (!tenant) return null;

  if (sent) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title={t('auth.forgotPassword.title')} onBack={() => router.back()} />
        <EmptyState icon={MailCheck} title={t('auth.forgotPassword.sentTitle')} description={t('auth.forgotPassword.sentDescription')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.forgotPassword.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.forgotPassword.title')} large onBack={() => router.back()} />
      <View className="gap-4">
        <TextField
          control={control}
          name="email"
          label={t('auth.login.emailLabel')}
          helper={t('auth.forgotPassword.helper')}
          keyboardType="email-address"
          returnKeyType="done"
          testID="forgot-password-email"
        />
        <Button variant="gradient" size="lg" fullWidth loading={forgotPassword.isPending} onPress={() => handleSubmit(onSubmit)()} testID="forgot-password-submit">
          {t('auth.forgotPassword.submit')}
        </Button>
      </View>
    </Screen>
  );
}
