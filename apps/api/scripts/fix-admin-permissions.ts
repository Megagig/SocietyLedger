/**
 * Migration Script: Add _own Permissions to Admin Role
 * 
 * Adds ledger.view_own, payments.view_own, members.view_own, members.edit_own
 * to admin role so admins can access "My Finances" and other member features
 * (since admins are also association members).
 * 
 * Run with: npx tsx scripts/fix-admin-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdminPermissions() {
  console.log('🔧 Starting Admin Permissions Fix...\n');

  try {
    // Permissions to add to admin role
    const permissionsToAdd = [
      'ledger.view_own',
      'payments.view_own',
      'members.view_own',
      'members.edit_own',
    ];

    console.log('✅ Permissions to add to admin role:');
    permissionsToAdd.forEach(p => console.log(`   + ${p}`));
    console.log('');

    // Find all admin roles across all associations
    const adminRoles = await prisma.role.findMany({
      where: {
        name: 'admin',
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    console.log(`📊 Found ${adminRoles.length} admin roles to update\n`);

    let updatedCount = 0;

    for (const adminRole of adminRoles) {
      const associationId = adminRole.associationId;
      const currentPermissions = adminRole.permissions.map(rp => rp.permission.key);
      
      console.log(`🔄 Updating admin role for association ${associationId}...`);
      console.log(`   Current permission count: ${currentPermissions.length}`);

      let addedCount = 0;

      // Add each missing permission
      for (const permKey of permissionsToAdd) {
        // Check if permission already exists
        if (currentPermissions.includes(permKey)) {
          console.log(`   ✓ Already has: ${permKey}`);
          continue;
        }

        // Get the permission
        const permission = await prisma.permission.findUnique({
          where: { key: permKey },
        });

        if (!permission) {
          console.log(`   ⚠️  Permission not found: ${permKey}`);
          continue;
        }

        // Add permission to role
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        });

        console.log(`   ✅ Added: ${permKey}`);
        addedCount++;
      }

      if (addedCount > 0) {
        updatedCount++;
        console.log(`   ✅ Updated! Added ${addedCount} permissions\n`);
      } else {
        console.log(`   ✓ Already up to date\n`);
      }
    }

    // Summary
    console.log('📈 Summary:');
    console.log(`   Total admin roles: ${adminRoles.length}`);
    console.log(`   Admin roles updated: ${updatedCount}`);
    console.log(`   Already correct: ${adminRoles.length - updatedCount}`);
    console.log('\n✨ Admin permissions fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixAdminPermissions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { fixAdminPermissions };
