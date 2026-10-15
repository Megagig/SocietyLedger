import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

// Permission Registry from the prompt - MUST be used exactly as provided
const PERMISSION_REGISTRY = [
  {
    key: "members.view",
    description: "View member profiles and basic details.",
    module: "Members",
    examples: ["GET /api/members", "Member list pages in UI"]
  },
  {
    key: "members.view_own",
    description: "View own member profile only.",
    module: "Members",
    examples: ["GET /api/members/me", "Personal dashboard"]
  },
  {
    key: "members.view_all",
    description: "View all members' profiles.",
    module: "Members",
    examples: ["GET /api/members (admin/tresurer roles)", "Admin member management"]
  },
  {
    key: "members.create",
    description: "Create new member records.",
    module: "Members",
    examples: ["POST /api/members", "Onboarding flows"]
  },
  {
    key: "members.edit",
    description: "Edit member details.",
    module: "Members",
    examples: ["PUT /api/members/:id", "Member edit forms"]
  },
  {
    key: "members.edit_own",
    description: "Edit own member details only.",
    module: "Members",
    examples: ["PUT /api/members/me", "Self-service profile updates"]
  },
  {
    key: "members.edit_all",
    description: "Edit any member's details.",
    module: "Members",
    examples: ["PUT /api/members/:id (admin roles)", "Bulk member updates"]
  },
  {
    key: "members.disable",
    description: "Disable or deactivate members.",
    module: "Members",
    examples: ["DELETE /api/members/:id", "Member deactivation endpoints"]
  },
  {
    key: "members.bulk_import",
    description: "Import members in bulk via CSV/Excel.",
    module: "Members",
    examples: ["POST /api/members/bulk-import", "Background job for imports"]
  },
  {
    key: "members.manage_roles",
    description: "Assign or change member roles.",
    module: "Members",
    examples: ["PUT /api/members/:id/role", "Role assignment in admin UI"]
  },
  {
    key: "ledger.view",
    description: "View ledger entries.",
    module: "Finance/Ledger",
    examples: ["GET /api/ledger", "Ledger list pages"]
  },
  {
    key: "ledger.view_own",
    description: "View own ledger entries (e.g., personal transactions).",
    module: "Finance/Ledger",
    examples: ["GET /api/ledger/me", "Member financial dashboard"]
  },
  {
    key: "ledger.view_all",
    description: "View all ledger entries.",
    module: "Finance/Ledger",
    examples: ["GET /api/ledger (admin/tresurer)", "Full ledger reports"]
  },
  {
    key: "ledger.create",
    description: "Create new ledger entries.",
    module: "Finance/Ledger",
    examples: ["POST /api/ledger", "Transaction recording"]
  },
  {
    key: "ledger.edit",
    description: "Edit ledger entries.",
    module: "Finance/Ledger",
    examples: ["PUT /api/ledger/:id", "Transaction corrections"]
  },
  {
    key: "ledger.reverse",
    description: "Reverse or void ledger transactions.",
    module: "Finance/Ledger",
    examples: ["POST /api/ledger/:id/reverse", "Reversal endpoints"]
  },
  {
    key: "ledger.export",
    description: "Export ledger data to CSV/PDF.",
    module: "Finance/Ledger",
    examples: ["GET /api/ledger/export", "Export buttons in reports"]
  },
  {
    key: "ledger.view_member_statement",
    description: "View detailed member financial statements.",
    module: "Finance/Ledger",
    examples: ["GET /api/ledger/statements/:memberId", "Statement generation"]
  },
  {
    key: "payments.view",
    description: "View payment records.",
    module: "Payments",
    examples: ["GET /api/payments", "Payment history pages"]
  },
  {
    key: "payments.view_own",
    description: "View own payment records.",
    module: "Payments",
    examples: ["GET /api/payments/me", "Personal payment dashboard"]
  },
  {
    key: "payments.view_all",
    description: "View all payments.",
    module: "Payments",
    examples: ["GET /api/payments (admin)", "Full payment reports"]
  },
  {
    key: "payments.manual_create",
    description: "Manually create payment records.",
    module: "Payments",
    examples: ["POST /api/payments/manual", "Manual payment entry"]
  },
  {
    key: "payments.approve",
    description: "Approve pending payments.",
    module: "Payments",
    examples: ["PUT /api/payments/:id/approve", "Approval workflows"]
  },
  {
    key: "payments.delete",
    description: "Delete payment records.",
    module: "Payments",
    examples: ["DELETE /api/payments/:id", "Payment removal"]
  },
  {
    key: "reports.generate",
    description: "Generate basic reports.",
    module: "Reports",
    examples: ["GET /api/reports/basic", "Report generation endpoints"]
  },
  {
    key: "reports.export",
    description: "Export reports to files.",
    module: "Reports",
    examples: ["GET /api/reports/export", "Export functionality"]
  },
  {
    key: "reports.financial_summary",
    description: "Access financial summary reports.",
    module: "Reports",
    examples: ["GET /api/reports/summary", "Summary dashboards"]
  },
  {
    key: "roles.view",
    description: "View roles and their permissions.",
    module: "Roles & Permissions",
    examples: ["GET /api/roles", "Role list pages"]
  },
  {
    key: "roles.create",
    description: "Create new roles.",
    module: "Roles & Permissions",
    examples: ["POST /api/roles", "Role creation forms"]
  },
  {
    key: "roles.edit",
    description: "Edit existing roles.",
    module: "Roles & Permissions",
    examples: ["PUT /api/roles/:id", "Role editing"]
  },
  {
    key: "roles.assign",
    description: "Assign roles to users.",
    module: "Roles & Permissions",
    examples: ["PUT /api/users/:id/role", "Role assignment"]
  },
  {
    key: "permissions.manage",
    description: "Manage permissions (assign to roles).",
    module: "Roles & Permissions",
    examples: ["PUT /api/roles/:id/permissions", "Permission management UI"]
  },
  {
    key: "settings.view",
    description: "View application settings.",
    module: "Settings",
    examples: ["GET /api/settings", "Settings pages"]
  },
  {
    key: "settings.edit",
    description: "Edit application settings.",
    module: "Settings",
    examples: ["PUT /api/settings", "Settings forms"]
  },
  {
    key: "settings.billing",
    description: "Manage billing and subscription settings.",
    module: "Settings",
    examples: ["PUT /api/settings/billing", "Billing configuration"]
  },
  {
    key: "settings.integrations",
    description: "Configure third-party integrations.",
    module: "Settings",
    examples: ["PUT /api/settings/integrations", "Integration setup"]
  },
  {
    key: "audit.view",
    description: "View audit logs.",
    module: "Audit & Compliance",
    examples: ["GET /api/audit", "Audit log pages"]
  },
  {
    key: "audit.export",
    description: "Export audit logs.",
    module: "Audit & Compliance",
    examples: ["GET /api/audit/export", "Audit exports"]
  },
  // Nigerian Payments
  {
    key: "payments.nigerian.view",
    description: "View Nigerian payment records and transfers.",
    module: "Nigerian Payments",
    examples: ["GET /api/payments/nigerian/transfers", "Payment dashboard"]
  },
  {
    key: "payments.nigerian.record",
    description: "Record bank transfers and upload payment proofs.",
    module: "Nigerian Payments",
    examples: ["POST /api/payments/nigerian/transfers", "Record payment page"]
  },
  {
    key: "payments.nigerian.verify",
    description: "Verify and approve payment proofs.",
    module: "Nigerian Payments",
    examples: ["PUT /api/payments/nigerian/transfers/:id/verify", "Verification queue"]
  },
  {
    key: "payments.nigerian.reconcile",
    description: "Reconcile bank statements with transactions.",
    module: "Nigerian Payments",
    examples: ["POST /api/payments/nigerian/reconcile", "Reconciliation page"]
  },
  {
    key: "payments.nigerian.import",
    description: "Import bank statements via CSV.",
    module: "Nigerian Payments",
    examples: ["POST /api/payments/nigerian/import", "Import page"]
  },
  // SMS & Communications
  {
    key: "communication.sms.view",
    description: "View SMS messages and campaigns.",
    module: "SMS Communications",
    examples: ["GET /api/communication/sms", "SMS dashboard"]
  },
  {
    key: "communication.sms.send",
    description: "Send SMS messages and create campaigns.",
    module: "SMS Communications",
    examples: ["POST /api/communication/sms/send", "Quick send page"]
  },
  {
    key: "communication.sms.campaign",
    description: "Manage SMS campaigns.",
    module: "SMS Communications",
    examples: ["POST /api/communication/campaigns", "Campaign management"]
  },
  {
    key: "communication.sms.template",
    description: "Manage SMS templates.",
    module: "SMS Communications",
    examples: ["POST /api/communication/templates", "Template management"]
  },
  // Notifications & Announcements
  {
    key: "notifications.view",
    description: "View notifications.",
    module: "Notifications",
    examples: ["GET /api/notifications", "Notifications center"]
  },
  {
    key: "notifications.send",
    description: "Send announcements and broadcast notifications.",
    module: "Notifications",
    examples: ["POST /api/notifications/announcements", "Create announcement"]
  },
  // Meetings
  {
    key: "meetings.manage_minutes",
    description: "Create, edit and approve official meeting minutes.",
    module: "Meetings",
    examples: ["POST /api/meetings/:id/minutes", "POST /api/meetings/:id/minutes/approve"]
  },
  {
    key: "meetings.manage_attendance",
    description: "Initialize and mark meeting attendance.",
    module: "Meetings",
    examples: ["POST /api/meetings/:id/attendance/initialize", "POST /api/meetings/:id/attendance"]
  },
  // Exports
  {
    key: "exports.financial",
    description: "Export financial reports (PDF/Excel).",
    module: "Exports",
    examples: ["POST /api/exports/financial", "Export data page"]
  },
  {
    key: "exports.members",
    description: "Export member data.",
    module: "Exports",
    examples: ["POST /api/exports/members", "Member exports"]
  },
  {
    key: "exports.view_history",
    description: "View and download export history.",
    module: "Exports",
    examples: ["GET /api/exports/history", "Export history page"]
  },
  // Cron Jobs & System
  {
    key: "system.cron.view",
    description: "View cron job status and history.",
    module: "System",
    examples: ["GET /api/cron/status", "Cron jobs dashboard"]
  },
  {
    key: "system.cron.trigger",
    description: "Manually trigger cron jobs.",
    module: "System",
    examples: ["POST /api/cron/trigger/:job", "Manual job execution"]
  }
];

// Map existing hardcoded roles to new permission keys
const ROLE_PERMISSION_MAPPING = {
  admin: [
    "members.view", "members.view_all", "members.view_own", "members.create", "members.edit", "members.edit_all", "members.edit_own",
    "members.disable", "members.bulk_import", "members.manage_roles",
    "ledger.view", "ledger.view_all", "ledger.view_own", "ledger.create", "ledger.edit", "ledger.reverse", 
    "ledger.export", "ledger.view_member_statement",
    "payments.view", "payments.view_all", "payments.view_own", "payments.manual_create", "payments.approve", "payments.delete",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.verify", "payments.nigerian.reconcile", "payments.nigerian.import",
    "reports.generate", "reports.export", "reports.financial_summary",
    "roles.view", "roles.create", "roles.edit", "roles.assign", "permissions.manage",
    "settings.view", "settings.edit", "settings.billing", "settings.integrations",
    "audit.view", "audit.export",
    "communication.sms.view", "communication.sms.send", "communication.sms.campaign", "communication.sms.template",
    "notifications.view", "notifications.send",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "system.cron.view", "system.cron.trigger"
  ],
  treasurer: [
    "members.view", "members.view_all",
    "ledger.view", "ledger.view_all", "ledger.create", "ledger.edit", "ledger.export",
    "ledger.view_member_statement",
    "payments.view", "payments.view_all", "payments.manual_create", "payments.approve",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.verify", "payments.nigerian.reconcile", "payments.nigerian.import",
    "reports.generate", "reports.export", "reports.financial_summary",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "communication.sms.view",
    "notifications.view",
    "settings.view"
  ],
  financial_secretary: [
    "members.view", "members.view_all",
    "ledger.view", "ledger.view_all", "ledger.create", "ledger.edit", "ledger.export",
    "payments.view", "payments.view_all", "payments.manual_create",
    "payments.nigerian.view", "payments.nigerian.record", "payments.nigerian.reconcile", "payments.nigerian.import",
    "reports.generate", "reports.export", "reports.financial_summary",
    "exports.financial", "exports.members", "exports.view_history",
    "meetings.manage_minutes", "meetings.manage_attendance",
    "communication.sms.view",
    "notifications.view",
    "settings.view"
  ],
  member: [
    "members.view_own", "members.edit_own",
    "ledger.view_own",
    "payments.view_own",
    "payments.nigerian.view",
    "reports.generate",
    "notifications.view",
    "exports.view_history"
  ]
};

export async function seedRBACSystem() {
  console.log('🔐 Seeding RBAC System...');

  try {
    // 1. Seed Permissions
    console.log('📋 Seeding permissions...');
    for (const permissionData of PERMISSION_REGISTRY) {
      await prisma.permission.upsert({
        where: { key: permissionData.key },
        update: {
          description: permissionData.description,
          module: permissionData.module,
          examples: permissionData.examples,
        },
        create: {
          key: permissionData.key,
          description: permissionData.description,
          module: permissionData.module,
          examples: permissionData.examples,
        },
      });
    }
    console.log(`✅ Seeded ${PERMISSION_REGISTRY.length} permissions`);

    // 2. Create System Roles (Platform-level)
    console.log('👑 Creating platform roles...');
    
    // Super Admin Role (Platform-level, no association)
    // Note: Can't use upsert with null in composite unique, so use findFirst + create/update
    let superAdminRole = await prisma.role.findFirst({
      where: { 
        associationId: null, 
        name: 'super_admin' 
      }
    });

    if (superAdminRole) {
      superAdminRole = await prisma.role.update({
        where: { id: superAdminRole.id },
        data: {
          displayName: 'Super Administrator',
          description: 'Platform-wide administrative access',
          isSystemRole: true,
        }
      });
    } else {
      superAdminRole = await prisma.role.create({
        data: {
          associationId: null,
          name: 'super_admin',
          displayName: 'Super Administrator',
          description: 'Platform-wide administrative access',
          isSystemRole: true,
        }
      });
    }

    // Assign ALL permissions to super admin
    const allPermissions = await prisma.permission.findMany();
    for (const permission of allPermissions) {
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

    console.log('✅ Created platform roles');

    // 3. Create Association-level System Roles for each association
    console.log('🏢 Creating association system roles...');
    
    const associations = await prisma.association.findMany();
    
    for (const association of associations) {
      console.log(`  Creating roles for association: ${association.name}`);
      
      // Create system roles for this association
      for (const [roleName, permissionKeys] of Object.entries(ROLE_PERMISSION_MAPPING)) {
        const role = await prisma.role.upsert({
          where: {
            associationId_name: {
              associationId: association.id,
              name: roleName,
            },
          },
          update: {
            displayName: roleName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `System role: ${roleName}`,
            isSystemRole: true,
          },
          create: {
            associationId: association.id,
            name: roleName,
            displayName: roleName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `System role: ${roleName}`,
            isSystemRole: true,
          },
        });

        // Assign permissions to role
        for (const permissionKey of permissionKeys) {
          const permission = await prisma.permission.findUnique({
            where: { key: permissionKey },
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
      }
    }

    console.log('✅ Created association system roles');

    // 4. Migrate existing users to new RBAC system
    console.log('👥 Migrating existing users to RBAC...');
    
    const users = await prisma.user.findMany({
      where: {
        associationId: { not: undefined },
        role: { not: '' },
      },
    });

    // Filter out users without associationId or role
    const validUsers = users.filter(u => u.associationId !== null && u.role !== null && u.role !== '');

    for (const user of validUsers) {
      if (!user.associationId || !user.role) continue;

      // Find the corresponding role in the new system
      const newRole = await prisma.role.findFirst({
        where: {
          associationId: user.associationId,
          name: user.role,
        },
      });

      if (newRole) {
        // Create UserRole entry
        await prisma.userRole.upsert({
          where: {
            userId_roleId_associationId: {
              userId: user.id,
              roleId: newRole.id,
              associationId: user.associationId,
            },
          },
          update: {
            isActive: true,
          },
          create: {
            userId: user.id,
            roleId: newRole.id,
            associationId: user.associationId,
            isActive: true,
          },
        });
      }
    }

    console.log(`✅ Migrated ${validUsers.length} users to RBAC system`);

    console.log('🎉 RBAC System seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding RBAC system:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedRBACSystem()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}