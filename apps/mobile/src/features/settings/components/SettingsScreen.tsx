import type { UseQueryResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * The frame every settings screen shares: the header, the permission check, a skeleton while the current values load, and a
 * retry when they cannot. `children` is rendered only once the values are here, so a form can start from them.
 */
export function SettingsScreen<T>({
  title,
  docsKey,
  allowed,
  query,
  children,
}: {
  title: string;
  docsKey?: string;
  allowed: boolean;
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  const router = useRouter();
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={title} onBack={back} docsKey={docsKey} />
        <View className="gap-4">
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
          <Skeleton width="100%" height={52} radius="md" />
        </View>
      </Screen>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title={title} onBack={back} docsKey={docsKey} />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  return <>{children(query.data)}</>;
}
