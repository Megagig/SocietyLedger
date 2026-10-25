import { Prisma, type PlatformRole } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RBACService } from '../../services/rbac.service';
import { SettingsService } from '../settings/settings.service';
import {
  ADMIN_ROLE_NAME,
  RbacRuleError,
  SYSTEM_ROLE_NAMES,
  assertCanGrant,
  assertNotOwnRole,
  assignmentSchema,
  createRoleSchema,
  lastAdminMessage,
  normaliseRoleName,
  parseRbacBody,
  updateRoleSchema,
} from './rbac-rules';

export type Actor = { id: number; associationId: number; platformRole: PlatformRole | null };

const roleWithPermissions = { permissions: { include: { permission: true } } } as const;

async function heldBy(actor: Actor): Promise<ReadonlySet<string>> {
  const resolved = await RBACService.resolveUserPermissions({ userId: actor.id, associationId: actor.associationId, platformRole: actor.platformRole });
  return resolved.permissions;
}

/** Every key must be a real, active permission. */
async function permissionsByKey(keys: string[]) {
  if (keys.length === 0) return [];
  const found = await prisma.permission.findMany({ where: { key: { in: keys }, isActive: true } });
  const unknown = keys.filter((k) => !found.some((p) => p.key === k));
  if (unknown.length > 0) throw new RbacRuleError(`These are not permissions: ${unknown.slice(0, 5).join(', ')}.`, 400, 'UNKNOWN_PERMISSION');
  return found;
}

/** Two people changing the administrators at once must not both pass the "someone else is still an Administrator" check. */
async function lockAssociation(tx: Prisma.TransactionClient, associationId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM associations WHERE id = ${associationId} FOR UPDATE`;
}

/** Active Administrators other than this person. */
function otherAdminCount(tx: Prisma.TransactionClient, associationId: number, exceptUserId: number): Promise<number> {
  return tx.userRole.count({
    where: { associationId, isActive: true, userId: { not: exceptUserId }, user: { isActive: true }, role: { name: ADMIN_ROLE_NAME, associationId } },
  });
}

function clearCaches(userIds: number[], associationId: number): void {
  userIds.forEach((id) => RBACService.clearUserCache(id, associationId));
}

export async function createRole(actor: Actor, body: unknown) {
  const input = parseRbacBody(createRoleSchema, body);
  const name = normaliseRoleName(input.name);
  if (name.length < 2) throw new RbacRuleError('Use letters or numbers in the role name.', 400, 'INVALID_ROLE');
  if ((SYSTEM_ROLE_NAMES as readonly string[]).includes(name)) {
    throw new RbacRuleError('That name belongs to a built-in role. Choose another.', 400, 'ROLE_NAME_RESERVED');
  }
  if (await prisma.role.findUnique({ where: { associationId_name: { associationId: actor.associationId, name } } })) {
    throw new RbacRuleError('A role with this name already exists.', 409, 'ROLE_EXISTS');
  }

  const permissions = await permissionsByKey(input.permissions);
  assertCanGrant(await heldBy(actor), input.permissions);

  try {
    return await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          associationId: actor.associationId,
          name,
          displayName: input.displayName ?? input.name,
          description: input.description ?? null,
          isSystemRole: false,
          permissions: { create: permissions.map((p) => ({ permissionId: p.id })) },
        },
        include: roleWithPermissions,
      });
      await tx.auditLog.create({
        data: {
          associationId: actor.associationId,
          userId: actor.id,
          action: 'ROLE_CREATED',
          tableName: 'roles',
          recordId: role.id,
          newValues: { name, displayName: role.displayName, permissions: input.permissions },
        },
      });
      return role;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new RbacRuleError('A role with this name already exists.', 409, 'ROLE_EXISTS');
    }
    throw error;
  }
}

export async function updateRole(actor: Actor, roleId: number, body: unknown) {
  const input = parseRbacBody(updateRoleSchema, body);
  const role = await prisma.role.findFirst({ where: { id: roleId, associationId: actor.associationId }, include: roleWithPermissions });
  if (!role) throw new RbacRuleError('Role not found.', 404, 'ROLE_NOT_FOUND');

  const renamed = input.displayName !== undefined && input.displayName !== role.displayName;
  const redescribed = input.description !== undefined && (input.description ?? '') !== (role.description ?? '');
  if (role.isSystemRole && (renamed || redescribed)) {
    throw new RbacRuleError('A built-in role keeps its name and description.', 400, 'SYSTEM_ROLE_LOCKED');
  }
  if (role.name === ADMIN_ROLE_NAME && input.permissions !== undefined) {
    throw new RbacRuleError('The Administrator role always keeps all of its permissions.', 403, 'ADMIN_ROLE_LOCKED');
  }

  const before = role.permissions.map((rp) => rp.permission.key);
  let wanted: { id: number; key: string }[] | undefined;
  if (input.permissions !== undefined) {
    wanted = await permissionsByKey(input.permissions);
    // Taking permissions away is always allowed; giving one needs you to hold it.
    assertCanGrant(await heldBy(actor), input.permissions.filter((k) => !before.includes(k)));
  }

  const affected = await prisma.userRole.findMany({ where: { roleId: role.id }, select: { userId: true } });

  const updated = await prisma.$transaction(async (tx) => {
    if (!role.isSystemRole) {
      await tx.role.update({
        where: { id: role.id },
        data: { displayName: input.displayName ?? role.displayName, description: input.description !== undefined ? input.description : role.description },
      });
    }
    if (wanted) {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({ data: wanted.map((p) => ({ roleId: role.id, permissionId: p.id })) });
    }
    await tx.auditLog.create({
      data: {
        associationId: actor.associationId,
        userId: actor.id,
        action: 'ROLE_UPDATED',
        tableName: 'roles',
        recordId: role.id,
        oldValues: { displayName: role.displayName, description: role.description, permissions: before },
        newValues: { displayName: input.displayName, description: input.description, permissions: input.permissions },
      },
    });
    return tx.role.findUnique({ where: { id: role.id }, include: roleWithPermissions });
  });

  clearCaches(affected.map((a) => a.userId), actor.associationId);
  return updated;
}

export async function assignRole(actor: Actor, body: unknown) {
  const { userId, roleId } = parseRbacBody(assignmentSchema, body);
  assertNotOwnRole(actor.id, userId);

  const role = await prisma.role.findFirst({ where: { id: roleId, associationId: actor.associationId, isActive: true }, include: roleWithPermissions });
  if (!role) throw new RbacRuleError('Role not found.', 404, 'ROLE_NOT_FOUND');
  assertCanGrant(await heldBy(actor), role.permissions.map((rp) => rp.permission.key));
  const allowMultiple = await SettingsService.getSetting(actor.associationId, 'members_access', 'allowMultipleRoles');

  const userRole = await prisma.$transaction(async (tx) => {
    await lockAssociation(tx, actor.associationId);
    const user = await tx.user.findFirst({ where: { id: userId, associationId: actor.associationId } });
    if (!user) throw new RbacRuleError('That person is not in this association.', 404, 'USER_NOT_FOUND');
    if (!user.isActive) throw new RbacRuleError('Approve this person before giving them a role.', 400, 'USER_INACTIVE');

    if (!allowMultiple) {
      const retiring = await tx.userRole.findMany({
        where: { userId, associationId: actor.associationId, isActive: true, roleId: { not: roleId } },
        include: { role: { select: { name: true } } },
      });
      if (retiring.some((r) => r.role.name === ADMIN_ROLE_NAME) && role.name !== ADMIN_ROLE_NAME && (await otherAdminCount(tx, actor.associationId, userId)) === 0) {
        throw new RbacRuleError(lastAdminMessage, 409, 'LAST_ADMIN');
      }
      if (retiring.length > 0) {
        await tx.userRole.updateMany({ where: { id: { in: retiring.map((r) => r.id) } }, data: { isActive: false } });
      }
    }

    const saved = await tx.userRole.upsert({
      where: { userId_roleId_associationId: { userId, roleId, associationId: actor.associationId } },
      update: { isActive: true, assignedBy: actor.id, assignedAt: new Date() },
      create: { userId, roleId, associationId: actor.associationId, assignedBy: actor.id, isActive: true },
    });
    // The older single-role field is kept in step for the code that still reads it.
    await tx.user.update({ where: { id: userId }, data: { role: role.name } });
    await tx.auditLog.create({
      data: { associationId: actor.associationId, userId: actor.id, action: 'ROLE_ASSIGNED', tableName: 'user_roles', recordId: saved.id, newValues: { userId, roleId, roleName: role.name } },
    });
    return saved;
  });

  clearCaches([userId], actor.associationId);
  return userRole;
}

export async function removeRole(actor: Actor, body: unknown) {
  const { userId, roleId } = parseRbacBody(assignmentSchema, body);
  assertNotOwnRole(actor.id, userId);

  await prisma.$transaction(async (tx) => {
    await lockAssociation(tx, actor.associationId);
    const userRole = await tx.userRole.findUnique({
      where: { userId_roleId_associationId: { userId, roleId, associationId: actor.associationId } },
      include: { role: { select: { name: true } } },
    });
    if (!userRole || !userRole.isActive) throw new RbacRuleError('That person does not have this role.', 404, 'NOT_ASSIGNED');

    if (userRole.role.name === ADMIN_ROLE_NAME && (await otherAdminCount(tx, actor.associationId, userId)) === 0) {
      throw new RbacRuleError(lastAdminMessage, 409, 'LAST_ADMIN');
    }

    // Deactivated, not deleted, so the history stays
    await tx.userRole.update({ where: { id: userRole.id }, data: { isActive: false } });

    const remaining = await tx.userRole.findMany({
      where: { userId, associationId: actor.associationId, isActive: true },
      include: { role: { select: { name: true } } },
    });
    let legacy = remaining[0]?.role.name;
    if (!legacy) {
      // Someone with no role at all could not even see their own account, so they go back to being an ordinary member.
      const member = await tx.role.findFirst({ where: { associationId: actor.associationId, name: 'member' } });
      if (member) {
        await tx.userRole.upsert({
          where: { userId_roleId_associationId: { userId, roleId: member.id, associationId: actor.associationId } },
          update: { isActive: true, assignedBy: actor.id, assignedAt: new Date() },
          create: { userId, roleId: member.id, associationId: actor.associationId, assignedBy: actor.id, isActive: true },
        });
      }
      legacy = 'member';
    }
    await tx.user.update({ where: { id: userId }, data: { role: legacy } });
    await tx.auditLog.create({
      data: { associationId: actor.associationId, userId: actor.id, action: 'ROLE_REMOVED', tableName: 'user_roles', recordId: userRole.id, oldValues: { userId, roleId, roleName: userRole.role.name } },
    });
  });

  clearCaches([userId], actor.associationId);
}
