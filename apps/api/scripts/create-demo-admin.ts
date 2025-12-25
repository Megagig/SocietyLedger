import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== CREATING DEMO ADMIN USER ===\n');
  
  // Find demo association
  const demoAssoc = await prisma.association.findUnique({
    where: { subdomain: 'demo' },
  });

  if (!demoAssoc) {
    console.log('❌ Demo association not found! Run seed first.');
    return;
  }

  console.log(`✅ Found demo association: ${demoAssoc.name} (ID: ${demoAssoc.id})`);

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: 'admin@demo.com',
      associationId: demoAssoc.id,
    },
  });

  if (existingAdmin) {
    console.log('ℹ️  Admin user already exists for demo association');
    console.log(`   Email: admin@demo.com`);
    return;
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin',
      associationId: demoAssoc.id,
      isActive: true,
      userApproval: {
        create: {
          approvalStatus: 'approved',
        },
      },
    },
  });

  console.log('\n✅ Demo admin user created successfully!');
  console.log(`   Email: admin@demo.com`);
  console.log(`   Password: password123`);
  console.log(`   Association: ${demoAssoc.name} (${demoAssoc.subdomain})`);
  console.log(`\n🔗 Login at: http://demo.localhost:3000/auth/login\n`);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
