import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { Checkbox } from '@/components/forms/Checkbox';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useSelfRegister } from '@/features/auth/mutations';
import { registerSchema, type RegisterFormValues } from '@/features/auth/schemas';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

/** A5 — self-registration always goes through `/member-invites/self-register` (F2.1/F2.3's
 * finding), never `/auth/register` (creates a bare `User` with no `Member`). Always continues to
 * Verify Email next — self-registered accounts are never pre-verified, regardless of whether the
 * email matched an existing roster member (`isNewMember`) or created a new one. */
export default function RegisterScreen() {
  const tenant = useTenantStore((state) => state.current);
  const selfRegister = useSelfRegister();

  const { control, handleSubmit } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  useEffect(() => {
    if (!tenant) router.replace('/(auth)/association');
  }, [tenant]);

  function onSubmit(values: RegisterFormValues) {
    selfRegister.mutate(
      { email: values.email, password: values.password, firstName: values.firstName, lastName: values.lastName },
      {
        onSuccess: () => router.replace({ pathname: '/(auth)/verify-email', params: { email: values.email } }),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : t('errors.generic')),
      },
    );
  }

  if (!tenant) return null;

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.register.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.register.title')} large onBack={() => router.back()} />
      <View className="gap-4">
        <Text variant="body" tone="secondary">
          {t('auth.register.description', { name: tenant.name })}
        </Text>
        <TextField control={control} name="firstName" label={t('auth.register.firstNameLabel')} returnKeyType="next" testID="register-first-name" />
        <TextField control={control} name="lastName" label={t('auth.register.lastNameLabel')} returnKeyType="next" testID="register-last-name" />
        <TextField
          control={control}
          name="email"
          label={t('auth.register.emailLabel')}
          keyboardType="email-address"
          returnKeyType="next"
          testID="register-email"
        />
        <PasswordField control={control} name="password" label={t('auth.login.passwordLabel')} showStrength testID="register-password" />
        <PasswordField
          control={control}
          name="confirmPassword"
          label={t('auth.register.confirmPasswordLabel')}
          testID="register-confirm-password"
        />
        <Checkbox control={control} name="acceptTerms" label={t('auth.register.acceptTerms')} testID="register-accept-terms" />
        <Button variant="gradient" size="lg" fullWidth loading={selfRegister.isPending} onPress={() => handleSubmit(onSubmit)()} testID="register-submit">
          {t('auth.register.submit')}
        </Button>
      </View>
    </Screen>
  );
}
