import { memo } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type { AuditLogDTO, RoleDTO, UserWithRolesDTO } from '@/types/api/rbac';
import { actionLabel, actorName, areaLabel, peopleLabel, permissionCountLabel, platformRoleLabel, roleKindLabel } from '../labels';

/** A person with a login: their name, email and the roles they hold as chips. */
function UserRowBase({ item, position, onPress }: { item: UserWithRolesDTO; position: RowPosition; onPress?: (item: UserWithRolesDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`${item.name}, ${item.roles.map((r) => r.displayName).join(', ') || 'no role'}`} testID={`user-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={76}>
      <View className="flex-row items-center gap-3">
        <Avatar name={item.name} size={40} colorSeed={item.id} />
        <View className="flex-1 gap-1">
          <Text variant="body-lg" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {item.email}
            {item.memberId ? ` · ${item.memberId}` : ''}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Joined {formatDate(item.createdAt)}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {item.platformRole ? <Badge tone="danger">{platformRoleLabel(item.platformRole)}</Badge> : null}
            {item.roles.length === 0 && !item.platformRole ? (
              <Badge tone="neutral">No role</Badge>
            ) : (
              item.roles.map((r) => (
                <Badge key={r.id} tone={r.isSystemRole ? 'primary' : 'neutral'}>
                  {r.displayName}
                </Badge>
              ))
            )}
          </View>
        </View>
      </View>
    </GroupedRow>
  );
}
export const UserRow = memo(UserRowBase);

/** A role: its name, how many people hold it and how much it can do. */
function RoleRowBase({ item, position, onPress }: { item: RoleDTO; position: RowPosition; onPress?: (item: RoleDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={item.displayName} testID={`role-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={68}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {peopleLabel(item.userCount)} · {permissionCountLabel(item.permissions.length)}
          </Text>
        </View>
        <Badge tone={item.isSystemRole ? 'primary' : 'neutral'}>{roleKindLabel(item)}</Badge>
      </View>
    </GroupedRow>
  );
}
export const RoleRow = memo(RoleRowBase);

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

/** One thing that happened: what, who did it, in which part of the app, and when. */
function AuditRowBase({ item, position, onPress }: { item: AuditLogDTO; position: RowPosition; onPress?: (item: AuditLogDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`${actionLabel(item.action)} by ${actorName(item)}`} testID={`audit-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={72}>
      <View className="gap-0.5">
        <Text variant="body-lg" numberOfLines={1}>
          {actionLabel(item.action)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {actorName(item)} · {areaLabel(item.tableName)}
          {item.recordId ? ` · #${item.recordId}` : ''}
        </Text>
        <Text variant="caption" tone="secondary">
          {when(item.createdAt)}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const AuditRow = memo(AuditRowBase);
