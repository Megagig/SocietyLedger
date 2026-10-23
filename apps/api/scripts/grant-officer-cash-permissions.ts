/**
 * One-off, idempotent: registers the `cash.*` permissions and grants them to every association's administrator, treasurer and
 * financial secretary roles. New associations get these through ROLE_PERMISSION_MAPPING; this backfills the ones that already
 * exist (run once per environment). Nothing already granted is touched.
 *
 *   pnpm tsx scripts/grant-officer-cash-permissions.ts
 */
import { prisma } from '../src/lib/prisma';

const PERMISSIONS = [
  { key: 'cash.collect', description: 'Collect cash from members at meetings and record receipts.', examples: ['POST /api/cash/collections/:id/receipts'] },
  { key: 'cash.lodge', description: 'Lodge collected cash into an association bank account.', examples: ['POST /api/cash/lodgments'] },
  {
    key: 'cash.verify',
    description: 'Verify a cash lodgment against the bank statement (never your own).',
    examples: ['POST /api/cash/lodgments/:id/verify'],
  },
  { key: 'cash.view', description: 'View cash collections, cash in hand and lodgments.', examples: ['GET /api/cash/overview'] },
];

const OFFICER_ROLES = ['admin', 'treasurer', 'financial_secretary'];

async function main() {
  const permissionIds: number[] = [];
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, module: 'Cash Collections', examples: p.examples, isActive: true },
      create: { key: p.key, description: p.description, module: 'Cash Collections', examples: p.examples },
    });
    permissionIds.push(row.id);
  }

  const roles = await prisma.role.findMany({ where: { name: { in: OFFICER_ROLES } }, select: { id: true } });
  let granted = 0;
  for (const role of roles) {
    for (const permissionId of permissionIds) {
      const existing = await prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: role.id, permissionId } } });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
        granted++;
      }
    }
  }

  console.log(`Registered ${PERMISSIONS.length} permissions; granted ${granted} new role grants across ${roles.length} officer role(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
