import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash the password
  const hashedPassword = await bcrypt.hash('SuperSecret123!', 12);

  // Create super admin user (no association - platform level)
  const superAdmin = await prisma.user.upsert({
    where: { 
      id: 1 // Use ID for upsert since email alone isn't unique (needs associationId)
    },
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
      role: 'admin', // Association role (not used for platform admin but required)
    },
  });

  console.log('✅ Super admin created/updated:');
  console.log('📧 Email:', superAdmin.email);
  console.log('🔑 Password: SuperSecret123!');
  console.log('👑 Platform Role:', superAdmin.platformRole);
  console.log('✓ Email Verified:', superAdmin.emailVerified);
  console.log('✓ Active:', superAdmin.isActive);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
