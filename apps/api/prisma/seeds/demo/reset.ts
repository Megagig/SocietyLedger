/**
 * Removes the demo data, and only the demo data.
 *
 * The roots are the rows flagged `is_demo` (demo associations and demo users). From them the delete follows the database's own
 * foreign keys downwards (children first), so nothing outside the demo tenants is selected by any statement: every DELETE is scoped by
 * a chain of sub-selects that starts at an `is_demo = true` row. Run inside one transaction: it either removes everything or nothing.
 */
import { PrismaClient } from '@prisma/client';

interface Fk { child: string; childCol: string; parent: string; parentCol: string }

async function foreignKeys(prisma: PrismaClient): Promise<Fk[]> {
  return prisma.$queryRawUnsafe<Fk[]>(`
    SELECT cl.relname AS child, a.attname AS "childCol", pr.relname AS parent, af.attname AS "parentCol"
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class pr ON pr.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`);
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

export interface ResetResult { deleted: Record<string, number>; total: number }

export async function resetDemo(prisma: PrismaClient, opts: { dryRun?: boolean } = {}): Promise<ResetResult> {
  const fks = await foreignKeys(prisma);
  const childrenOf = new Map<string, Fk[]>();
  for (const fk of fks) childrenOf.set(fk.parent, [...(childrenOf.get(fk.parent) ?? []), fk]);
  const deleted: Record<string, number> = {};

  const result = await prisma.$transaction(
    async (tx) => {
      const walk = async (table: string, where: string, path: string[]) => {
        for (const fk of childrenOf.get(table) ?? []) {
          if (fk.child === table || path.includes(fk.child)) continue; // self references go with the same statement; cycles are left to the DB
          await walk(fk.child, `${q(fk.childCol)} IN (SELECT ${q(fk.parentCol)} FROM ${q(table)} WHERE ${where})`, [...path, table]);
        }
        if (opts.dryRun) {
          const rows = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT COUNT(*)::bigint AS n FROM ${q(table)} WHERE ${where}`);
          const n = Number(rows[0]?.n ?? 0);
          if (n) deleted[table] = Math.max(deleted[table] ?? 0, n);
          return;
        }
        const n = await tx.$executeRawUnsafe(`DELETE FROM ${q(table)} WHERE ${where}`);
        if (n) deleted[table] = (deleted[table] ?? 0) + n;
      };
      await walk('associations', '"is_demo" = true', []);
      await walk('users', '"is_demo" = true', []);
      if (!opts.dryRun) await tx.$executeRawUnsafe(`DELETE FROM "system_seeds" WHERE "key" = 'demo' OR "key" LIKE 'demo:%'`);
      return deleted;
    },
    { timeout: 600_000, maxWait: 30_000 },
  );
  return { deleted: result, total: Object.values(result).reduce((s, n) => s + n, 0) };
}
