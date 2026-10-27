/**
 * Ajo permissions and role templates (T1.4): who can do what, and who can never approve a payout.
 */
import { PERMISSIONS } from '../../src/lib/permissions';
import { ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { SYSTEM_ROLE_NAMES } from '../../src/modules/rbac/rbac-rules';

const AJO_KEYS = ['ajo.view_own', 'ajo.contribute', 'ajo.collect', 'ajo.manage', 'ajo.reconcile', 'ajo.approve_payout', 'ajo.reports'];
const ajoOf = (role: keyof typeof ROLE_PERMISSION_MAPPING) => (ROLE_PERMISSION_MAPPING[role] as string[]).filter((k) => k.startsWith('ajo.')).sort();

describe('Ajo permissions', () => {
  it('has a constant for each of the seven keys', () => {
    const constants = Object.values(PERMISSIONS).filter((k) => k.startsWith('ajo.')).sort();
    expect(constants).toEqual([...AJO_KEYS].sort());
  });

  it('gives a contributor only their own records: no collecting, managing, reconciling, approving or reports', () => {
    expect(ajoOf('member')).toEqual(['ajo.contribute', 'ajo.view_own']);
  });

  it('gives a collector only the collection tools on top of being a contributor', () => {
    expect(ajoOf('ajo_collector')).toEqual(['ajo.collect', 'ajo.contribute', 'ajo.view_own']);
  });

  it('lets an officer run groups, reconcile and report, but never approve a payout', () => {
    expect(ajoOf('ajo_officer')).toEqual(['ajo.collect', 'ajo.contribute', 'ajo.manage', 'ajo.reconcile', 'ajo.reports', 'ajo.view_own']);
    expect(ROLE_PERMISSION_MAPPING.ajo_officer).not.toContain('ajo.approve_payout');
  });

  it('keeps payout approval with the Administrator alone', () => {
    const holders = Object.entries(ROLE_PERMISSION_MAPPING)
      .filter(([, keys]) => (keys as string[]).includes('ajo.approve_payout'))
      .map(([role]) => role);
    expect(holders).toEqual(['admin']);
  });

  it('gives the Administrator every Ajo permission', () => {
    expect(ajoOf('admin')).toEqual([...AJO_KEYS].sort());
  });

  it('leaves the other officer roles and the Election Committee without group-running rights', () => {
    for (const role of ['treasurer', 'financial_secretary'] as const) expect(ajoOf(role)).toEqual([]);
    expect(ajoOf('election_committee')).toEqual(['ajo.contribute', 'ajo.view_own']);
  });

  it('reserves the two new role names so a custom role cannot take them', () => {
    expect(SYSTEM_ROLE_NAMES).toEqual(expect.arrayContaining(['ajo_collector', 'ajo_officer']));
  });
});
