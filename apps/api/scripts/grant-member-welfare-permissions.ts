/**
 * One-off, idempotent: registers `welfare.view_own` / `welfare.request_own` and grants them to every
 * association's `member` role. Welfare used to be gated on the officer-level `ledger.view` / `ledger.create`,
 * which members don't (and must not) hold, so members could never reach welfare. New associations get these
 * through ROLE_PERMISSION_MAPPING; this backfills the ones that already exist (run once per environment).
 *
 *   pnpm tsx scripts/grant-member-welfare-permissions.ts
 */
import { prisma } from '../src/lib/prisma';

const PERMISSIONS = [
  {
    key: 'welfare.view_own',
    description: 'View your own welfare profile, contributions and payout requests, and the funds you can request from.',
    examples: ['GET /api/welfare/my-profile', 'GET /api/welfare/funds', 'GET /api/welfare/payouts (own only)'],
  },
  {
    key: 'welfare.request_own',
    description: 'Submit and cancel your own welfare payout requests.',
    examples: ['POST /api/welfare/payouts', 'POST /api/welfare/payouts/:id/cancel'],
  },
];

async function main() {
  const permissionIds: number[] = [];
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, module: 'Welfare', examples: p.examples, isActive: true },
      create: { key: p.key, description: p.description, module: 'Welfare', examples: p.examples },
    });
    permissionIds.push(row.id);
  }

  const memberRoles = await prisma.role.findMany({ where: { name: 'member' }, select: { id: true, associationId: true } });
  let granted = 0;
  for (const role of memberRoles) {
    for (const permissionId of permissionIds) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
        granted++;
      }
    }
  }

  console.log(`Registered ${PERMISSIONS.length} permissions; granted ${granted} new role grants across ${memberRoles.length} member role(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
