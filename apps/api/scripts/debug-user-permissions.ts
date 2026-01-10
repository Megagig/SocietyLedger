/**
 * Script: Debug User Permissions
 * 
 * Detailed check of a specific user's permissions to diagnose permission issues.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function debugUserPermissions() {
  try {
    // Find the user
    const user = await prisma.user.findFirst({
      where: {
        email: 'austinopharm@yahoo.com'
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            association: true
          }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User:', user.email);
    console.log('   ID:', user.id);
    console.log('   Platform Role:', user.platformRole || 'None');
    console.log('');

    if (user.userRoles.length === 0) {
      console.log('❌ User has NO roles assigned!');
      return;
    }

    for (const userRole of user.userRoles) {
      console.log(`📋 Role: ${userRole.role.displayName} (${userRole.role.name})`);
      console.log(`   Association: ${userRole.association.name}`);
      console.log(`   Association ID: ${userRole.associationId}`);
      console.log(`   Role ID: ${userRole.roleId}`);
      console.log(`   Is Active: ${userRole.isActive}`);
      console.log('');
      
      console.log('   Permissions:');
      const permissionKeys = userRole.role.permissions.map(rp => rp.permission.key).sort();
      
      // Check for the required permissions
      const requiredPerms = ['ledger.view_own', 'ledger.view', 'ledger.view_all'];
      
      for (const perm of requiredPerms) {
        const has = permissionKeys.includes(perm);
        console.log(`   ${has ? '✅' : '❌'} ${perm}`);
      }
      
      console.log('');
      console.log('   All permissions:');
      permissionKeys.forEach(p => console.log(`     - ${p}`));
    }

    // Also check the role directly
    console.log('\n' + '='.repeat(60));
    console.log('Checking role permissions directly...\n');

    const adminRole = await prisma.role.findFirst({
      where: {
        name: 'admin',
        association: {
          name: 'Savio 96 Alumni Association'
        }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        association: true
      }
    });

    if (adminRole) {
      console.log(`Role: ${adminRole.displayName} (ID: ${adminRole.id})`);
      console.log(`Association: ${adminRole.association?.name}`);
      console.log(`Total permissions: ${adminRole.permissions.length}`);
      
      const hasLedgerViewOwn = adminRole.permissions.some(rp => rp.permission.key === 'ledger.view_own');
      console.log(`Has ledger.view_own: ${hasLedgerViewOwn ? '✅ YES' : '❌ NO'}`);
      
      if (!hasLedgerViewOwn) {
        // Check if the permission exists in the database
        const permission = await prisma.permission.findFirst({
          where: { key: 'ledger.view_own' }
        });
        
        if (permission) {
          console.log(`\nPermission 'ledger.view_own' exists (ID: ${permission.id})`);
          
          // Check if it's linked to this role
          const rolePermission = await prisma.rolePermission.findFirst({
            where: {
              roleId: adminRole.id,
              permissionId: permission.id
            }
          });
          
          if (rolePermission) {
            console.log('✅ Permission IS linked to role');
          } else {
            console.log('❌ Permission is NOT linked to role');
          }
        } else {
          console.log('❌ Permission does not exist in database!');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
debugUserPermissions()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
