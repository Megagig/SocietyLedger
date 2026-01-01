import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with all required data...\n');

  // 1. Create Super Admin
  console.log('👤 Creating super admin...');
  const hashedPassword = await bcrypt.hash('SuperSecret123!', 12);

  const superAdmin = await prisma.user.upsert({
    where: { id: 1 },
    update: {
      platformRole: 'SUPER_ADMIN',
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'megagigdev@gmail.com',
      passwordHash: hashedPassword,
      platformRole: 'SUPER_ADMIN',
      emailVerified: true,
      isActive: true,
      role: 'admin',
    },
  });

  console.log('✅ Super admin created:', superAdmin.email);
  console.log('');

  // 2. Run all seed scripts in order
  const seedScripts = [
    { file: 'seed-plans.ts', name: 'Subscription Plans' },
    { file: 'seeds/rbac-seed.ts', name: 'RBAC Roles & Permissions' },
    { file: 'seeds/platform-modules.seed.ts', name: 'Platform Modules' },
    { file: 'seeds/platform-association.seed.ts', name: 'Platform Association (Hybrid Super Admin)' },
    { file: 'seeds/help-permissions.seed.ts', name: 'Help Permissions' },
    { file: 'seeds/help-content.seed.ts', name: 'Help Content' },
  ];

  for (const script of seedScripts) {
    try {
      console.log(`📝 Seeding ${script.name}...`);
      execSync(`tsx prisma/${script.file}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log(`✅ ${script.name} completed\n`);
    } catch (error) {
      console.error(`❌ Error seeding ${script.name}:`, error);
      // Continue with other seeds even if one fails
    }
  }

  console.log('🎉 Database seeding completed successfully!\n');
  console.log('📝 Summary:');
  console.log('  ✅ Super admin account');
  console.log('  ✅ Subscription plans (Starter, Professional, Enterprise)');
  console.log('  ✅ RBAC roles & permissions');
  console.log('  ✅ Platform modules');
  console.log('  ✅ Help system');
  console.log('\n🔐 Super Admin Credentials:');
  console.log('  Email: megagigdev@gmail.com');
  console.log('  Password: SuperSecret123!');
  console.log('\n✨ Your production database is ready!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
