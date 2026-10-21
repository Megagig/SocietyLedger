import { useEffect } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserX } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PasswordField } from '@/components/forms/PasswordField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { useAcceptInvite } from '@/features/auth/mutations';
import { useVerifyInvite } from '@/features/auth/queries';
import { newPasswordSchema, type NewPasswordFormValues } from '@/features/auth/schemas';
import { useCheckSubdomain } from '@/features/tenant/queries';
import { t } from '@/lib/i18n';
import { useTenantStore } from '@/stores/tenant';

/**
 * A9 — opened from the `societyledger://invite` deep link. The tenant comes from
 * `GET /member-invites/verify`'s own response (the server-confirmed association), not a
 * client-supplied param — `+native-intent.tsx` deliberately doesn't forward one for this link.
 * On success, `useAcceptInvite` stores the mobile token pair but builds no `SessionUser` (the
 * response is too thin) — this screen hands off to `/` so `useSessionBootstrap` re-derives the
 * full session from `/auth/me`, the same path a normal login would take.
 */
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const verify = useVerifyInvite(token ?? '');
  const setCurrentTenant = useTenantStore((state) => state.setCurrent);
  const tenantLookup = useCheckSubdomain(verify.data?.association.subdomain ?? '', !!verify.data);
  const acceptInvite = useAcceptInvite();

  const { control, handleSubmit } = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (tenantLookup.isSuccess) setCurrentTenant(tenantLookup.data);
  }, [tenantLookup.isSuccess, tenantLookup.data, setCurrentTenant]);

  // No deep link reaches this screen without a `token` — this is a safety net, not a real path.
  useEffect(() => {
    if (!token) router.replace('/(auth)/welcome');
  }, [token]);

  if (!token) return null;
  const inviteToken = token;

  function onSubmit({ password }: NewPasswordFormValues) {
    acceptInvite.mutate(
      { token: inviteToken, password },
      {
        onSuccess: () => router.replace('/'),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : t('errors.generic')),
      },
    );
  }

  if (verify.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={t('auth.acceptInvite.title')} large />
        <View className="gap-4">
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={16} />
          <Skeleton width="100%" height={52} />
          <Skeleton width="100%" height={52} />
        </View>
      </Screen>
    );
  }

  if (verify.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title={t('auth.acceptInvite.title')} />
        <EmptyState
          icon={UserX}
          title={t('auth.acceptInvite.invalidTitle')}
          description={verify.error instanceof ApiError ? verify.error.message : t('errors.generic')}
        />
      </Screen>
    );
  }

  const { member, association } = verify.data;

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.acceptInvite.title') }} />
      <ScreenHeader title={t('auth.acceptInvite.title')} large />
      <View className="gap-4">
        <View className="gap-1">
          <Text variant="h3">
            {member.firstName} {member.lastName}
          </Text>
          <Text variant="body" tone="secondary">
            {t('auth.acceptInvite.description', { name: association.name })}
          </Text>
        </View>
        <PasswordField control={control} name="password" label={t('auth.resetPassword.newPasswordLabel')} showStrength testID="accept-invite-password" />
        <PasswordField
          control={control}
          name="confirmPassword"
          label={t('auth.register.confirmPasswordLabel')}
          testID="accept-invite-confirm-password"
        />
        <Button variant="gradient" size="lg" fullWidth loading={acceptInvite.isPending} onPress={() => handleSubmit(onSubmit)()} testID="accept-invite-submit">
          {t('auth.acceptInvite.submit')}
        </Button>
      </View>
    </Screen>
  );
}
