import { useRouter } from 'expo-router';
import { Plus, ShieldCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { RoleRow } from '@/features/rbac/components/Rows';
import { ROLES_CREATE_ACCESS, ROLES_VIEW_ACCESS } from '@/features/rbac/labels';
import { useRoles } from '@/features/rbac/queries';
import { useCan } from '@/hooks/useCan';

/** project-overview.md §6.9 ST8 — the roles this association has, what each can do and how many people hold it. */
export default function RolesScreen() {
  const router = useRouter();
  const allowed = useCan(ROLES_VIEW_ACCESS);
  const canCreate = useCan(ROLES_CREATE_ACCESS);
  const query = useRoles();
  const back = () => router.back();
  const roles = query.data?.roles ?? [];

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Roles and permissions" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ScreenHeader
        title="Roles and permissions"
        onBack={back}
        docsKey="ST8"
        rightActions={canCreate ? <IconButton icon={Plus} accessibilityLabel="Add a role" onPress={() => router.push('/(app)/(tabs)/manage/settings/roles/form' as never)} testID="roles-new" /> : undefined}
      />

      {query.isPending ? (
        <View className="gap-3">
          <Skeleton width="100%" height={68} radius="md" />
          <Skeleton width="100%" height={68} radius="md" />
          <Skeleton width="100%" height={68} radius="md" />
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : roles.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No roles yet" description="Roles decide what each person can do." />
      ) : (
        <View className="gap-4 pb-6">
          <Text variant="caption" tone="secondary">
            A role is a set of permissions. Give a person a role from the Users screen.
          </Text>
          <View>
            {roles.map((role, i) => (
              <RoleRow key={role.id} item={role} position={positionOf(i, roles.length)} onPress={(r) => router.push({ pathname: '/(app)/(tabs)/manage/settings/roles/[id]', params: { id: String(r.id) } } as never)} />
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}
