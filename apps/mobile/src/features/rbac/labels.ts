import type { PermissionAlias } from '@/lib/permissions';
import type { AuditLogDTO, PermissionDTO, RoleDTO } from '@/types/api/rbac';

/** Seeing users, roles and what each role can do (`roles.view`). */
export const ROLES_VIEW_ACCESS: PermissionAlias = 'ROLES_VIEW';
export const ROLES_CREATE_ACCESS: PermissionAlias = 'ROLES_CREATE';
export const ROLES_EDIT_ACCESS: PermissionAlias = 'ROLES_EDIT';
export const ROLES_ASSIGN_ACCESS: PermissionAlias = 'ROLES_ASSIGN';
/** Reading the activity log (`audit.view`). */
export const AUDIT_ACCESS: PermissionAlias = 'AUDIT_VIEW';

/** The Administrator role always keeps all of its permissions: the server refuses any change to them. */
export const ADMIN_ROLE_NAME = 'admin';

/**
 * Permissions the Administrator may give although the Administrator role does not hold them: the Election Committee's. This mirrors
 * the server's own list, which is what decides; the screen uses it only to avoid offering a switch the server would refuse.
 */
const COMMITTEE_KEYS = ['elections.manage', 'elections.candidates.manage', 'elections.run', 'elections.results.view', 'elections.results.publish', 'polls.manage'];

/** Whether the person can switch this permission on for a role: they hold it, or they can assign roles and it is the committee's. */
export function canGrantPermission(held: readonly string[], key: string): boolean {
  return held.includes(key) || (held.includes('roles.assign') && COMMITTEE_KEYS.includes(key));
}

/** Whether a role's permissions can be edited at all by this person. */
export function isRoleEditable(role: Pick<RoleDTO, 'name'>, canEdit: boolean): boolean {
  return canEdit && role.name !== ADMIN_ROLE_NAME;
}

export type PermissionGroup = { module: string; items: PermissionDTO[] };

/** Permissions grouped by the part of the app they belong to, groups and rows in alphabetical order. */
export function groupPermissions(permissions: PermissionDTO[]): PermissionGroup[] {
  const byModule = new Map<string, PermissionDTO[]>();
  for (const p of permissions) byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]);
  return [...byModule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([module, items]) => ({ module, items: [...items].sort((a, b) => a.description.localeCompare(b.description)) }));
}

/** Permissions whose wording or key contains the search text (any case); no text keeps them all. */
export function searchPermissions(permissions: PermissionDTO[], query: string): PermissionDTO[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return permissions;
  return permissions.filter((p) => p.key.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle));
}

/** "SUPER_ADMIN" → "Super admin": the platform-level role a login can hold besides its association roles. */
export const platformRoleLabel = (role: string): string => humanize(role);

/** A role that comes with the app (built in) or one this association made. */
export const roleKindLabel = (role: Pick<RoleDTO, 'isSystemRole'>): string => (role.isSystemRole ? 'Built in' : 'Custom role');

export function peopleLabel(count: number): string {
  return count === 0 ? 'Nobody has it yet' : `${count} ${count === 1 ? 'person' : 'people'}`;
}

export function permissionCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'permission' : 'permissions'}`;
}

/** The same set, ignoring order — used to know whether a role's permissions have changed. */
export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

const humanize = (text: string): string => {
  const spaced = text.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// ---------------------------------------------------------------- audit log

/** "ROLE_ASSIGNED" → "Role assigned". */
export const actionLabel = (action: string): string => humanize(action);

const AREA_LABELS: Record<string, string> = {
  roles: 'Roles',
  user_roles: 'Role assignments',
  settings: 'Settings',
  associations: 'Association',
  members: 'Members',
  users: 'Logins',
  transactions: 'Charges',
  payments: 'Payments',
  bank_transfers: 'Bank transfers',
  payment_proofs: 'Payment proofs',
  elections: 'Elections',
  polls: 'Polls',
  meetings: 'Meetings',
  penalty_rules: 'Late-fee rules',
  levy_campaigns: 'Levy campaigns',
};

export const areaLabel = (table: string | null | undefined): string => (table ? (AREA_LABELS[table] ?? humanize(table)) : 'Other');

/** Who did it: the member's name when there is one, else the login's email. */
export function actorName(log: Pick<AuditLogDTO, 'user'>): string {
  const user = log.user;
  if (!user) return 'The system';
  return user.member ? `${user.member.firstName} ${user.member.lastName}`.trim() : user.email;
}

/** The kinds of activity the website offers; the server matches an action that contains the chosen word. */
export const AUDIT_ACTION_OPTIONS = [
  { label: 'All actions', value: 'all' },
  { label: 'Create', value: 'CREATE' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Delete', value: 'DELETE' },
  { label: 'Login', value: 'LOGIN' },
  { label: 'Settings', value: 'SETTINGS' },
  { label: 'Role changes', value: 'ROLE' },
] as const;
export type AuditActionFilter = (typeof AUDIT_ACTION_OPTIONS)[number]['value'];

export const AUDIT_RANGE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
] as const;
export type AuditRange = (typeof AUDIT_RANGE_OPTIONS)[number]['value'];

/** The `from` for a quick range, counted back from now. A range has no end: the log runs up to the present. */
export function auditFrom(range: AuditRange, now: Date = new Date()): string | undefined {
  if (range === 'all') return undefined;
  const start = new Date(now);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
  return start.toISOString();
}

const shorten = (text: string, max = 140): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function show(value: unknown): string {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'object') return shorten(JSON.stringify(value));
  return shorten(String(value));
}

/**
 * What a log entry changed, as short lines: "key: before → after" when both are known, else "key: value". Only the entry's own top-level
 * fields are listed, at most 12, so a big record never floods the screen.
 */
export function changeLines(log: Pick<AuditLogDTO, 'oldValues' | 'newValues'>): string[] {
  const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const before = asObject(log.oldValues);
  const after = asObject(log.newValues);
  const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  return keys.slice(0, 12).map((key) => {
    const label = humanize(key.replace(/([a-z])([A-Z])/g, '$1_$2'));
    if (key in before && key in after) return `${label}: ${show(before[key])} → ${show(after[key])}`;
    return `${label}: ${show(key in after ? after[key] : before[key])}`;
  });
}
