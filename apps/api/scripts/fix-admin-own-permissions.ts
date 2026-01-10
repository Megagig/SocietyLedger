/**
 * Script: Fix Admin _own Permissions
 * 
 * Adds ledger.view_own, payments.view_own, members.view_own, members.edit_own
 * to all admin roles that are missing them.
 * 
 * This allows admins to access member-facing features like "My Finances"
 * since admins are also members of their associations.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function fixAdminOwnPermissions() {
  try {
    console.log('🔍 Finding admin roles missing _own permissions...\n');

    // Required _own permissions for admins
    const requiredPermissionKeys = [
      'ledger.view_own',
      'payments.view_own',
      'members.view_own',
      'members.edit_own'
    ];

    // Find these permissions in the database
    const requiredPermissions = await prisma.permission.findMany({
      where: {
        key: { in: requiredPermissionKeys }
      }
    });

    if (requiredPermissions.length !== requiredPermissionKeys.length) {
      const foundKeys = requiredPermissions.map(p => p.key);
      const missingKeys = requiredPermissionKeys.filter(k => !foundKeys.includes(k));
      console.error(`❌ Missing permissions in database: ${missingKeys.join(', ')}`);
      console.error('   Please run RBAC seed first');
      process.exit(1);
    }

    console.log(`✅ Found all ${requiredPermissions.length} required permissions\n`);

    // Find all admin roles
    const adminRoles = await prisma.role.findMany({
      where: {
        name: 'admin'
      },
      include: {
        association: true,
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    console.log(`📋 Found ${adminRoles.length} admin roles\n`);

    let updatedCount = 0;
    let alreadyCompleteCount = 0;

    for (const role of adminRoles) {
      const associationName = role.association?.name || 'Unknown';
      console.log(`Checking: ${role.displayName} in ${associationName}`);

      // Check which permissions are missing
      const currentPermissionKeys = role.permissions.map(rp => rp.permission.key);
      const missingPermissions = requiredPermissions.filter(
        p => !currentPermissionKeys.includes(p.key)
      );

      if (missingPermissions.length === 0) {
        console.log(`  ✅ Already has all _own permissions\n`);
        alreadyCompleteCount++;
        continue;
      }

      console.log(`  🔧 Adding ${missingPermissions.length} missing permissions:`);
      
      for (const permission of missingPermissions) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        });
        console.log(`     ✓ ${permission.key}`);
      }
      
      console.log('');
      updatedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Total admin roles: ${adminRoles.length}`);
    console.log(`   Already complete: ${alreadyCompleteCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log('='.repeat(60));

    if (updatedCount > 0) {
      console.log('\n✅ Successfully updated admin roles!');
      console.log('   Admins can now access member features like "My Finances"');
    } else {
      console.log('\n✅ All admin roles already have the required permissions!');
    }

  } catch (error) {
    console.error('❌ Error fixing admin permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixAdminOwnPermissions()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
