/**
 * Migration Script: Fix Member Permissions
 * 
 * This script removes admin-level permissions (ledger.view, payments.view, members.view)
 * from users with 'member' role, keeping only their own-view permissions.
 * 
 * Run with: npx tsx scripts/fix-member-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMemberPermissions() {
  console.log('🔧 Starting Member Permissions Fix...\n');

  try {
    // 1. Find all users with 'member' role
    const members = await prisma.user.findMany({
      where: {
        role: 'member',
        associationId: { not: null },
      },
      include: {
        association: true,
      },
    });

    console.log(`📊 Found ${members.length} members to audit\n`);

    // 2. Get permissions to remove (admin-level permissions)
    const permissionsToRemove = [
      'ledger.view',        // Full ledger access
      'payments.view',      // Full payment access
      'members.view',       // Full member list access
    ];

    const permissionsToKeep = [
      'ledger.view_own',    // Personal ledger only
      'payments.view_own',  // Personal payments only
      'members.view_own',   // Own profile only
      'members.edit_own',   // Edit own profile
      'reports.generate',   // Generate reports
    ];

    console.log('❌ Permissions to remove from members:');
    permissionsToRemove.forEach(p => console.log(`   - ${p}`));
    console.log('\n✅ Permissions members should keep:');
    permissionsToKeep.forEach(p => console.log(`   - ${p}`));
    console.log('');

    // 3. Process each member
    let fixedCount = 0;
    let alreadyCorrectCount = 0;

    for (const member of members) {
      const memberEmail = member.email;
      const associationId = member.associationId!;

      // Get member's role in their association
      const memberRole = await prisma.role.findFirst({
        where: {
          associationId,
          name: 'member',
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!memberRole) {
        console.log(`⚠️  No 'member' role found for association ${associationId}, skipping user ${memberEmail}`);
        continue;
      }

      // Check if member role has admin permissions
      const currentPermissions = memberRole.permissions.map(rp => rp.permission.key);
      const hasAdminPermissions = permissionsToRemove.some(p => currentPermissions.includes(p));

      if (!hasAdminPermissions) {
        alreadyCorrectCount++;
        continue;
      }

      console.log(`🔄 Fixing ${memberEmail}...`);
      console.log(`   Current permissions: ${currentPermissions.join(', ')}`);

      // Remove admin-level permissions from role
      for (const permKey of permissionsToRemove) {
        const permission = await prisma.permission.findUnique({
          where: { key: permKey },
        });

        if (permission) {
          await prisma.rolePermission.deleteMany({
            where: {
              roleId: memberRole.id,
              permissionId: permission.id,
            },
          });
          console.log(`   ❌ Removed: ${permKey}`);
        }
      }

      // Ensure member has all own-view permissions
      for (const permKey of permissionsToKeep) {
        const permission = await prisma.permission.findUnique({
          where: { key: permKey },
        });

        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: memberRole.id,
                permissionId: permission.id,
              },
            },
            create: {
              roleId: memberRole.id,
              permissionId: permission.id,
            },
            update: {},
          });
        }
      }

      fixedCount++;
      console.log(`   ✅ Fixed!\n`);
    }

    // 4. Summary
    console.log('\n📈 Summary:');
    console.log(`   Total members audited: ${members.length}`);
    console.log(`   Members fixed: ${fixedCount}`);
    console.log(`   Already correct: ${alreadyCorrectCount}`);
    console.log('\n✨ Member permissions fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Error fixing member permissions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixMemberPermissions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { fixMemberPermissions };
