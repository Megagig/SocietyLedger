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

const BASE_MODULES = ['members', 'ledger', 'payments', 'notifications'];
const PRO_MODULES = [...BASE_MODULES, 'reports', 'audit', 'welfare', 'voting', 'meetings', 'sms'];
const ENTERPRISE_MODULES = [...PRO_MODULES, 'accounting', 'cooperatives', 'integrations', 'ai'];

const PRO_FEATURES = [
  'members.bulk_import',
  'members.custom_roles',
  'members.export',
  'ledger.export',
  'ledger.bulk_transactions',
  'ledger.advanced_penalties',
  'reports.export_pdf',
  'reports.export_excel',
  'audit.export',
];

export const DEFAULT_PLANS: DefaultPlan[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Perfect for small associations getting started',
    highlights: ['Member records and dues', 'Online and bank-transfer payments', 'Notifications to members'],
    sortOrder: 1,
    monthlyNaira: 8_000,
    annualNaira: 80_000,
    limits: { members: 100 },
    modules: BASE_MODULES,
    features: ['members.export'],
  },
  {
    code: 'professional',
    name: 'Pro',
    description: 'Ideal for growing associations with advanced needs',
    highlights: ['Everything in Starter', 'Reports and exports', 'Meetings, voting and welfare', 'SMS to members'],
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
    highlights: ['Everything in Pro', 'Accounting and cooperatives', 'AI assistant', 'Unlimited members'],
    sortOrder: 3,
    monthlyNaira: 15_000,
    annualNaira: 150_000,
    limits: {},
    modules: ENTERPRISE_MODULES,
    features: [
      ...PRO_FEATURES,
      'reports.custom',
      'reports.scheduled',
      'audit.advanced',
      'integrations.api_access',
      'integrations.webhooks',
      'ai.financial_assistant',
      'ai.smart_reports',
      'ai.document_qa',
    ],
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
