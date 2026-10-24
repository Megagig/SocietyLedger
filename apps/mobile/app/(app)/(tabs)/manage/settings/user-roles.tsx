import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { canGrantPermission, ROLES_ASSIGN_ACCESS, ROLES_VIEW_ACCESS } from '@/features/rbac/labels';
import { useAssignRole, useRemoveRole } from '@/features/rbac/mutations';
import { useRoles, useUsersInfinite } from '@/features/rbac/queries';
import { useCan } from '@/hooks/useCan';
import { useSessionStore } from '@/stores/session';
import type { RoleDTO } from '@/types/api/rbac';

type Pending = { kind: 'give' | 'remove'; role: RoleDTO };

/** project-overview.md §6.9 ST8 — the roles one person holds: take one away, or give another. Nobody changes their own. */
export default function UserRolesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; email?: string }>();
  const userId = Number(params.userId);
  const canView = useCan(ROLES_VIEW_ACCESS);
  const canAssign = useCan(ROLES_ASSIGN_ACCESS);
  const me = useSessionStore((s) => s.user);
  const held = me?.permissions ?? [];
  // The list is searched by the person's email, so this screen reads the same fresh data the list does and updates after a change.
  const usersQuery = useUsersInfinite(params.email ?? '');
  const rolesQuery = useRoles();
  const give = useAssignRole();
  const take = useRemoveRole();
  const [pending, setPending] = useState<Pending | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  const person = useMemo(() => usersQuery.data?.pages.flatMap((p) => p.users).find((u) => u.id === userId), [usersQuery.data, userId]);
  const isSelf = me?.id === userId;
  const heldIds = new Set(person?.roles.map((r) => r.id) ?? []);
  // Only roles the person doing this could hold themselves are offered; the server checks the same.
  const available = (rolesQuery.data?.roles ?? []).filter((r) => !heldIds.has(r.id) && r.permissions.every((k) => canGrantPermission(held, k)));

  useEffect(() => {
    if (pending) sheetRef.current?.present();
  }, [pending]);

  if (!canView || !Number.isInteger(userId)) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Roles" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  if (usersQuery.isPending || rolesQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Roles" onBack={back} docsKey="ST8" />
        <View className="gap-4">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={140} radius="md" />
        </View>
      </Screen>
    );
  }

  if (usersQuery.isError || rolesQuery.isError || !person) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Roles" onBack={back} docsKey="ST8" />
        <ErrorState
          error={usersQuery.error ?? rolesQuery.error}
          title={usersQuery.isError || rolesQuery.isError ? undefined : 'We could not find this person'}
          onRetry={() => {
            void usersQuery.refetch();
            void rolesQuery.refetch();
          }}
        />
      </Screen>
    );
  }

  const confirm = () => {
    if (!pending) return;
    const { kind, role } = pending;
    sheetRef.current?.dismiss();
    setPending(null);
    const run = kind === 'give' ? give : take;
    run.mutate(
      { userId, roleId: role.id },
      {
        onSuccess: () => toast.success(kind === 'give' ? `${role.displayName} given to ${person.name}` : `${role.displayName} removed from ${person.name}`),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not change the role. Try again.'),
      },
    );
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={person.name} onBack={back} docsKey="ST8" />

      <View className="gap-6 pb-6">
        <View className="flex-row items-center gap-3">
          <Avatar name={person.name} size={64} colorSeed={person.id} />
          <View className="flex-1 gap-0.5">
            <Text variant="h3" numberOfLines={1}>
              {person.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {person.email}
            </Text>
          </View>
        </View>

        {isSelf ? (
          <Text variant="caption" tone="secondary" testID="own-roles-note">
            You cannot change your own roles. Ask another Administrator.
          </Text>
        ) : null}

        <Section title="Roles they hold">
          {person.roles.length === 0 ? (
            <Text variant="body" tone="secondary">
              No role yet.
            </Text>
          ) : (
            <ListGroup>
              {person.roles.map((r) => {
                const full = rolesQuery.data?.roles.find((x) => x.id === r.id);
                return (
                  <ListItem
                    key={r.id}
                    title={r.displayName}
                    meta={r.isSystemRole ? 'Built in' : 'Custom role'}
                    trailing={
                      canAssign && !isSelf && full ? (
                        <Button variant="danger-ghost" size="sm" onPress={() => setPending({ kind: 'remove', role: full })} testID={`remove-role-${r.id}`}>
                          Remove
                        </Button>
                      ) : r.name === 'admin' ? (
                        <Badge tone="primary">Administrator</Badge>
                      ) : undefined
                    }
                  />
                );
              })}
            </ListGroup>
          )}
        </Section>

        {canAssign && !isSelf ? (
          <Section title="Give a role">
            {available.length === 0 ? (
              <Text variant="body" tone="secondary">
                There is no other role you can give.
              </Text>
            ) : (
              <ListGroup>
                {available.map((r) => (
                  <ListItem key={r.id} title={r.displayName} meta={r.description ?? (r.isSystemRole ? 'Built in' : 'Custom role')} showChevron onPress={() => setPending({ kind: 'give', role: r })} testID={`give-role-${r.id}`} />
                ))}
              </ListGroup>
            )}
          </Section>
        ) : null}
      </View>

      <ConfirmSheet
        ref={sheetRef}
        title={pending?.kind === 'remove' ? `Remove ${pending.role.displayName}?` : `Give ${pending?.role.displayName ?? 'this role'}?`}
        description={
          pending?.kind === 'remove'
            ? `${person.name} loses what this role lets them do. If it was their only role, they become an ordinary member.`
            : `${person.name} can do everything this role allows. If the association allows one role each, their current role is replaced.`
        }
        confirmLabel={pending?.kind === 'remove' ? 'Remove role' : 'Give role'}
        destructive={pending?.kind === 'remove'}
        onConfirm={confirm}
        onDismiss={() => setPending(null)}
      />
    </Screen>
  );
}
