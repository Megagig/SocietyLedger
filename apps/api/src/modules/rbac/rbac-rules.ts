/**
 * The rules for who may build roles and give them to people.
 *
 * A role used to be editable by anyone who could edit settings, with any permission in it, and could be given to anyone, including
 * to the person doing it and including a platform role. These checks keep a role from being a way to gain power you were not given.
 */

import { z } from 'zod';
import { ELECTION_COMMITTEE_PERMISSIONS } from '../../lib/role-permission-mapping';
import { RuleError } from '../finance/rule-error';

export class RbacRuleError extends RuleError {}

/** The roles every association starts with. A custom role cannot take one of these names. */
export const SYSTEM_ROLE_NAMES = ['admin', 'treasurer', 'financial_secretary', 'member', 'election_committee', 'ajo_collector', 'ajo_officer'] as const;

/** The role whose permissions can never be edited, since editing it is how an association would lock itself out. */
export const ADMIN_ROLE_NAME = 'admin';

/** "Fund Raiser" → "fund_raiser". Anything that is not a letter, number or underscore is dropped. */
export function normaliseRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

const permissionKeys = z
  .array(z.string().trim().min(1).max(100))
  .max(400, 'That is more permissions than exist.')
  .transform((keys) => [...new Set(keys)]);

const description = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(200, 'Use 200 characters or fewer for the description.').nullable().optional());

export const createRoleSchema = z.object({
  name: z.string({ required_error: 'Give the role a name.' }).trim().min(2, 'The role name needs at least 2 characters.').max(40, 'The role name can be 40 characters at most.'),
  displayName: z.string().trim().min(2, 'The role name needs at least 2 characters.').max(60, 'The role name can be 60 characters at most.').optional(),
  description,
  permissions: permissionKeys.default([]),
});

export const updateRoleSchema = z.object({
  displayName: z.string().trim().min(2, 'The role name needs at least 2 characters.').max(60, 'The role name can be 60 characters at most.').optional(),
  description,
  permissions: permissionKeys.optional(),
});

export const assignmentSchema = z.object({
  userId: z.number({ required_error: 'Choose a person.', invalid_type_error: 'Choose a person.' }).int().positive(),
  roleId: z.number({ required_error: 'Choose a role.', invalid_type_error: 'Choose a role.' }).int().positive(),
});

/** Reads a request body with one of the schemas above, answering a plain 400 for the first problem. */
export function parseRbacBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new RbacRuleError(result.error.issues[0]?.message ?? 'Check the details and try again.', 400, 'INVALID_ROLE');
  return result.data;
}

/**
 * The permissions among `requested` that the person may not give. They may give any permission they hold themselves; the
 * Administrator may also give the Election Committee set, which they hold no part of by design.
 */
export function ungrantablePermissions(held: ReadonlySet<string>, requested: readonly string[], canAssignRoles: boolean): string[] {
  const committee = new Set<string>(ELECTION_COMMITTEE_PERMISSIONS);
  return requested.filter((key) => !held.has(key) && !(canAssignRoles && committee.has(key)));
}

export function assertCanGrant(held: ReadonlySet<string>, requested: readonly string[]): void {
  const missing = ungrantablePermissions(held, requested, held.has('roles.assign'));
  if (missing.length > 0) {
    const shown = missing.slice(0, 5).join(', ');
    throw new RbacRuleError(
      `You can only give a role permissions you hold yourself. You do not hold: ${shown}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}.`,
      403,
      'CANNOT_GRANT',
    );
  }
}

export function assertNotOwnRole(actorId: number, targetUserId: number): void {
  if (actorId === targetUserId) {
    throw new RbacRuleError('You cannot change your own roles. Ask another Administrator.', 403, 'OWN_ROLE');
  }
}

export const lastAdminMessage = 'Every association needs at least one Administrator. Give someone else the Administrator role first.';
