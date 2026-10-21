import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { PasswordField } from '@/components/forms/PasswordField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useResetPassword } from '@/features/auth/mutations';
import { newPasswordSchema, type NewPasswordFormValues } from '@/features/auth/schemas';
import { useCheckSubdomain } from '@/features/tenant/queries';
import { t } from '@/lib/i18n';
import { parseParams } from '@/lib/params';
import { useTenantStore } from '@/stores/tenant';

const paramsSchema = z.object({ token: z.string().min(1), tenant: z.string().min(1).optional() });

/**
 * A8 — opened from the `societyledger://reset-password` deep link via `+native-intent.tsx`.
 * `POST /auth/reset-password` works without a resolved tenant (`associationId` is optional
 * server-side) — resolving one here is purely so Login works directly after a successful reset,
 * without bouncing the user back to Association Code first ("set tenant from link first",
 * build-plan.md F2.3). A missing/invalid `tenant` param degrades gracefully: the reset itself
 * still works, Login's own guard just redirects to Association Code afterward.
 */
export default function ResetPasswordScreen() {
  const rawParams = useLocalSearchParams();
  const params = parseParams(paramsSchema, rawParams);
  const setCurrentTenant = useTenantStore((state) => state.setCurrent);

  const lookup = useCheckSubdomain(params?.tenant ?? '', !!params?.tenant);
  const resetPassword = useResetPassword();

  const { control, handleSubmit } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (lookup.isSuccess) setCurrentTenant(lookup.data);
  }, [lookup.isSuccess, lookup.data, setCurrentTenant]);

  // No deep link reaches this screen without a `token` — this is a safety net, not a real path.
  useEffect(() => {
    if (!params) router.replace('/(auth)/welcome');
  }, [params]);

  if (!params) return null;
  const { token } = params;

  function onSubmit({ password }: NewPasswordFormValues) {
    resetPassword.mutate(
      { token, password },
      {
        onSuccess: () => {
          toast.success(t('auth.resetPassword.success'));
          router.replace('/(auth)/login');
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : t('errors.generic')),
      },
    );
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.resetPassword.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.resetPassword.title')} large />
      <View className="gap-4">
        <PasswordField control={control} name="password" label={t('auth.resetPassword.newPasswordLabel')} showStrength testID="reset-password-new" />
        <PasswordField
          control={control}
          name="confirmPassword"
          label={t('auth.register.confirmPasswordLabel')}
          testID="reset-password-confirm"
        />
        <Button variant="gradient" size="lg" fullWidth loading={resetPassword.isPending} onPress={() => handleSubmit(onSubmit)()} testID="reset-password-submit">
          {t('auth.resetPassword.submit')}
        </Button>
      </View>
    </Screen>
  );
}
