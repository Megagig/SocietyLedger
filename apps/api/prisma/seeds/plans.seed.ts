/**
 * Default subscription plans.
 *
 * Creates Starter, Pro and Enterprise with their launch prices the FIRST time they are seen (a fresh database). It never changes a plan
 * that already exists: after that, the Plan Builder in the admin console is the only place plans, prices, modules and features change, and
 * this script running on every container start must not undo what the owner publishes.
 *
 * Needs the modules seed (platform-modules.seed.ts) to have run first, because a plan version points at module and feature rows.
 */
import { PrismaClient } from '@prisma/client';

const KOBO = 100;

export interface DefaultPlan {
  code: string;
  name: string;
  description: string;
  highlights: string[];
  sortOrder: number;
  isRecommended?: boolean;
  badgeLabel?: string;
  /** Launch prices in naira, stored as kobo. */
  monthlyNaira: number;
  annualNaira: number;
  limits: Record<string, number | null>;
  modules: string[];
  features: string[];
}

/*
 * What each default plan includes. Every module and feature listed here is ENFORCED by a real route (see __tests__/billing/plan-gates.test.ts),
 * so a plan card can only promise what the app actually withholds from the plans below it.
 *
 *  Starter    run the association day to day: members, dues and payments, notifications, reports, meetings.
 *  Pro        add community and governance: welfare, voting and elections, SMS, audit logs, plus exports, bulk tools and custom roles.
 *  Enterprise add accounting, cooperatives and loans, the AI assistant, and custom report exports.
 */
const STARTER_MODULES = ['members', 'ledger', 'payments', 'notifications', 'reports', 'meetings'];
const PRO_MODULES = [...STARTER_MODULES, 'welfare', 'voting', 'sms', 'audit'];
const ENTERPRISE_MODULES = [...PRO_MODULES, 'accounting', 'cooperatives', 'ai'];

const STARTER_FEATURES = ['members.export', 'members.bulk_import', 'ledger.export'];
const PRO_FEATURES = [
  ...STARTER_FEATURES,
  'reports.export_pdf',
  'reports.export_excel',
  'ledger.bulk_transactions',
  'ledger.advanced_penalties',
  'members.custom_roles',
];
const ENTERPRISE_FEATURES = [...PRO_FEATURES, 'reports.custom', 'ai.financial_assistant', 'ai.smart_reports'];

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Perfect for small associations getting started',
    highlights: ['Collect dues online and by bank transfer'],
    sortOrder: 1,
    monthlyNaira: 8_000,
    annualNaira: 80_000,
    limits: { members: 100 },
    modules: STARTER_MODULES,
    features: STARTER_FEATURES,
  },
  {
    code: 'professional',
    name: 'Pro',
    description: 'Ideal for growing associations with advanced needs',
    highlights: ['Everything in Starter'],
    sortOrder: 2,
    isRecommended: true,
    badgeLabel: 'Most popular',
    monthlyNaira: 10_000,
    annualNaira: 100_000,
    limits: { members: 500 },
    modules: PRO_MODULES,
    features: PRO_FEATURES,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Complete solution for large associations',
    highlights: ['Everything in Pro'],
    sortOrder: 3,
    monthlyNaira: 15_000,
    annualNaira: 150_000,
    limits: {},
    modules: ENTERPRISE_MODULES,
    features: ENTERPRISE_FEATURES,
  },
];

export async function seedDefaultPlans(prisma: PrismaClient): Promise<{ created: string[]; kept: string[] }> {
  const created: string[] = [];
  const kept: string[] = [];

  for (const def of DEFAULT_PLANS) {
    if (await prisma.plan.findUnique({ where: { code: def.code } })) {
      kept.push(def.code);
      continue;
    }

    const [modules, features, core] = await Promise.all([
      prisma.platformModule.findMany({ where: { code: { in: def.modules } } }),
      prisma.platformFeature.findMany({ where: { code: { in: def.features } } }),
      prisma.platformModule.findMany({ where: { isCore: true }, select: { id: true } }),
    ]);
    const missing = [...def.modules.filter((c) => !modules.some((m) => m.code === c)), ...def.features.filter((c) => !features.some((f) => f.code === c))];
    if (missing.length) {
      throw new Error(`Cannot seed the ${def.name} plan: these modules/features do not exist yet (${missing.join(', ')}). Run platform-modules.seed.ts first.`);
    }
    const coreFeatures = await prisma.platformFeature.findMany({ where: { isCore: true }, select: { id: true } });

    await prisma.plan.create({
      data: {
        code: def.code,
        name: def.name,
        description: def.description,
        highlights: def.highlights,
        sortOrder: def.sortOrder,
        isRecommended: def.isRecommended ?? false,
        badgeLabel: def.badgeLabel ?? null,
        versions: {
          create: {
            version: 1,
            status: 'PUBLISHED',
            priceMonthlyKobo: def.monthlyNaira * KOBO,
            priceAnnualKobo: def.annualNaira * KOBO,
            limits: def.limits,
            changeNote: 'Launch pricing',
            publishedAt: new Date(),
            modules: { create: [...new Set([...modules.map((m) => m.id), ...core.map((c) => c.id)])].map((moduleId) => ({ moduleId })) },
            features: { create: [...new Set([...features.map((f) => f.id), ...coreFeatures.map((c) => c.id)])].map((featureId) => ({ featureId })) },
          },
        },
      },
    });
    created.push(def.code);
  }
  return { created, kept };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { created, kept } = await seedDefaultPlans(prisma);
    console.log(`Plans: created ${created.length ? created.join(', ') : 'none'}; left alone ${kept.length ? kept.join(', ') : 'none'}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error seeding plans:', error);
    process.exit(1);
  });
}
