/**
 * Thrift (Ajo) add-on: the four tiers (Track T1.2).
 *
 * Like plans.seed.ts, this creates a tier the FIRST time it is seen and never changes one that exists: after that the Plan Builder in the
 * admin console is the only place the add-on's prices, limits, modules and features change, and this script running on every container
 * start must not undo what the owner publishes.
 *
 * The tiers are separate add-ons in one family ('ajo'), so a tenant holds exactly one and changing tier swaps it. Each carries the quota
 * `ajoContributors` (active contributors across the tenant). Prices are the owner's decision of 2026-10-27; annual is 10 x monthly.
 *
 * It also creates the base plan a standalone thrift group sits on (`thrift-group`): core modules only and no price, offered only to
 * standalone thrift groups. The group pays through the Ajo tier it picks; the plan is what lets the subscription exist.
 *
 * Needs platform-modules.seed.ts to have run first (the add-on points at the `ajo` module and its features).
 */
import { PrismaClient } from '@prisma/client';

const KOBO = 100;

export const AJO_FAMILY = 'ajo';
export const THRIFT_GROUP_PLAN_CODE = 'thrift-group';

export interface AjoTier {
  code: string;
  name: string;
  description: string;
  highlights: string[];
  sortOrder: number;
  monthlyNaira: number;
  annualNaira: number;
  /** Null = unlimited (Enterprise, priced by agreement). */
  contributors: number | null;
  /** Enterprise is agreed with the customer and granted by staff; it is not on the public price list. */
  isPublic: boolean;
  features: string[];
}

const STARTER_FEATURES = ['ajo.rotating_pot', 'ajo.guarantors'];
const GROWTH_FEATURES = [...STARTER_FEATURES, 'ajo.collector_thrift', 'ajo.reminders', 'ajo.advanced_reports'];

/** The trial a standalone thrift group starts on. Not for sale: it never appears on a price list and cannot be bought. */
export const AJO_TRIAL_TIER: AjoTier = {
  code: 'ajo-trial',
  name: 'Ajo trial',
  description: 'Free trial: everything in Growth, up to 30 active contributors.',
  highlights: ['Up to 30 active contributors', 'Collector thrift and reminders'],
  sortOrder: 0,
  monthlyNaira: 0,
  annualNaira: 0,
  contributors: 30,
  isPublic: false,
  features: GROWTH_FEATURES,
};

export const AJO_TIERS: AjoTier[] = [
  {
    code: 'ajo-starter',
    name: 'Ajo Starter',
    description: 'Run a small savings circle: groups, schedules, a member ledger and basic reports.',
    highlights: ['Up to 30 active contributors', 'Group management and schedules', 'Member ledger and basic reports'],
    sortOrder: 1,
    monthlyNaira: 3_000,
    annualNaira: 30_000,
    contributors: 30,
    isPublic: true,
    features: STARTER_FEATURES,
  },
  {
    code: 'ajo-growth',
    name: 'Ajo Growth',
    description: 'For collectors and growing groups: collector tools, reminders and payout tracking.',
    highlights: ['31 to 150 active contributors', 'Collector management', 'Automated reminders', 'Payout tracking and advanced reports'],
    sortOrder: 2,
    monthlyNaira: 8_000,
    annualNaira: 80_000,
    contributors: 150,
    isPublic: true,
    features: GROWTH_FEATURES,
  },
  {
    code: 'ajo-business',
    name: 'Ajo Business',
    description: 'For large groups: expanded administration, audit reports and finer permissions.',
    highlights: ['151 to 500 active contributors', 'Everything in Growth', 'Expanded administration and audit reports'],
    sortOrder: 3,
    monthlyNaira: 20_000,
    annualNaira: 200_000,
    contributors: 500,
    isPublic: true,
    features: GROWTH_FEATURES,
  },
  {
    code: 'ajo-enterprise',
    name: 'Ajo Enterprise',
    description: 'More than 500 contributors: custom pricing, onboarding and support.',
    highlights: ['More than 500 active contributors', 'Everything in Business', 'Onboarding and support'],
    sortOrder: 4,
    monthlyNaira: 40_000,
    annualNaira: 400_000,
    contributors: null,
    isPublic: false,
    features: GROWTH_FEATURES,
  },
];

export async function seedAjoAddons(prisma: PrismaClient): Promise<{ created: string[]; kept: string[] }> {
  const created: string[] = [];
  const kept: string[] = [];

  const ajo = await prisma.platformModule.findUnique({ where: { code: 'ajo' } });
  if (!ajo) throw new Error('Cannot seed the Ajo add-ons: the "ajo" module does not exist yet. Run platform-modules.seed.ts first.');

  for (const tier of [...AJO_TIERS, AJO_TRIAL_TIER]) {
    if (await prisma.addon.findUnique({ where: { code: tier.code } })) {
      kept.push(tier.code);
      continue;
    }
    const features = await prisma.platformFeature.findMany({ where: { code: { in: tier.features } } });
    const missing = tier.features.filter((c) => !features.some((f) => f.code === c));
    if (missing.length) throw new Error(`Cannot seed ${tier.name}: these features do not exist yet (${missing.join(', ')}). Run platform-modules.seed.ts first.`);

    await prisma.addon.create({
      data: {
        code: tier.code,
        name: tier.name,
        description: tier.description,
        highlights: tier.highlights,
        family: AJO_FAMILY,
        isPublic: tier.isPublic,
        sortOrder: tier.sortOrder,
        versions: {
          create: {
            version: 1,
            status: 'PUBLISHED',
            priceMonthlyKobo: tier.monthlyNaira * KOBO,
            priceAnnualKobo: tier.annualNaira * KOBO,
            limits: { ajoContributors: tier.contributors },
            changeNote: 'Launch pricing',
            publishedAt: new Date(),
            modules: { create: [{ moduleId: ajo.id }] },
            features: { create: features.map((f) => ({ featureId: f.id })) },
          },
        },
      },
    });
    created.push(tier.code);
  }
  return { created, kept };
}

/** The base plan for standalone thrift groups. Created once, never changed afterwards (the Plan Builder owns it from then on). */
export async function seedThriftGroupPlan(prisma: PrismaClient): Promise<'created' | 'kept'> {
  if (await prisma.plan.findUnique({ where: { code: THRIFT_GROUP_PLAN_CODE } })) return 'kept';
  const [coreModules, coreFeatures] = await Promise.all([
    prisma.platformModule.findMany({ where: { isCore: true }, select: { id: true } }),
    prisma.platformFeature.findMany({ where: { isCore: true }, select: { id: true } }),
  ]);
  await prisma.plan.create({
    data: {
      code: THRIFT_GROUP_PLAN_CODE,
      name: 'Thrift group',
      description: 'The base for a standalone thrift group. Choose an Ajo tier to go with it.',
      highlights: ['Run your group on SocietyLedger', 'Pay only for the Ajo tier you need'],
      audience: 'THRIFT_GROUP',
      sortOrder: 1,
      versions: {
        create: {
          version: 1,
          status: 'PUBLISHED',
          priceMonthlyKobo: 0,
          priceAnnualKobo: 0,
          limits: {},
          changeNote: 'Base plan for standalone thrift groups',
          publishedAt: new Date(),
          modules: { create: coreModules.map((m) => ({ moduleId: m.id })) },
          features: { create: coreFeatures.map((f) => ({ featureId: f.id })) },
        },
      },
    },
  });
  return 'created';
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`Thrift group base plan: ${await seedThriftGroupPlan(prisma)}`);
    const { created, kept } = await seedAjoAddons(prisma);
    console.log(`Ajo add-ons: created ${created.length ? created.join(', ') : 'none'}; left alone ${kept.length ? kept.join(', ') : 'none'}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error seeding the Ajo add-ons:', error);
    process.exit(1);
  });
}
