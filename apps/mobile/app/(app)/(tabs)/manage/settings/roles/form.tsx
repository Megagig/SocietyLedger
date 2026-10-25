import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { NoPermission } from '@/components/feedback/NoPermission';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { PermissionEditor } from '@/features/rbac/components/PermissionEditor';
import { permissionCountLabel, ROLES_CREATE_ACCESS } from '@/features/rbac/labels';
import { useCreateRole } from '@/features/rbac/mutations';
import { usePermissions } from '@/features/rbac/queries';
import { useCan } from '@/hooks/useCan';
import { useSessionStore } from '@/stores/session';

const roleSchema = z.object({
  name: z.string().trim().min(2, 'The role name needs at least 2 characters').max(40, 'The role name can be 40 characters at most'),
  description: z.string().trim().max(200, 'Use 200 characters or fewer'),
});
type RoleFormValues = z.infer<typeof roleSchema>;

const NO_KEYS: ReadonlySet<string> = new Set();

/** project-overview.md §6.9 ST8 — a new custom role: its name, what it is for and what it can do, as on the website (at least one permission). */
export default function NewRoleScreen() {
  const router = useRouter();
  const allowed = useCan(ROLES_CREATE_ACCESS);
  const create = useCreateRole();
  const permissions = usePermissions();
  const held = useSessionStore((s) => s.user?.permissions ?? []);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const { control, handleSubmit } = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema), defaultValues: { name: '', description: '' }, mode: 'onTouched' });
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Add a role" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

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

  const submit = (values: RoleFormValues) =>
    create.mutate(
      { name: values.name, displayName: values.name.trim(), description: values.description.trim() === '' ? null : values.description.trim(), permissions: [...selected] },
      {
        onSuccess: (role) => {
          toast.success('Role added');
          router.replace({ pathname: '/(app)/(tabs)/manage/settings/roles/[id]', params: { id: String(role.id) } } as never);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Could not add the role. Try again.'),
      },
    );

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <ScreenHeader title="Add a role" onBack={back} docsKey="ST8" />

      <View className="gap-6 pb-6">
        <Section title="The role">
          <View className="gap-4">
            <TextField control={control} name="name" label="Name" placeholder="Fund raiser" autoCapitalize="words" testID="role-name" />
            <TextField control={control} name="description" label="What is it for? (optional)" autoCapitalize="sentences" multiline testID="role-description" />
          </View>
        </Section>

        <Section title="What it can do">
          <View className="gap-3">
            {permissions.isPending ? (
              <Skeleton width="100%" height={52} />
            ) : permissions.isError || !permissions.data ? (
              <Text variant="body" tone="secondary">
                We could not load the permissions. Go back and try again.
              </Text>
            ) : (
              <PermissionEditor permissions={permissions.data.permissions} selected={selected} original={NO_KEYS} held={held} readOnly={false} onToggle={toggle} onToggleMany={toggleMany} />
            )}
            <Text variant="caption" tone="secondary">
              {permissionCountLabel(selected.size)} chosen. Choose at least one. You can only give a role permissions you hold yourself.
            </Text>
          </View>
        </Section>
      </View>

      <StickyFooter>
        <View className="flex-1">
          <Button
            variant="primary"
            fullWidth
            loading={create.isPending}
            disabled={selected.size === 0}
            onPress={() => {
              void handleSubmit(submit)();
            }}
            testID="role-create"
          >
            Add role
          </Button>
        </View>
      </StickyFooter>
    </Screen>
  );
}
