import fs from 'fs';
import path from 'path';

import { ELECTION_COMMITTEE_PERMISSIONS, ROLE_PERMISSION_MAPPING } from '../../src/lib/role-permission-mapping';
import { PERMISSIONS } from '../../src/lib/permissions';

const committee = ROLE_PERMISSION_MAPPING.election_committee as string[];

describe('Election Committee role', () => {
  it('holds every election power and everything a member has', () => {
    for (const key of ELECTION_COMMITTEE_PERMISSIONS) expect(committee).toContain(key);
    for (const key of ROLE_PERMISSION_MAPPING.member as string[]) expect(committee).toContain(key);
  });

  it('is the only role that can run elections: officers and members cannot', () => {
    const electionPowers = ELECTION_COMMITTEE_PERMISSIONS.filter((k) => k.startsWith('elections.'));
    for (const role of ['admin', 'treasurer', 'financial_secretary', 'member'] as const) {
      const granted = ROLE_PERMISSION_MAPPING[role] as string[];
      for (const key of electionPowers) expect(granted).not.toContain(key);
    }
  });

  it('the Administrator still runs polls; no one else does', () => {
    expect(ROLE_PERMISSION_MAPPING.admin as string[]).toContain('polls.manage');
    for (const role of ['treasurer', 'financial_secretary', 'member'] as const) {
      expect(ROLE_PERMISSION_MAPPING[role] as string[]).not.toContain('polls.manage');
    }
  });

  it('election aliases no longer ride on members.create', () => {
    for (const alias of ['ELECTION_MANAGE', 'ELECTION_CANDIDATES', 'ELECTION_RUN', 'ELECTION_RESULTS_VIEW', 'ELECTION_RESULTS_PUBLISH', 'POLL_MANAGE'] as const) {
      expect(PERMISSIONS[alias]).not.toBe('members.create');
      expect(ELECTION_COMMITTEE_PERMISSIONS).toContain(PERMISSIONS[alias]);
    }
  });

  it('the Administrator and the committee can set the rules for who votes; no one else can', () => {
    expect(ROLE_PERMISSION_MAPPING.admin as string[]).toContain('elections.rules.manage');
    expect(committee).toContain('elections.rules.manage');
    for (const role of ['treasurer', 'financial_secretary', 'member'] as const) {
      expect(ROLE_PERMISSION_MAPPING[role] as string[]).not.toContain('elections.rules.manage');
    }
    expect(PERMISSIONS.ELECTION_RULES).toBe('elections.rules.manage');
    const sql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261031_add_election_rules_permission/migration.sql'), 'utf8');
    expect(sql).toContain("'elections.rules.manage'");
    expect(sql).toContain("IN ('admin', 'election_committee')");
  });

  it('the data migration grants exactly the same keys', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261028_add_election_committee_role/migration.sql'), 'utf8');
    for (const key of ELECTION_COMMITTEE_PERMISSIONS) {
      expect(sql.split(`
  ('${key}'`).length - 1).toBe(1); // registered once
      expect(sql).toContain(`'${key}'`);
    }
    const inList = sql.match(/IN \(([^)]*)\)/)?.[1].match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
    expect(inList.sort()).toEqual([...ELECTION_COMMITTEE_PERMISSIONS].sort());
  });
});
