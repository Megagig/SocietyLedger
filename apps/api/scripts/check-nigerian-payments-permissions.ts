/**
 * Diagnostic Script: Check Nigerian Payments Permissions
 * 
 * This script checks if the Nigerian Payments permissions exist in the database
 * and if the current user has been granted these permissions.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nigerian Payments permissions that should exist
const NIGERIAN_PAYMENTS_PERMISSIONS = [
  'payments.nigerian.record',
  'payments.nigerian.verify',
  'payments.nigerian.reconcile',
  'payments.nigerian.import',
  'payments.nigerian.view',
];

async function checkPermissions() {
  console.log('='.repeat(80));
  console.log('NIGERIAN PAYMENTS PERMISSIONS DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log();

  // 1. Check if permissions exist in database
  console.log('1. CHECKING PERMISSIONS IN DATABASE');
  console.log('-'.repeat(80));
  
  const dbPermissions = await prisma.permission.findMany({
    where: {
      key: {
        in: NIGERIAN_PAYMENTS_PERMISSIONS,
      },
    },
  });

  console.log(`Found ${dbPermissions.length} of ${NIGERIAN_PAYMENTS_PERMISSIONS.length} Nigerian Payments permissions in database:\n`);

  for (const permKey of NIGERIAN_PAYMENTS_PERMISSIONS) {
    const exists = dbPermissions.find(p => p.key === permKey);
    if (exists) {
      console.log(`  ✅ ${permKey} - EXISTS (ID: ${exists.id})`);
    } else {
      console.log(`  ❌ ${permKey} - MISSING`);
    }
  }

  console.log();

  // 2. Check which roles have these permissions
  console.log('2. CHECKING ROLE PERMISSIONS');
  console.log('-'.repeat(80));

  if (dbPermissions.length > 0) {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        permissionId: {
          in: dbPermissions.map(p => p.id),
        },
      },
      include: {
        role: true,
        permission: true,
      },
    });

    console.log(`Found ${rolePermissions.length} role-permission associations:\n`);

    // Group by permission
    for (const perm of dbPermissions) {
      const rp = rolePermissions.filter(r => r.permissionId === perm.id);
      console.log(`  ${perm.key}:`);
      if (rp.length > 0) {
        for (const r of rp) {
          console.log(`    - ${r.role.name} (Role ID: ${r.roleId})`);
        }
      } else {
        console.log(`    - NO ROLES ASSIGNED`);
      }
    }
  } else {
    console.log('  ⚠️  No Nigerian Payments permissions found in database, skipping role check.');
  }

  console.log();

  // 3. Check user permissions (you'll need to provide your user ID or email)
  console.log('3. CHECKING USER PERMISSIONS');
  console.log('-'.repeat(80));
  console.log('To check a specific user, provide their user ID or email.');
  console.log('This script will show all users and their Nigerian Payments permissions.\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      userRoles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      email: 'asc',
    },
  });

  console.log(`Found ${users.length} users:\n`);

  for (const user of users) {
    // Extract permissions from user roles
    const userPerms: string[] = [];
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        userPerms.push(rolePermission.permission.key);
      }
    }
    
    const nigerianPerms = userPerms.filter((p: string) => 
      NIGERIAN_PAYMENTS_PERMISSIONS.includes(p)
    );

    console.log(`  User: ${user.email}`);
    console.log(`    Role: ${user.role || 'N/A'}`);
    console.log(`    Nigerian Payments Permissions: ${nigerianPerms.length > 0 ? nigerianPerms.join(', ') : 'NONE'}`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(80));
}

checkPermissions()
  .then(() => {
    console.log('\n✅ Diagnostic completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
