/**
 * One-off, idempotent: registers the `cooperatives.*_own` permissions and grants them to every
 * association's `member` role. Cooperatives used to be gated on the officer-level `ledger.view` /
 * `ledger.create`, which members don't (and must not) hold, so members could never reach their own savings,
 * loans or guarantor requests. New associations get these through ROLE_PERMISSION_MAPPING; this backfills the
 * ones that already exist (run once per environment).
 *
 *   pnpm tsx scripts/grant-member-cooperatives-permissions.ts
 */
import { prisma } from '../src/lib/prisma';

const PERMISSIONS = [
  {
    key: 'cooperatives.view_own',
    description:
      'View your own cooperative profile, savings accounts, loans, loan applications and repayments, and the loan products on offer.',
    examples: ['GET /api/cooperatives/my-profile', 'GET /api/cooperatives/loans (own only)', 'GET /api/cooperatives/loan-products'],
  },
  {
    key: 'cooperatives.apply_own',
    description: 'Apply for a cooperative loan.',
    examples: ['POST /api/cooperatives/loan-applications'],
  },
  {
    key: 'cooperatives.guarantor_own',
    description: "See and answer requests to guarantee another member's loan.",
    examples: ['GET /api/cooperatives/guarantor-requests/pending', 'POST /api/cooperatives/guarantor-requests/:id/respond'],
  },
  {
    key: 'cooperatives.savings_deposit_own',
    description: 'Declare a savings deposit you paid to the cooperative, with a receipt, for an officer to approve.',
    examples: ['POST /api/cooperatives/savings-deposits'],
  },
  {
    key: 'cooperatives.repay_own',
    description: 'Declare a payment you made towards your own loan, with a receipt, for an officer to confirm.',
    examples: ['POST /api/cooperatives/loan-repayment-requests'],
  },
];

// Officers are members too, so they also get the "declare my own payment" keys.
const OFFICER_ROLE_KEYS = ['cooperatives.savings_deposit_own', 'cooperatives.repay_own'];

async function main() {
  const permissionIds: number[] = [];
  for (const p of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, module: 'Cooperatives', examples: p.examples, isActive: true },
      create: { key: p.key, description: p.description, module: 'Cooperatives', examples: p.examples },
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

  // Officers are members too, so they can also declare a deposit into their own savings.
  const officerPermissions = await prisma.permission.findMany({ where: { key: { in: OFFICER_ROLE_KEYS } }, select: { id: true } });
  const officerRoles = await prisma.role.findMany({
    where: { name: { in: ['admin', 'treasurer', 'financial_secretary'] } },
    select: { id: true },
  });
  for (const role of officerRoles) {
    for (const permission of officerPermissions) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      });
      if (!existing) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
        granted++;
      }
    }
  }

  console.log(`Registered ${PERMISSIONS.length} permissions; granted ${granted} new role grants across ${memberRoles.length} member and ${officerRoles.length} officer role(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
