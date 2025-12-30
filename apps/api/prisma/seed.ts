import { Prisma, PrismaClient, AssociationTier, AssociationStatus, BillingCycle, SubscriptionStatus, PlatformRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedPlatformModules } from './seeds/platform-modules.seed';
import { seedHelpContent } from './seeds/help-content.seed';

const prisma = new PrismaClient();

async function main() {
  // Seed plans
  const plans = [
    {
      code: 'starter',
      name: 'Starter',
      description: 'For small associations getting started',
      priceMonthly: new Prisma.Decimal('5000'),
      priceAnnual: new Prisma.Decimal('54000'),
      memberLimit: 100,
      features: {
        members: 'Up to 100',
        exports: 'Basic reports',
        notifications: 'Email only',
      },
    },
    {
      code: 'professional',
      name: 'Professional',
      description: 'For growing associations that need automation',
      priceMonthly: new Prisma.Decimal('12000'),
      priceAnnual: new Prisma.Decimal('129600'),
      memberLimit: 500,
      features: {
        members: 'Up to 500',
        exports: 'Excel and PDF',
        notifications: 'Email and SMS',
        accounting: 'Full accounting suite',
      },
    },
    {
      code: 'enterprise',
      name: 'Enterprise',
      description: 'For large or regulated associations',
      priceMonthly: new Prisma.Decimal('0'),
      priceAnnual: new Prisma.Decimal('0'),
      memberLimit: null,
      features: {
        members: 'Unlimited',
        exports: 'Custom and white-label',
        notifications: 'Email, SMS, WhatsApp',
        support: 'Dedicated success manager',
      },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        ...plan,
        isActive: true,
      },
      create: {
        ...plan,
        isActive: true,
      },
    });
  }

  // Seed a default association for local development
  const association = await prisma.association.upsert({
    where: { slug: 'demo-association' },
    update: {},
    create: {
      name: 'Demo Association',
      slug: 'demo-association',
      subdomain: 'demo',
      tier: AssociationTier.STARTER,
      status: AssociationStatus.ACTIVE,
      primaryColor: '#1f2937',
      subscriptionExpiresAt: null,
    },
  });

  // Attach a trial subscription to the demo association if none exists
  const starterPlan = await prisma.plan.findUnique({ where: { code: 'starter' } });

  if (starterPlan) {
    await prisma.subscription.upsert({
      where: { associationId_planId: { associationId: association.id, planId: starterPlan.id } },
      update: {},
      create: {
        associationId: association.id,
        planId: starterPlan.id,
        status: SubscriptionStatus.TRIALING,
        billingCycle: BillingCycle.MONTHLY,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Seed a platform super admin user (no association)
  const superAdminEmail = 'superadmin@societyledger.com';
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail, platformRole: PlatformRole.SUPER_ADMIN },
  });
  if (!existingSuperAdmin) {
    const passwordHash = await bcrypt.hash('SuperSecret123!', 12);
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        role: 'admin',
        platformRole: PlatformRole.SUPER_ADMIN,
        isActive: true,
        userApproval: { create: { approvalStatus: 'approved' } },
      },
    });
    console.log('✅ Super admin user created: superadmin@societyledger.com / SuperSecret123!');
  }

  console.log('✅ Seed completed: plans and demo association created');

  // Seed platform modules and features (Phase 19)
  await seedPlatformModules();

  // Seed help content (Phase 21)
  await seedHelpContent();
}

main()
  .catch((error) => {
    console.error('❌ Seed error', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
