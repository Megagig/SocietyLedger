import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== CHECKING USERS IN DATABASE ===\n');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      platformRole: true,
      associationId: true,
      isActive: true,
      association: {
        select: {
          id: true,
          name: true,
          subdomain: true,
        },
      },
    },
  });

  if (users.length === 0) {
    console.log('❌ No users found in database!\n');
  } else {
    console.log(`✅ Found ${users.length} user(s):\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Platform Role: ${user.platformRole || 'none'}`);
      console.log(`   Association: ${user.association?.name || 'None (Platform Admin)'}`);
      console.log(`   Subdomain: ${user.association?.subdomain || 'N/A'}`);
      console.log(`   Active: ${user.isActive}`);
      console.log('');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
