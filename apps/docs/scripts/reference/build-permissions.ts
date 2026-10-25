/**
 * Builds the permissions reference table from the seed files that actually
 * define permissions (`rbac-seed.ts`, `help-permissions.seed.ts`) — not from
 * `apps/api/src/lib/permissions.ts`, whose own comments say it's legacy
 * constants kept for backward compatibility, with the database (i.e. the
 * seeds) as the real source of truth. `permissions.ts` is read only to
 * populate the "aliases" column: a reverse lookup from each seeded dotted
 * key to every legacy constant name that points at it.
 *
 * Any `permissions.ts` constant whose value matches no seeded key is a dead
 * constant (confirmed for the blog/docs-CMS keys at D6.1 — no seed file
 * assigns them to any role) and is surfaced as a warning rather than shown
 * on the public page, which must never document the platform-only CMS
 * anyway (architecture.md rule #3 / §9.9).
 */
import path from 'node:path';
import { parseTsConst } from './parse-ts-const';

const apiRoot = (...parts: string[]) => path.join(__dirname, '..', '..', '..', 'api', ...parts);

interface PermissionEntry {
  key: string;
  description: string;
  module: string;
  examples: string[];
}

export interface PermissionRow {
  key: string;
  description: string;
  module: string;
  aliases: string[];
  roles: string[];
}

// The only roles this public page documents — `super_admin` is granted
// every permission unconditionally and is platform-internal (rule #3).
const TENANT_ROLES = ['admin', 'treasurer', 'financial_secretary', 'member'] as const;

export function buildPermissions(): { rows: PermissionRow[]; warnings: string[] } {
  const warnings: string[] = [];

  const registry = parseTsConst(apiRoot('prisma/seeds/rbac-seed.ts'), 'PERMISSION_REGISTRY') as PermissionEntry[];
  // ROLE_PERMISSION_MAPPING lives in src/lib/role-permission-mapping.ts (moved out of rbac-seed.ts in G66).
  const roleMapping = parseTsConst(apiRoot('src/lib/role-permission-mapping.ts'), 'ROLE_PERMISSION_MAPPING') as Record<
    string,
    string[]
  >;
  const helpRegistry = parseTsConst(apiRoot('prisma/seeds/help-permissions.seed.ts'), 'HELP_PERMISSIONS') as PermissionEntry[];
  const helpRoleMapping = parseTsConst(
    apiRoot('prisma/seeds/help-permissions.seed.ts'),
    'ROLE_HELP_PERMISSIONS',
  ) as Record<string, string[]>;
  const aliasSource = parseTsConst(apiRoot('src/lib/permissions.ts'), 'PERMISSIONS') as Record<string, string>;

  const byKey = new Map<string, PermissionEntry>();
  for (const entry of [...registry, ...helpRegistry]) {
    if (byKey.has(entry.key)) {
      warnings.push(`Permission key "${entry.key}" is defined in more than one seed file — kept the first.`);
      continue;
    }
    byKey.set(entry.key, entry);
  }

  // dotted key -> every legacy constant name in permissions.ts that points at it
  const aliasMap = new Map<string, string[]>();
  for (const [constName, value] of Object.entries(aliasSource)) {
    if (!aliasMap.has(value)) aliasMap.set(value, []);
    aliasMap.get(value)!.push(constName);
  }

  const deadConstants: string[] = [];
  for (const [value, constNames] of aliasMap) {
    if (!byKey.has(value)) deadConstants.push(...constNames.map((name) => `${name} -> '${value}'`));
  }
  if (deadConstants.length > 0) {
    warnings.push(
      `permissions.ts defines constants pointing at permission keys that no seed file ever assigns to any role (dead constants): ${deadConstants.sort().join(', ')}.`,
    );
  }

  const rolesByKey = new Map<string, Set<string>>();
  const mappingSources: [string, Record<string, string[]>][] = [
    ['rbac-seed.ts', roleMapping],
    ['help-permissions.seed.ts', helpRoleMapping],
  ];
  for (const [source, mapping] of mappingSources) {
    for (const [role, keys] of Object.entries(mapping)) {
      if (!(TENANT_ROLES as readonly string[]).includes(role)) continue;
      for (const key of keys) {
        if (!byKey.has(key)) {
          warnings.push(
            `${source}'s role mapping grants "${role}" the permission key "${key}", which isn't in any seeded permission registry — the real seed script silently skips it (its \`if (permission)\` guard), so ${role} never actually receives it.`,
          );
          continue;
        }
        if (!rolesByKey.has(key)) rolesByKey.set(key, new Set());
        rolesByKey.get(key)!.add(role);
      }
    }
  }

  const rows: PermissionRow[] = [...byKey.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((entry) => ({
      key: entry.key,
      description: entry.description,
      module: entry.module,
      aliases: (aliasMap.get(entry.key) ?? []).sort(),
      roles: TENANT_ROLES.filter((role) => rolesByKey.get(entry.key)?.has(role)),
    }));

  return { rows, warnings };
}
