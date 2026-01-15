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

  // Seed Blog Categories
  console.log('\n📝 Seeding blog categories...');
  const blogCategories = [
    { name: 'Finance', slug: 'finance', description: 'Financial management tips and best practices', color: '#10B981' },
    { name: 'Management', slug: 'management', description: 'Association management strategies', color: '#3B82F6' },
    { name: 'Technology', slug: 'technology', description: 'Technology updates and integrations', color: '#8B5CF6' },
    { name: 'Best Practices', slug: 'best-practices', description: 'Best practices for running successful associations', color: '#F59E0B' },
  ];

  for (const category of blogCategories) {
    await prisma.blogCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  console.log(`✅ Created ${blogCategories.length} blog categories`);

  // Seed Documentation Sections
  console.log('\n📚 Seeding documentation sections...');
  const docSections = [
    { name: 'Getting Started', slug: 'getting-started', description: 'Quick start guide for new users', icon: 'rocket', order: 1 },
    { name: 'Member Management', slug: 'member-management', description: 'Managing members and their data', icon: 'users', order: 2 },
    { name: 'Financial Management', slug: 'financial-management', description: 'Handling finances, payments, and accounting', icon: 'dollar-sign', order: 3 },
    { name: 'Communication', slug: 'communication', description: 'Communication tools and features', icon: 'message-square', order: 4 },
    { name: 'Advanced Features', slug: 'advanced-features', description: 'Advanced features and integrations', icon: 'zap', order: 5 },
    { name: 'Troubleshooting', slug: 'troubleshooting', description: 'Common issues and solutions', icon: 'help-circle', order: 6 },
  ];

  for (const section of docSections) {
    await prisma.docSection.upsert({
      where: { slug: section.slug },
      update: {},
      create: section,
    });
  }
  console.log(`✅ Created ${docSections.length} documentation sections`);

  console.log('\n✨ Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
