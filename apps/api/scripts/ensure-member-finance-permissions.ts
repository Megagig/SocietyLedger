/**
 * Script: Ensure Member Finance Permissions
 * 
 * Ensures that the 'member' role has the necessary permissions to view their own financial data.
 * This fixes the "Permission denied" error when members try to access /dashboard/my-finances
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function ensureMemberFinancePermissions() {
  try {
    console.log('🔍 Checking member role permissions...');

    // Find the member role
    const memberRole = await prisma.role.findFirst({
      where: { name: 'member' },
      include: { 
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    if (!memberRole) {
      console.error('❌ Member role not found! Please run RBAC seed first.');
      process.exit(1);
    }

    console.log(`✅ Found member role: ${memberRole.displayName} (${memberRole.name})`);
    console.log(`   Current permissions: ${memberRole.permissions.length}`);

    // Required permissions for member finance access
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

    console.log(`\n📋 Required permissions found: ${requiredPermissions.length}/${requiredPermissionKeys.length}`);
    
    if (requiredPermissions.length !== requiredPermissionKeys.length) {
      const foundKeys = requiredPermissions.map(p => p.key);
      const missingKeys = requiredPermissionKeys.filter(k => !foundKeys.includes(k));
      console.error(`❌ Missing permissions in database: ${missingKeys.join(', ')}`);
      console.error('   Please run RBAC seed first: npm run seed:rbac');
      process.exit(1);
    }

    // Check which permissions are already assigned
    const currentPermissionIds = memberRole.permissions.map(rp => rp.permissionId);
    const permissionsToAdd = requiredPermissions.filter(
      p => !currentPermissionIds.includes(p.id)
    );

    if (permissionsToAdd.length === 0) {
      console.log('\n✅ All required permissions are already assigned to member role!');
      console.log('   Member role has:');
      requiredPermissions.forEach(p => {
        console.log(`   ✓ ${p.key} - ${p.description}`);
      });
      return;
    }

    // Add missing permissions
    console.log(`\n🔧 Adding ${permissionsToAdd.length} missing permissions...`);
    
    for (const permission of permissionsToAdd) {
      await prisma.rolePermission.create({
        data: {
          roleId: memberRole.id,
          permissionId: permission.id
        }
      });
      console.log(`   ✓ Added: ${permission.key} - ${permission.description}`);
    }

    console.log('\n✅ Successfully updated member role permissions!');
    console.log('   Members can now access their financial data at /dashboard/my-finances');

  } catch (error) {
    console.error('❌ Error ensuring member finance permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
ensureMemberFinancePermissions()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
