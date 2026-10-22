/**
 * Every default role must be able to open and follow its own support tickets. These permissions were registered but
 * never granted by the shared role mapping, so an association created through signup (or re-seeded) had members who
 * got "Permission denied: support.create" on New ticket. The mapping is what signup and the RBAC seed both read.
 */
import { ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { PERMISSIONS } from '../../src/lib/permissions';

describe('help & support in the default role mapping', () => {
  const roles = ['admin', 'treasurer', 'financial_secretary', 'member'] as const;

  it.each(roles)('%s can open and view their own tickets and use the help centre', (role) => {
    const granted = ROLE_PERMISSION_MAPPING[role] as string[];
    expect(granted).toEqual(expect.arrayContaining([PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_VIEW_OWN, PERMISSIONS.HELP_VIEW]));
  });

  it('keeps staff-only support powers with the admin role', () => {
    const admin = ROLE_PERMISSION_MAPPING.admin as string[];
    expect(admin).toEqual(
      expect.arrayContaining([PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_MANAGE, PERMISSIONS.SUPPORT_RESPOND, PERMISSIONS.SUPPORT_ESCALATE, PERMISSIONS.HELP_MANAGE])
    );
    for (const role of ['treasurer', 'financial_secretary', 'member'] as const) {
      const granted = ROLE_PERMISSION_MAPPING[role] as string[];
      for (const staffOnly of [PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_MANAGE, PERMISSIONS.SUPPORT_RESPOND, PERMISSIONS.SUPPORT_ESCALATE, PERMISSIONS.HELP_MANAGE]) {
        expect(granted).not.toContain(staffOnly);
      }
    }
  });

  it('has no duplicate keys in any role', () => {
    for (const role of roles) {
      const granted = ROLE_PERMISSION_MAPPING[role] as string[];
      expect(new Set(granted).size).toBe(granted.length);
    }
  });
});
