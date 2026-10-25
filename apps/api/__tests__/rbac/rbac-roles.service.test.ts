/** Creating, editing, giving and taking roles: the checks that stop a role being a way to gain power or lock everyone out. */
const tx: any = {
  $queryRaw: jest.fn(),
  role: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
  rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
  userRole: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), updateMany: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  user: { findFirst: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
};
const prismaMock: any = {
  role: { findUnique: jest.fn(), findFirst: jest.fn() },
  permission: { findMany: jest.fn() },
  userRole: { findMany: jest.fn() },
  $transaction: jest.fn((run: (client: unknown) => unknown) => run(tx)),
};
jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: prismaMock, prisma: prismaMock }));
const mockHeld = jest.fn();
const mockClear = jest.fn();
jest.mock('../../src/services/rbac.service', () => ({
  RBACService: { resolveUserPermissions: (...a: unknown[]) => mockHeld(...a), clearUserCache: (...a: unknown[]) => mockClear(...a) },
}));
const mockSetting = jest.fn();
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSetting: (...a: unknown[]) => mockSetting(...a) } }));

import { assignRole, createRole, removeRole, updateRole } from '../../src/modules/rbac/rbac-roles.service';
import { RuleError } from '../../src/modules/finance/rule-error';

const actor = { id: 1, associationId: 7, platformRole: null };
const perm = (key: string, id = 1) => ({ id, key, isActive: true });
const roleRow = (over: Record<string, unknown> = {}) => ({
  id: 20, associationId: 7, name: 'treasurer', displayName: 'Treasurer', description: null, isSystemRole: false, isActive: true,
  permissions: [{ permission: perm('members.view') }], ...over,
});

async function code(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error) {
    if (error instanceof RuleError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeld.mockResolvedValue({ permissions: new Set(['members.view', 'roles.assign', 'settings.edit']), roles: ['admin'], isSuper: false });
  mockSetting.mockResolvedValue(false);
  prismaMock.role.findUnique.mockResolvedValue(null);
  prismaMock.permission.findMany.mockImplementation(({ where }: any) => Promise.resolve((where.key.in as string[]).map((key, i) => perm(key, i + 1))));
  prismaMock.userRole.findMany.mockResolvedValue([]);
  tx.role.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 99, displayName: data.displayName, ...data }));
  tx.role.findUnique.mockResolvedValue(roleRow());
  tx.userRole.findMany.mockResolvedValue([]);
  tx.userRole.count.mockResolvedValue(1);
  tx.userRole.upsert.mockResolvedValue({ id: 5 });
  tx.user.findFirst.mockResolvedValue({ id: 9, isActive: true });
});

describe('createRole', () => {
  it('creates a role with the permissions given, and writes the audit entry with it', async () => {
    await createRole(actor, { name: 'Fund Raiser', permissions: ['members.view'] });
    expect(tx.role.create.mock.calls[0][0].data).toMatchObject({ associationId: 7, name: 'fund_raiser', displayName: 'Fund Raiser', isSystemRole: false });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'ROLE_CREATED', userId: 1 });
  });

  it('refuses a built-in name, however it is written', async () => {
    expect(await code(createRole(actor, { name: 'Admin' }))).toBe('ROLE_NAME_RESERVED');
    expect(await code(createRole(actor, { name: 'Financial Secretary' }))).toBe('ROLE_NAME_RESERVED');
  });

  it('refuses a name already in use, comparing the cleaned-up name', async () => {
    prismaMock.role.findUnique.mockResolvedValue({ id: 3 });
    expect(await code(createRole(actor, { name: 'Fund  Raiser' }))).toBe('ROLE_EXISTS');
    expect(prismaMock.role.findUnique.mock.calls[0][0].where.associationId_name).toEqual({ associationId: 7, name: 'fund_raiser' });
  });

  it('refuses to give a role a permission the creator does not hold', async () => {
    expect(await code(createRole(actor, { name: 'Sneaky', permissions: ['payments.delete'] }))).toBe('CANNOT_GRANT');
    expect(tx.role.create).not.toHaveBeenCalled();
  });

  it('refuses a permission that does not exist', async () => {
    prismaMock.permission.findMany.mockResolvedValue([]);
    expect(await code(createRole(actor, { name: 'Odd', permissions: ['made.up'] }))).toBe('UNKNOWN_PERMISSION');
  });

  it('answers a missing name with a plain refusal, not a crash', async () => {
    expect(await code(createRole(actor, {}))).toBe('INVALID_ROLE');
  });
});

describe('updateRole', () => {
  beforeEach(() => prismaMock.role.findFirst.mockResolvedValue(roleRow()));

  it('looks only in the caller\'s own association', async () => {
    await updateRole(actor, 20, { displayName: 'Chief Treasurer' });
    expect(prismaMock.role.findFirst.mock.calls[0][0].where).toEqual({ id: 20, associationId: 7 });
  });

  it('never lets the Administrator role lose permissions', async () => {
    prismaMock.role.findFirst.mockResolvedValue(roleRow({ name: 'admin', isSystemRole: true }));
    expect(await code(updateRole(actor, 20, { permissions: [] }))).toBe('ADMIN_ROLE_LOCKED');
  });

  it('keeps a built-in role\'s name and description, but accepts the same values sent back', async () => {
    prismaMock.role.findFirst.mockResolvedValue(roleRow({ isSystemRole: true, description: null }));
    expect(await code(updateRole(actor, 20, { displayName: 'Boss' }))).toBe('SYSTEM_ROLE_LOCKED');
    expect(await code(updateRole(actor, 20, { displayName: 'Treasurer', description: '' }))).toBe('NO_ERROR');
  });

  it('refuses to add a permission the editor does not hold, but allows taking one away', async () => {
    expect(await code(updateRole(actor, 20, { permissions: ['members.view', 'payments.delete'] }))).toBe('CANNOT_GRANT');
    expect(await code(updateRole(actor, 20, { permissions: [] }))).toBe('NO_ERROR');
  });

  it('keeps a permission the role already has even if the editor does not hold it', async () => {
    prismaMock.role.findFirst.mockResolvedValue(roleRow({ permissions: [{ permission: perm('cash.verify') }] }));
    expect(await code(updateRole(actor, 20, { permissions: ['cash.verify'] }))).toBe('NO_ERROR');
  });

  it('clears the permissions people with the role have cached', async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ userId: 31 }, { userId: 32 }]);
    await updateRole(actor, 20, { permissions: ['members.view'] });
    expect(mockClear).toHaveBeenCalledWith(31, 7);
    expect(mockClear).toHaveBeenCalledWith(32, 7);
  });
});

describe('assignRole', () => {
  beforeEach(() => prismaMock.role.findFirst.mockResolvedValue(roleRow()));

  it('never changes your own roles', async () => {
    expect(await code(assignRole(actor, { userId: 1, roleId: 20 }))).toBe('OWN_ROLE');
  });

  it('only finds roles of this association, so a platform role cannot be given', async () => {
    prismaMock.role.findFirst.mockResolvedValue(null);
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('ROLE_NOT_FOUND');
    expect(prismaMock.role.findFirst.mock.calls[0][0].where).toMatchObject({ id: 20, associationId: 7, isActive: true });
  });

  it('refuses a role that carries more than the giver holds', async () => {
    prismaMock.role.findFirst.mockResolvedValue(roleRow({ permissions: [{ permission: perm('payments.delete') }] }));
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('CANNOT_GRANT');
  });

  it('refuses someone who is not in the association or not approved yet', async () => {
    tx.user.findFirst.mockResolvedValue(null);
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('USER_NOT_FOUND');
    tx.user.findFirst.mockResolvedValue({ id: 9, isActive: false });
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('USER_INACTIVE');
  });

  it('gives the role, keeps the older role field in step and records it', async () => {
    await assignRole(actor, { userId: 9, roleId: 20 });
    expect(tx.userRole.upsert).toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { role: 'treasurer' } });
    expect(tx.auditLog.create.mock.calls[0][0].data.action).toBe('ROLE_ASSIGNED');
    expect(mockClear).toHaveBeenCalledWith(9, 7);
  });

  it('will not swap away the only Administrator\'s role', async () => {
    tx.userRole.findMany.mockResolvedValue([{ id: 3, role: { name: 'admin' } }]);
    tx.userRole.count.mockResolvedValue(0);
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('LAST_ADMIN');
    expect(tx.userRole.updateMany).not.toHaveBeenCalled();
  });

  it('allows swapping an Administrator when another remains', async () => {
    tx.userRole.findMany.mockResolvedValue([{ id: 3, role: { name: 'admin' } }]);
    tx.userRole.count.mockResolvedValue(1);
    expect(await code(assignRole(actor, { userId: 9, roleId: 20 }))).toBe('NO_ERROR');
    expect(tx.userRole.updateMany).toHaveBeenCalledWith({ where: { id: { in: [3] } }, data: { isActive: false } });
  });

  it('keeps their other roles when the association allows several', async () => {
    mockSetting.mockResolvedValue(true);
    await assignRole(actor, { userId: 9, roleId: 20 });
    expect(tx.userRole.findMany).not.toHaveBeenCalled();
    expect(tx.userRole.updateMany).not.toHaveBeenCalled();
  });

  it('locks the association while it checks, so two changes cannot both pass', async () => {
    await assignRole(actor, { userId: 9, roleId: 20 });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe('removeRole', () => {
  const held = (name: string, isActive = true) => ({ id: 5, isActive, role: { name } });
  beforeEach(() => {
    tx.userRole.findUnique.mockResolvedValue(held('treasurer'));
    tx.userRole.findMany.mockResolvedValue([{ role: { name: 'member' } }]);
  });

  it('never changes your own roles', async () => {
    expect(await code(removeRole(actor, { userId: 1, roleId: 20 }))).toBe('OWN_ROLE');
  });

  it('says so when the person does not have the role', async () => {
    tx.userRole.findUnique.mockResolvedValue(null);
    expect(await code(removeRole(actor, { userId: 9, roleId: 20 }))).toBe('NOT_ASSIGNED');
    tx.userRole.findUnique.mockResolvedValue(held('treasurer', false));
    expect(await code(removeRole(actor, { userId: 9, roleId: 20 }))).toBe('NOT_ASSIGNED');
  });

  it('will not remove the last Administrator', async () => {
    tx.userRole.findUnique.mockResolvedValue(held('admin'));
    tx.userRole.count.mockResolvedValue(0);
    expect(await code(removeRole(actor, { userId: 9, roleId: 20 }))).toBe('LAST_ADMIN');
    expect(tx.userRole.update).not.toHaveBeenCalled();
  });

  it('removes an Administrator when another remains', async () => {
    tx.userRole.findUnique.mockResolvedValue(held('admin'));
    tx.userRole.count.mockResolvedValue(2);
    expect(await code(removeRole(actor, { userId: 9, roleId: 20 }))).toBe('NO_ERROR');
  });

  it('turns the older role field to what they still hold', async () => {
    await removeRole(actor, { userId: 9, roleId: 20 });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { role: 'member' } });
  });

  it('puts someone left with no role back to being a member, so they can still see their own account', async () => {
    tx.userRole.findMany.mockResolvedValue([]);
    tx.role.findFirst.mockResolvedValue({ id: 2, name: 'member' });
    await removeRole(actor, { userId: 9, roleId: 20 });
    expect(tx.userRole.upsert.mock.calls[0][0].create).toMatchObject({ userId: 9, roleId: 2, associationId: 7 });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { role: 'member' } });
  });
});
