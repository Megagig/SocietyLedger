/**
 * Script: Check User Roles
 * 
 * Checks if users have the correct roles assigned in their associations.
 * This helps diagnose permission issues.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function checkUserRoles() {
  try {
    console.log('🔍 Checking user role assignments...\n');

    // Get all users with their roles
    const users = await prisma.user.findMany({
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

    console.log(`Found ${users.length} users\n`);

    for (const user of users) {
      console.log(`👤 User: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Platform Role: ${user.platformRole || 'None'}`);
      console.log(`   Association Roles: ${user.userRoles.length}`);

      if (user.userRoles.length === 0) {
        console.log(`   ⚠️  WARNING: User has no roles assigned!`);
      } else {
        for (const userRole of user.userRoles) {
          console.log(`   - ${userRole.role.displayName} (${userRole.role.name}) in ${userRole.association.name}`);
          console.log(`     Permissions: ${userRole.role.permissions.length}`);
          
          // Check for finance permissions
          const hasFinancePermission = userRole.role.permissions.some(
            rp => rp.permission.key === 'ledger.view_own'
          );
          
          if (hasFinancePermission) {
            console.log(`     ✅ Has ledger.view_own permission`);
          } else {
            console.log(`     ❌ Missing ledger.view_own permission`);
          }
        }
      }
      console.log('');
    }

    // Summary
    const usersWithoutRoles = users.filter(u => u.userRoles.length === 0);
    if (usersWithoutRoles.length > 0) {
      console.log(`\n⚠️  ${usersWithoutRoles.length} user(s) have no roles assigned:`);
      usersWithoutRoles.forEach(u => console.log(`   - ${u.email}`));
      console.log('\nTo fix this, users need to be assigned roles in their associations.');
    } else {
      console.log('✅ All users have roles assigned!');
    }

  } catch (error) {
    console.error('❌ Error checking user roles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkUserRoles()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
