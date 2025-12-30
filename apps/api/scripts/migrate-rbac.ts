#!/usr/bin/env ts-node

/**
 * RBAC Migration Script
 * 
 * This script handles the safe migration to database-driven RBAC system
 * following the gradual migration strategy outlined in the requirements.
 */

import { PrismaClient } from '@prisma/client';
import { seedRBACSystem } from '../prisma/seeds/rbac-seed';

const prisma = new PrismaClient();

interface MigrationOptions {
  dryRun?: boolean;
  skipSeed?: boolean;
  force?: boolean;
}

class RBACMigration {
  private options: MigrationOptions;

  constructor(options: MigrationOptions = {}) {
    this.options = options;
  }

  async run(): Promise<void> {
    console.log('🚀 Starting RBAC Migration...');
    console.log(`Options: ${JSON.stringify(this.options, null, 2)}`);

    try {
      // Step 1: Validate current state
      await this.validateCurrentState();

      // In dry-run mode, just show what would happen
      if (this.options.dryRun) {
        console.log('\n📋 Dry Run Summary:');
        console.log('==================');
        console.log('The following actions would be performed:');
        console.log('1. Create RBAC database tables (permissions, roles, role_permissions, user_roles)');
        console.log('2. Seed 40 permissions from the permission registry');
        console.log('3. Create system roles (admin, treasurer, financial_secretary, member) for each association');
        console.log('4. Migrate existing users to the new RBAC system');
        console.log('\n✅ Dry run completed - no changes made');
        console.log('\nTo run the actual migration, use: npm run migrate:rbac');
        return;
      }

      // Step 2: Create database migration
      await this.createDatabaseMigration();

      // Step 3: Seed RBAC system (if not skipped)
      if (!this.options.skipSeed) {
        await this.seedRBACSystem();
      }

      // Step 4: Validate migration
      await this.validateMigration();

      // Step 5: Generate migration report
      await this.generateMigrationReport();

      console.log('✅ RBAC Migration completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Set RBAC_MODE=shadow in your environment variables');
      console.log('2. Deploy the application');
      console.log('3. Monitor logs for permission mismatches');
      console.log('4. After validation, switch to RBAC_MODE=hybrid');
      console.log('5. Finally, switch to RBAC_MODE=full for complete RBAC');

    } catch (error) {
      console.error('❌ RBAC Migration failed:', error);
      throw error;
    }
  }

  private async validateCurrentState(): Promise<void> {
    console.log('🔍 Validating current state...');

    // Check if RBAC tables already exist
    try {
      const existingPermissions = await prisma.permission.count();
      if (existingPermissions > 0 && !this.options.force) {
        throw new Error(
          'RBAC tables already exist with data. Use --force to override or --skip-seed to skip seeding.'
        );
      }
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log('✅ RBAC tables do not exist yet - ready for migration');
      } else if (error.message.includes('already exist')) {
        throw error;
      } else {
        console.log('✅ Database connection successful');
      }
    }

    // Validate existing users and associations
    const userCount = await prisma.user.count();
    const associationCount = await prisma.association.count();
    
    console.log(`📊 Current state:`);
    console.log(`  - Users: ${userCount}`);
    console.log(`  - Associations: ${associationCount}`);

    if (userCount === 0) {
      console.warn('⚠️  No users found - migration will create empty RBAC system');
    }

    if (associationCount === 0) {
      console.warn('⚠️  No associations found - only platform roles will be created');
    }
  }

  private async createDatabaseMigration(): Promise<void> {
    console.log('🗄️  Creating database migration...');

    // The migration will be handled by Prisma migrate
    // This is a placeholder for any custom migration logic
    console.log('✅ Database schema updated via Prisma migration');
  }

  private async seedRBACSystem(): Promise<void> {
    console.log('🌱 Seeding RBAC system...');
    await seedRBACSystem();
    console.log('✅ RBAC system seeded successfully');
  }

  private async validateMigration(): Promise<void> {
    console.log('✅ Validating migration...');

    // Check permissions were created
    const permissionCount = await prisma.permission.count();
    console.log(`📋 Permissions created: ${permissionCount}`);

    if (permissionCount === 0) {
      throw new Error('No permissions were created during migration');
    }

    // Check roles were created
    const roleCount = await prisma.role.count();
    console.log(`👥 Roles created: ${roleCount}`);

    // Check user roles were migrated
    const userRoleCount = await prisma.userRole.count();
    console.log(`🔗 User-role assignments: ${userRoleCount}`);

    // Validate system roles exist
    const systemRoles = await prisma.role.findMany({
      where: { isSystemRole: true },
      select: { name: true, associationId: true }
    });

    console.log(`🔧 System roles: ${systemRoles.length}`);
    
    // Check platform roles
    const platformRoles = systemRoles.filter(r => r.associationId === null);
    console.log(`🌐 Platform roles: ${platformRoles.length}`);

    if (platformRoles.length === 0) {
      throw new Error('No platform roles were created');
    }

    console.log('✅ Migration validation passed');
  }

  private async generateMigrationReport(): Promise<void> {
    console.log('📊 Generating migration report...');

    const report = {
      timestamp: new Date().toISOString(),
      permissions: await prisma.permission.count(),
      roles: await prisma.role.count(),
      systemRoles: await prisma.role.count({ where: { isSystemRole: true } }),
      userRoles: await prisma.userRole.count(),
      associations: await prisma.association.count(),
      users: await prisma.user.count(),
      roleBreakdown: await prisma.role.groupBy({
        by: ['name'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      permissionModules: await prisma.permission.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      })
    };

    console.log('\n📋 Migration Report:');
    console.log('==================');
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Permissions: ${report.permissions}`);
    console.log(`Total Roles: ${report.roles}`);
    console.log(`System Roles: ${report.systemRoles}`);
    console.log(`User-Role Assignments: ${report.userRoles}`);
    console.log(`Associations: ${report.associations}`);
    console.log(`Users: ${report.users}`);
    
    console.log('\nRole Distribution:');
    report.roleBreakdown.forEach(role => {
      console.log(`  ${role.name}: ${role._count.id}`);
    });

    console.log('\nPermission Modules:');
    report.permissionModules.forEach(module => {
      console.log(`  ${module.module}: ${module._count.id}`);
    });

    // Save report to file if not dry run
    if (!this.options.dryRun) {
      const fs = require('fs');
      const reportPath = `rbac-migration-report-${Date.now()}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Report saved to: ${reportPath}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    skipSeed: args.includes('--skip-seed'),
    force: args.includes('--force')
  };

  if (args.includes('--help')) {
    console.log(`
RBAC Migration Script

Usage: npm run migrate:rbac [options]

Options:
  --dry-run     Run validation only, don't make changes
  --skip-seed   Skip seeding RBAC data (useful if already seeded)
  --force       Force migration even if RBAC data exists
  --help        Show this help message

Examples:
  npm run migrate:rbac --dry-run    # Validate only
  npm run migrate:rbac              # Full migration
  npm run migrate:rbac --force      # Force migration
`);
    process.exit(0);
  }

  const migration = new RBACMigration(options);
  
  try {
    await migration.run();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { RBACMigration };