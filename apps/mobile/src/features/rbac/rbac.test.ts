import { actionLabel, actorName, areaLabel, auditFrom, canGrantPermission, changeLines, groupPermissions, isRoleEditable, peopleLabel, platformRoleLabel, roleKindLabel, sameKeys, searchPermissions } from './labels';
import { rbacApi, auditApi } from '@/api/endpoints/rbac';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));
const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

describe('rbacApi and auditApi', () => {
  it('reads roles, permissions and users on the rbac routes', async () => {
    mockGet.mockReturnValue(ok({}));
    await rbacApi.listRoles();
    await rbacApi.listPermissions();
    await rbacApi.listUsers({ page: 2, limit: 20, search: 'ada' });
    expect(mockGet).toHaveBeenNthCalledWith(1, '/rbac/roles');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/rbac/permissions');
    expect(mockGet).toHaveBeenNthCalledWith(3, '/rbac/users', { params: { page: 2, limit: 20, search: 'ada' } });
  });

  it('creates, changes and deletes a role', async () => {
    mockPost.mockReturnValue(ok({ id: 4 }));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({}));
    await rbacApi.createRole({ name: 'Chair', permissions: [] });
    await rbacApi.updateRole(4, { permissions: ['members.view'] });
    await rbacApi.deleteRole(4);
    expect(mockPost).toHaveBeenCalledWith('/rbac/roles', { name: 'Chair', permissions: [] });
    expect(mockPut).toHaveBeenCalledWith('/rbac/roles/4', { permissions: ['members.view'] });
    expect(mockDelete).toHaveBeenCalledWith('/rbac/roles/4');
  });

  it('gives and takes a role with the person and the role', async () => {
    mockPost.mockReturnValue(ok({}));
    await rbacApi.assignRole({ userId: 9, roleId: 4 });
    await rbacApi.removeRole({ userId: 9, roleId: 4 });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/rbac/assign', { userId: 9, roleId: 4 });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/rbac/remove', { userId: 9, roleId: 4 });
  });

  it('reads the audit log and its filters', async () => {
    mockGet.mockReturnValue(ok({}));
    await auditApi.list({ page: 1, limit: 20, tableName: 'roles', action: 'ROLE' });
    await auditApi.filters();
    expect(mockGet).toHaveBeenNthCalledWith(1, '/settings/audit-logs', { params: { page: 1, limit: 20, tableName: 'roles', action: 'ROLE' } });
    expect(mockGet).toHaveBeenNthCalledWith(2, '/settings/audit-logs/filters');
  });
});

describe('what a person can switch on for a role', () => {
  it('allows what they hold, and the Election Committee set for someone who can assign roles', () => {
    expect(canGrantPermission(['members.view'], 'members.view')).toBe(true);
    expect(canGrantPermission(['members.view'], 'payments.approve')).toBe(false);
    expect(canGrantPermission(['roles.assign'], 'elections.run')).toBe(true);
    expect(canGrantPermission(['members.view'], 'elections.run')).toBe(false);
  });

  it('never lets the Administrator role be edited, and needs the edit permission for the rest', () => {
    expect(isRoleEditable({ name: 'admin' }, true)).toBe(false);
    expect(isRoleEditable({ name: 'treasurer' }, true)).toBe(true);
    expect(isRoleEditable({ name: 'treasurer' }, false)).toBe(false);
  });

  it('compares permission sets without regard to order', () => {
    expect(sameKeys(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameKeys(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('groupPermissions', () => {
  it('groups by module in alphabetical order, rows by their wording', () => {
    const groups = groupPermissions([
      { id: 1, key: 'b', description: 'View payments', module: 'Payments' },
      { id: 2, key: 'a', description: 'Edit members', module: 'Members' },
      { id: 3, key: 'c', description: 'Add members', module: 'Members' },
    ]);
    expect(groups.map((g) => g.module)).toEqual(['Members', 'Payments']);
    expect(groups[0]?.items.map((p) => p.description)).toEqual(['Add members', 'Edit members']);
  });
});

describe('searching permissions', () => {
  const list = [
    { id: 1, key: 'members.view', description: 'View members', module: 'Members' },
    { id: 2, key: 'payments.approve', description: 'Approve payments', module: 'Payments' },
  ];
  it('matches the wording or the key in any case, and keeps all for empty text', () => {
    expect(searchPermissions(list, 'APPROVE').map((p) => p.key)).toEqual(['payments.approve']);
    expect(searchPermissions(list, 'members.').map((p) => p.key)).toEqual(['members.view']);
    expect(searchPermissions(list, '   ')).toHaveLength(2);
    expect(searchPermissions(list, 'nothing')).toHaveLength(0);
  });
  it('names roles and platform roles in plain words', () => {
    expect(roleKindLabel({ isSystemRole: true })).toBe('Built in');
    expect(roleKindLabel({ isSystemRole: false })).toBe('Custom role');
    expect(platformRoleLabel('SUPER_ADMIN')).toBe('Super admin');
  });
});

describe('words for the audit log', () => {
  it('turns codes into plain words', () => {
    expect(actionLabel('ROLE_ASSIGNED')).toBe('Role assigned');
    expect(areaLabel('user_roles')).toBe('Role assignments');
    expect(areaLabel('some_new_table')).toBe('Some new table');
    expect(areaLabel(null)).toBe('Other');
    expect(peopleLabel(0)).toBe('Nobody has it yet');
    expect(peopleLabel(1)).toBe('1 person');
    expect(peopleLabel(3)).toBe('3 people');
  });

  it('names the person by their member name, else their email, else the system', () => {
    expect(actorName({ user: { email: 'a@x.ng', member: { firstName: 'Ada', lastName: 'Obi' } } })).toBe('Ada Obi');
    expect(actorName({ user: { email: 'a@x.ng', member: null } })).toBe('a@x.ng');
    expect(actorName({ user: null })).toBe('The system');
  });

  it('shows before and after when both are known, and caps the lines', () => {
    expect(changeLines({ oldValues: { displayName: 'Old' }, newValues: { displayName: 'New', roleName: 'chair' } })).toEqual(['Display name: Old → New', 'Role name: chair']);
    expect(changeLines({ oldValues: null, newValues: null })).toEqual([]);
    expect(changeLines({ oldValues: null, newValues: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i])) })).toHaveLength(12);
  });

  it('counts a quick range back from now, and has no start for all time', () => {
    const now = new Date('2026-10-24T15:30:00.000Z');
    expect(auditFrom('all', now)).toBeUndefined();
    expect(auditFrom('7d', now)).toBe('2026-10-17T15:30:00.000Z');
    expect(auditFrom('30d', now)).toBe('2026-09-24T15:30:00.000Z');
    expect(new Date(auditFrom('today', now) as string).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
