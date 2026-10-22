import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Help & Support Permissions
const HELP_PERMISSIONS = [
  {
    key: 'help.view',
    description: 'View help articles and FAQs',
    module: 'Help & Support',
    examples: ['GET /api/help', 'Help center pages'],
  },
  {
    key: 'help.manage',
    description: 'Create, edit, and delete help articles and FAQs',
    module: 'Help & Support',
    examples: ['POST /api/help/articles', 'PUT /api/help/faqs/:id'],
  },
  {
    key: 'support.create',
    description: 'Create support tickets',
    module: 'Help & Support',
    examples: ['POST /api/support/tickets', 'New ticket form'],
  },
  {
    key: 'support.view_own',
    description: 'View own support tickets',
    module: 'Help & Support',
    examples: ['GET /api/support/tickets/my', 'Personal ticket list'],
  },
  {
    key: 'support.view_all',
    description: 'View all support tickets',
    module: 'Help & Support',
    examples: ['GET /api/support/tickets', 'Admin ticket management'],
  },
  {
    key: 'support.manage',
    description: 'Manage support tickets (assign, close, etc.)',
    module: 'Help & Support',
    examples: ['PUT /api/support/tickets/:id/assign', 'Ticket management'],
  },
  {
    key: 'support.respond',
    description: 'Respond to support tickets',
    module: 'Help & Support',
    examples: ['POST /api/support/tickets/:id/responses', 'Ticket responses'],
  },
  {
    key: 'support.escalate',
    description: "Contact SocietyLedger support on the association's behalf, and escalate a member's ticket to it.",
    module: 'Help & Support',
    examples: ['POST /api/support/platform-tickets', 'POST /api/support/tickets/:id/escalate'],
  },
];

// Role permission mapping for help & support
const ROLE_HELP_PERMISSIONS = {
  admin: [
    'help.view',
    'help.manage',
    'support.create',
    'support.view_own',
    'support.view_all',
    'support.manage',
    'support.respond',
    'support.escalate',
  ],
  treasurer: [
    'help.view',
    'support.create',
    'support.view_own',
  ],
  financial_secretary: [
    'help.view',
    'support.create',
    'support.view_own',
  ],
  member: [
    'help.view',
    'support.create',
    'support.view_own',
  ],
};

export async function seedHelpPermissions() {
  console.log('🔐 Seeding Help & Support Permissions...');

  try {
    // 1. Create permissions
    console.log('📋 Creating help & support permissions...');
    for (const permData of HELP_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key: permData.key },
        update: {
          description: permData.description,
          module: permData.module,
          examples: permData.examples,
        },
        create: {
          key: permData.key,
          description: permData.description,
          module: permData.module,
          examples: permData.examples,
        },
      });
      console.log(`  ✓ Permission: ${permData.key}`);
    }

    // 2. Assign permissions to super_admin (platform role)
    console.log('👑 Assigning to super_admin...');
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'super_admin', associationId: null },
    });

    if (superAdminRole) {
      for (const permData of HELP_PERMISSIONS) {
        const permission = await prisma.permission.findUnique({
          where: { key: permData.key },
        });
        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: superAdminRole.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: superAdminRole.id,
              permissionId: permission.id,
            },
          });
        }
      }
      console.log('  ✓ Super admin permissions assigned');
    }

    // 3. Assign permissions to association roles
    console.log('🏢 Assigning to association roles...');
    const associations = await prisma.association.findMany();

    for (const association of associations) {
      console.log(`  Association: ${association.name}`);

      for (const [roleName, permissionKeys] of Object.entries(ROLE_HELP_PERMISSIONS)) {
        const role = await prisma.role.findFirst({
          where: {
            associationId: association.id,
            name: roleName,
          },
        });

        if (role) {
          for (const permKey of permissionKeys) {
            const permission = await prisma.permission.findUnique({
              where: { key: permKey },
            });

            if (permission) {
              await prisma.rolePermission.upsert({
                where: {
                  roleId_permissionId: {
                    roleId: role.id,
                    permissionId: permission.id,
                  },
                },
                update: {},
                create: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              });
            }
          }
          console.log(`    ✓ ${roleName}: ${permissionKeys.length} permissions`);
        }
      }
    }

    console.log('✅ Help & Support permissions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding help permissions:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedHelpPermissions()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
