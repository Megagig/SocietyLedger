/**
 * Script: Assign Member Role to User
 * 
 * Assigns the 'member' role to a user who doesn't have any roles.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function assignMemberRole() {
  try {
    const userEmail = 'austinopharm@yahoo.com';
    
    console.log(`🔍 Finding user: ${userEmail}\n`);

    // Find the user
    const user = await prisma.user.findFirst({
      where: { email: userEmail },
      include: {
        userRoles: {
          include: {
            association: true
          }
        }
      }
    });

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Current roles: ${user.userRoles.length}`);

    if (user.userRoles.length > 0) {
      console.log('\n⚠️  User already has roles:');
      user.userRoles.forEach(ur => {
        console.log(`   - ${ur.association.name}`);
      });
      console.log('\nNo changes needed.');
      return;
    }

    // Find which association this user should belong to
    // Check if they have any member records
    const memberRecord = await prisma.member.findFirst({
      where: {
        OR: [
          { email: userEmail },
          { userId: user.id }
        ]
      },
      include: {
        association: true
      }
    });

    if (!memberRecord) {
      console.log('\n❌ No member record found for this user.');
      console.log('   The user needs to be added as a member to an association first.');
      console.log('   Or you can manually specify the association ID.');
      
      // List available associations
      const associations = await prisma.association.findMany({
        select: { id: true, name: true }
      });
      
      console.log('\n📋 Available associations:');
      associations.forEach(a => console.log(`   ${a.id}: ${a.name}`));
      return;
    }

    console.log(`\n📋 Found member record in: ${memberRecord.association.name}`);
    console.log(`   Association ID: ${memberRecord.associationId}`);

    // Find the member role for this association
    let memberRole = await prisma.role.findFirst({
      where: {
        name: 'member',
        associationId: memberRecord.associationId
      }
    });

    if (!memberRole) {
      console.log('\n⚠️  Member role not found for this association. Creating one...');
      
      // Get the default member permissions
      const memberPermissions = await prisma.permission.findMany({
        where: {
          key: {
            in: [
              'members.view_own',
              'members.edit_own',
              'ledger.view_own',
              'payments.view_own',
              'payments.nigerian.view',
              'reports.generate',
              'notifications.view',
              'exports.view_history'
            ]
          }
        }
      });

      memberRole = await prisma.role.create({
        data: {
          name: 'member',
          displayName: 'Member',
          description: 'Regular association member with basic access',
          associationId: memberRecord.associationId,
          isSystemRole: true,
          isActive: true,
          permissions: {
            create: memberPermissions.map(p => ({
              permissionId: p.id
            }))
          }
        }
      });

      console.log(`   ✅ Created member role (ID: ${memberRole.id})`);
    } else {
      console.log(`   ✅ Found member role (ID: ${memberRole.id})`);
    }

    // Assign the role to the user
    const userRole = await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: memberRole.id,
        associationId: memberRecord.associationId,
        isActive: true
      }
    });

    console.log(`\n✅ Successfully assigned member role to user!`);
    console.log(`   User: ${user.email}`);
    console.log(`   Role: ${memberRole.displayName}`);
    console.log(`   Association: ${memberRecord.association.name}`);
    console.log(`   UserRole ID: ${userRole.id}`);

    // Also link the user to the member record if not already linked
    if (!memberRecord.userId) {
      await prisma.member.update({
        where: { id: memberRecord.id },
        data: { userId: user.id }
      });
      console.log(`\n✅ Linked user to member record (Member ID: ${memberRecord.id})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignMemberRole()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
