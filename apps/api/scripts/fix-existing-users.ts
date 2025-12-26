/**
 * Migration script to fix existing users after auth lifecycle update
 * Run with: npx ts-node scripts/fix-existing-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing existing users...\n');

  // Update all existing users to be email verified and active
  const usersUpdated = await prisma.user.updateMany({
    where: {
      OR: [
        { emailVerified: false },
        { isActive: false },
      ],
    },
    data: {
      emailVerified: true,
      isActive: true,
    },
  });

  console.log(`✅ Updated ${usersUpdated.count} users (emailVerified=true, isActive=true)`);

  // Update all pending approvals to approved
  const approvalsUpdated = await prisma.userApproval.updateMany({
    where: {
      approvalStatus: 'pending',
    },
    data: {
      approvalStatus: 'approved',
      approvalDate: new Date(),
    },
  });

  console.log(`✅ Updated ${approvalsUpdated.count} user approvals to 'approved'`);

  console.log('\n🎉 Done! Existing users can now log in.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
