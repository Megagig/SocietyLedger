import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { positionOf } from '@/features/financeSetup/components/GroupedRow';
import { PagedList } from '@/features/financeSetup/components/PagedList';
import { UserRow } from '@/features/rbac/components/Rows';
import { ROLES_VIEW_ACCESS } from '@/features/rbac/labels';
import { useUsersInfinite } from '@/features/rbac/queries';
import { useCan } from '@/hooks/useCan';
import type { UserWithRolesDTO } from '@/types/api/rbac';

/** project-overview.md §6.9 ST7 — people who can sign in, with the roles they hold. Tap one to give or take a role. */
export default function UsersScreen() {
  const router = useRouter();
  const allowed = useCan(ROLES_VIEW_ACCESS);
  const [search, setSearch] = useState('');
  const query = useUsersInfinite(search.trim());
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.users) ?? [], [query.data]);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Users" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll={false}>
      <ScreenHeader title="Users" onBack={back} docsKey="ST7" />
      <View className="pb-3">
        <SearchField value={search} onChangeText={setSearch} placeholder="Search by name or email" testID="users-search" />
      </View>
      <PagedList
        query={query}
        items={items}
        keyOf={(u) => String(u.id)}
        skeletonHeight={76}
        renderItem={(u: UserWithRolesDTO, i, n) => (
          <UserRow
            item={u}
            position={positionOf(i, n)}
            onPress={(item) => router.push({ pathname: '/(app)/(tabs)/manage/settings/user-roles', params: { userId: String(item.id), email: item.email } } as never)}
          />
        )}
        empty={
          <EmptyState
            icon={Users}
            title={search.trim() ? 'No one found' : 'No users yet'}
            description={search.trim() ? 'Try a different name or email.' : 'People appear here once they can sign in.'}
          />
        }
      />
    </Screen>
  );
}
