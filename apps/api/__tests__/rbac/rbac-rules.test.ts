/** A role can't be a way to gain power you were not given. */
import {
  RbacRuleError,
  assertCanGrant,
  assertNotOwnRole,
  assignmentSchema,
  createRoleSchema,
  normaliseRoleName,
  parseRbacBody,
  ungrantablePermissions,
  updateRoleSchema,
} from '../../src/modules/rbac/rbac-rules';

const refusal = (run: () => unknown): RbacRuleError => {
  try {
    run();
  } catch (error) {
    if (error instanceof RbacRuleError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
};

describe('normaliseRoleName', () => {
  it('makes a plain lower-case name with underscores', () => {
    expect(normaliseRoleName('Fund Raiser')).toBe('fund_raiser');
    expect(normaliseRoleName('  Welfare   Chair ')).toBe('welfare_chair');
    expect(normaliseRoleName('Tre$asurer!!')).toBe('treasurer');
    expect(normaliseRoleName('___')).toBe('');
  });
});

describe('what a person may give a role', () => {
  const held = new Set(['members.view', 'settings.edit', 'roles.assign']);

  it('allows permissions the person holds', () => {
    expect(ungrantablePermissions(held, ['members.view', 'settings.edit'], true)).toEqual([]);
  });

  it('refuses permissions the person does not hold, and says which', () => {
    expect(ungrantablePermissions(held, ['members.view', 'payments.approve', 'roles.edit'], true)).toEqual(['payments.approve', 'roles.edit']);
    const error = refusal(() => assertCanGrant(held, ['payments.approve']));
    expect(error.status).toBe(403);
    expect(error.code).toBe('CANNOT_GRANT');
    expect(error.message).toContain('payments.approve');
  });

  it('lets someone who can assign roles appoint the Election Committee, which officers do not hold by design', () => {
    expect(ungrantablePermissions(held, ['elections.run', 'polls.manage'], true)).toEqual([]);
    expect(ungrantablePermissions(new Set(['members.view']), ['elections.run'], false)).toEqual(['elections.run']);
    expect(() => assertCanGrant(held, ['elections.results.publish'])).not.toThrow();
  });

  it('shortens a long list of missing permissions', () => {
    const error = refusal(() => assertCanGrant(new Set(), ['a', 'b', 'c', 'd', 'e', 'f', 'g']));
    expect(error.message).toContain('and 2 more');
  });
});

describe('nobody changes their own roles', () => {
  it('refuses a change to yourself and allows one to someone else', () => {
    expect(refusal(() => assertNotOwnRole(5, 5)).code).toBe('OWN_ROLE');
    expect(() => assertNotOwnRole(5, 6)).not.toThrow();
  });
});

describe('role input', () => {
  it('needs a name of a sensible length and drops repeated permissions', () => {
    expect(refusal(() => parseRbacBody(createRoleSchema, {})).message).toBe('Give the role a name.');
    expect(refusal(() => parseRbacBody(createRoleSchema, { name: 'a' })).code).toBe('INVALID_ROLE');
    expect(parseRbacBody(createRoleSchema, { name: 'Fund Raiser', permissions: ['members.view', 'members.view'] }).permissions).toEqual(['members.view']);
  });

  it('treats an empty description as cleared and refuses a long one', () => {
    expect(parseRbacBody(createRoleSchema, { name: 'Chair', description: '  ' }).description).toBeNull();
    expect(refusal(() => parseRbacBody(createRoleSchema, { name: 'Chair', description: 'x'.repeat(201) })).code).toBe('INVALID_ROLE');
  });

  it('lets an update change only what it sends', () => {
    expect(parseRbacBody(updateRoleSchema, {})).toEqual({});
    expect(parseRbacBody(updateRoleSchema, { permissions: [] }).permissions).toEqual([]);
    expect(refusal(() => parseRbacBody(updateRoleSchema, { permissions: 'all' })).code).toBe('INVALID_ROLE');
  });

  it('needs real numbers for the person and the role', () => {
    expect(refusal(() => parseRbacBody(assignmentSchema, { userId: '4', roleId: 2 })).message).toBe('Choose a person.');
    expect(refusal(() => parseRbacBody(assignmentSchema, { userId: 4 })).message).toBe('Choose a role.');
    expect(parseRbacBody(assignmentSchema, { userId: 4, roleId: 2 })).toEqual({ userId: 4, roleId: 2 });
  });
});
