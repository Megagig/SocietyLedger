import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ApiError } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { Text } from '@/components/ui/Text';
import { AuthBrandMark } from '@/components/ui/AuthBrandMark';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { AssociationConfirmationCard } from '@/features/tenant/components/AssociationConfirmationCard';
import { RecentAssociationsList } from '@/features/tenant/components/RecentAssociationsList';
import { useCheckSubdomain } from '@/features/tenant/queries';
import { associationCodeSchema, type AssociationCodeFormValues } from '@/features/tenant/schemas';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { t } from '@/lib/i18n';
import { useTenantStore, type TenantSummary } from '@/stores/tenant';

function lookupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return t('auth.association.notFound');
    if (error.code === 'SUBDOMAIN_RESERVED') return t('auth.association.reserved');
    if (error.status === 403) return t('auth.association.inactive');
  }
  return t('auth.association.genericError');
}

export default function AssociationCodeScreen() {
  const { control } = useForm<AssociationCodeFormValues>({
    resolver: zodResolver(associationCodeSchema),
    mode: 'onChange',
    defaultValues: { subdomain: '' },
  });

  const rawValue = useWatch({ control, name: 'subdomain' }) ?? '';
  const debouncedRaw = useDebouncedValue(rawValue, 400);
  const parsed = associationCodeSchema.safeParse({ subdomain: debouncedRaw });
  const normalizedSubdomain = parsed.success ? parsed.data.subdomain : null;

  const lookup = useCheckSubdomain(normalizedSubdomain ?? '', !!normalizedSubdomain);
  const recent = useTenantStore((state) => state.recent);
  const setCurrentTenant = useTenantStore((state) => state.setCurrent);

  function proceed(tenant: TenantSummary) {
    setCurrentTenant(tenant);
    router.push('/(auth)/login');
  }

  return (
    <Screen edges={['top']} keyboard>
      <Stack.Screen options={{ title: t('auth.association.title') }} />
      <AuthBrandMark />
      <ScreenHeader title={t('auth.association.title')} large onBack={() => router.back()} />
      <View className="gap-4">
        <TextField
          control={control}
          name="subdomain"
          label={t('auth.association.label')}
          helper={t('auth.association.helper')}
          autoCapitalize="none"
          returnKeyType="done"
          testID="association-code-input"
        />
        {lookup.isFetching ? <Spinner /> : null}
        {lookup.isError ? (
          <Text variant="caption" tone="danger">
            {lookupErrorMessage(lookup.error)}
          </Text>
        ) : null}
        {lookup.isSuccess ? <AssociationConfirmationCard tenant={lookup.data} onContinue={() => proceed(lookup.data)} /> : null}
      </View>
      <View className="mt-6">
        <RecentAssociationsList items={recent} onSelect={proceed} />
      </View>
    </Screen>
  );
}
