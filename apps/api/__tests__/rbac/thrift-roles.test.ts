import { ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { THRIFT_GROUP_HIDDEN_ROLES, THRIFT_GROUP_ROLE_NAMES, isThriftExcludedPermission } from '../../src/lib/thrift-roles';

const map = ROLE_PERMISSION_MAPPING as Record<string, string[]>;
const forThrift = (role: string) => (map[role] ?? []).filter((k) => !isThriftExcludedPermission(k));

describe('roles in a standalone thrift group', () => {
  it('leaves out the permissions of modules a thrift group does not have', () => {
    expect(isThriftExcludedPermission('welfare.view_own')).toBe(true);
    expect(isThriftExcludedPermission('cooperatives.apply_own')).toBe(true);
    expect(isThriftExcludedPermission('ajo.collect')).toBe(false);
    expect(isThriftExcludedPermission('members.view')).toBe(false);
  });

  it('lets the administrator give every role the group offers (an admin can only give what they hold)', () => {
    const adminHolds = new Set(forThrift('admin'));
    for (const role of Object.keys(THRIFT_GROUP_ROLE_NAMES)) {
      const missing = forThrift(role).filter((k) => !adminHolds.has(k));
      expect({ role, missing }).toEqual({ role, missing: [] });
    }
  });

  it('hides the roles that only exist for an association, and names the rest in a thrift group’s own words', () => {
    expect(THRIFT_GROUP_HIDDEN_ROLES).toEqual(expect.arrayContaining(['treasurer', 'financial_secretary', 'election_committee']));
    expect(THRIFT_GROUP_ROLE_NAMES.ajo_collector.displayName).toBe('Collector');
    expect(THRIFT_GROUP_ROLE_NAMES.ajo_officer.displayName).toBe('Officer');
    expect(Object.keys(THRIFT_GROUP_ROLE_NAMES).some((r) => THRIFT_GROUP_HIDDEN_ROLES.includes(r))).toBe(false);
  });
});
