import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PermissionEditor } from '@/features/rbac/components/PermissionEditor';
import { isRoleEditable, peopleLabel, permissionCountLabel, ROLES_EDIT_ACCESS, ROLES_VIEW_ACCESS, roleKindLabel, sameKeys } from '@/features/rbac/labels';
import { useDeleteRole, useUpdateRole } from '@/features/rbac/mutations';
import { usePermissions, useRoles } from '@/features/rbac/queries';
import { useCan } from '@/hooks/useCan';
import { useSessionStore } from '@/stores/session';
import type { PermissionDTO, RoleDTO } from '@/types/api/rbac';

/** project-overview.md §6.9 ST8 — one role: its permissions grouped by part of the app, switched on or off. */
export default function RoleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roleId = Number(id);
  const allowed = useCan(ROLES_VIEW_ACCESS);
  const roles = useRoles();
  const permissions = usePermissions();
  const back = () => router.back();
  const role = roles.data?.roles.find((r) => r.id === roleId);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Role" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (roles.isPending || permissions.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Role" onBack={back} docsKey="ST8" />
        <View className="gap-3">
          <Skeleton width="100%" height={64} radius="md" />
          <Skeleton width="100%" height={200} radius="md" />
        </View>
      </Screen>
    );
  }
  if (roles.isError || permissions.isError || !role || !permissions.data) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Role" onBack={back} docsKey="ST8" />
        <ErrorState
          error={roles.error ?? permissions.error}
          title={roles.isError || permissions.isError ? undefined : 'We could not find this role'}
          onRetry={() => {
            void roles.refetch();
            void permissions.refetch();
          }}
        />
      </Screen>
    );
  }
  return <RoleDetail role={role} permissions={permissions.data.permissions} />;
}

function RoleDetail({ role, permissions }: { role: RoleDTO; permissions: PermissionDTO[] }) {
  const router = useRouter();
  const canEdit = useCan(ROLES_EDIT_ACCESS);
  const held = useSessionStore((s) => s.user?.permissions ?? []);
  const update = useUpdateRole(role.id);
  const remove = useDeleteRole(role.id);
  const deleteRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role.permissions));
  const [displayName, setDisplayName] = useState(role.displayName);
  const [description, setDescription] = useState(role.description ?? '');
  const original = new Set(role.permissions);

  const editable = isRoleEditable(role, canEdit);
  const canRename = canEdit && !role.isSystemRole;
  const permsChanged = !sameKeys([...selected], role.permissions);
  const nameChanged = canRename && (displayName.trim() !== role.displayName || description.trim() !== (role.description ?? ''));
  const nameInvalid = canRename && displayName.trim().length < 2;
  const canDelete = canEdit && !role.isSystemRole && role.userCount === 0;

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const toggleMany = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  const save = () =>
    update.mutate(
      {
        ...(permsChanged ? { permissions: [...selected] } : {}),
        ...(nameChanged ? { displayName: displayName.trim(), description: description.trim() === '' ? null : description.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Role saved');
          router.back();
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not save the role. Try again.'),
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title={role.displayName} onBack={() => router.back()} docsKey="ST8" />

      <View className="gap-6 pb-6">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text variant="caption" tone="secondary">
              {peopleLabel(role.userCount)} · {permissionCountLabel(selected.size)}
            </Text>
            <Badge tone={role.isSystemRole ? 'primary' : 'neutral'}>{roleKindLabel(role)}</Badge>
          </View>
          {role.name === 'admin' ? (
            <Text variant="caption" tone="secondary" testID="admin-locked-note">
              The Administrator role always keeps all of its permissions.
            </Text>
          ) : null}
        </View>

        {canRename ? (
          <Section title="Name">
            <View className="gap-3">
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Role name"
                accessibilityLabel="Role name"
                maxLength={60}
                className="h-[52px] rounded-md border border-border-strong bg-surface-sunken px-4 font-sans text-body text-text"
                testID="role-display-name"
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What is it for? (optional)"
                accessibilityLabel="Description"
                maxLength={200}
                multiline
                className="min-h-[52px] rounded-md border border-border-strong bg-surface-sunken px-4 py-3 font-sans text-body text-text"
                testID="role-description-input"
              />
            </View>
          </Section>
        ) : role.description ? (
          <Text variant="body" tone="secondary">
            {role.description}
          </Text>
        ) : null}

        <Section title="What it can do">
          <PermissionEditor permissions={permissions} selected={selected} original={original} held={held} readOnly={!editable} onToggle={toggle} onToggleMany={toggleMany} />
        </Section>

        {canDelete ? (
          <Button variant="danger-ghost" fullWidth loading={remove.isPending} onPress={() => deleteRef.current?.present()} testID="role-delete">
            Delete role
          </Button>
        ) : null}
      </View>

      {editable || canRename ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth loading={update.isPending} disabled={(!permsChanged && !nameChanged) || nameInvalid} onPress={save} testID="role-save">
              Save changes
            </Button>
          </View>
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={deleteRef}
        title="Delete this role?"
        description="The role is removed for good. Nobody holds it, so no one loses access."
        confirmLabel="Delete role"
        onConfirm={() => {
          deleteRef.current?.dismiss();
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.success('Role deleted');
              router.back();
            },
            onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not delete the role. Try again.'),
          });
        }}
      />
    </Screen>
  );
}
