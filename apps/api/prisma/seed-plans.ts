import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('Seeding subscription plans...');

  // Create Starter Plan
  const starterPlan = await prisma.plan.upsert({
    where: { code: 'STARTER' },
    update: {},
    create: {
      name: 'Starter',
      code: 'STARTER',
      description: 'Perfect for small associations getting started',
      priceMonthly: 5000,
      priceAnnual: 50000,
      memberLimit: 100,
      features: {
        memberLimit: 100,
        advancedReporting: false,
        customBranding: false,
        prioritySupport: false,
        apiAccess: false,
        multipleAdmins: false,
      },
      isActive: true,
    },
  });

  console.log('Created Starter plan:', starterPlan.name);

  // Create Professional Plan
  const professionalPlan = await prisma.plan.upsert({
    where: { code: 'PROFESSIONAL' },
    update: {},
    create: {
      name: 'Professional',
      code: 'PROFESSIONAL',
      description: 'Ideal for growing associations with advanced needs',
      priceMonthly: 15000,
      priceAnnual: 150000,
      memberLimit: 500,
      features: {
        memberLimit: 500,
        advancedReporting: true,
        customBranding: true,
        prioritySupport: true,
        apiAccess: false,
        multipleAdmins: true,
      },
      isActive: true,
    },
  });

  console.log('Created Professional plan:', professionalPlan.name);

  // Create Enterprise Plan
  const enterprisePlan = await prisma.plan.upsert({
    where: { code: 'ENTERPRISE' },
    update: {},
    create: {
      name: 'Enterprise',
      code: 'ENTERPRISE',
      description: 'Complete solution for large associations',
      priceMonthly: 35000,
      priceAnnual: 350000,
      memberLimit: null, // Unlimited
      features: {
        memberLimit: null,
        advancedReporting: true,
        customBranding: true,
        prioritySupport: true,
        apiAccess: true,
        multipleAdmins: true,
        dedicatedAccountManager: true,
        customIntegrations: true,
      },
      isActive: true,
    },
  });

  console.log('Created Enterprise plan:', enterprisePlan.name);

  console.log('✅ Plans seeded successfully!');
}

async function main() {
  try {
    await seedPlans();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
