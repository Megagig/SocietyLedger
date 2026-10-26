/**
 * Moves the default plans (Starter, Pro, Enterprise) to the modules and features in `prisma/seeds/plans.seed.ts`.
 *
 * Seeds never change a plan that already exists, so a database that was seeded earlier keeps its old allocation. Run this once to bring
 * it in line. For each default plan whose included modules or features differ from the seed, it publishes a NEW VERSION through the Plan
 * Builder's own path (so it is audited, with a reason) and leaves prices, limits, names and copy exactly as they are.
 *
 *   pnpm -F @societyledger/api exec tsx scripts/rebalance-default-plans.ts            show what would change
 *   pnpm -F @societyledger/api exec tsx scripts/rebalance-default-plans.ts --apply    publish the new versions
 *   ... --apply --migrate                                                              also move current subscribers onto them
 *
 * Without --migrate, existing subscribers keep the version they bought and only new sign-ups and renewals get the new one.
 * A plan that has an unpublished draft is skipped, so nobody's work in progress is overwritten.
 */
import prisma from '../src/lib/prisma';
import { DEFAULT_PLANS } from '../prisma/seeds/plans.seed';
import { getOrCreateDraft, publishDraft, updateDraft } from '../src/services/billing/plan-builder.service';
import { scheduleMigration } from '../src/services/billing/migration.service';

const apply = process.argv.includes('--apply');
const migrate = process.argv.includes('--migrate');
const actor = { id: 0, role: 'SYSTEM' };
const REASON = 'Rebalanced the default plans so each one includes only what the app really enforces, with reports and meetings in Starter and welfare from Pro up';

const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

async function main() {
  const [coreModules, coreFeatures] = await Promise.all([
    prisma.platformModule.findMany({ where: { isCore: true }, select: { code: true } }),
    prisma.platformFeature.findMany({ where: { isCore: true }, select: { code: true } }),
  ]);

  for (const def of DEFAULT_PLANS) {
    const plan = await prisma.plan.findUnique({
      where: { code: def.code },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: { modules: { include: { module: { select: { code: true } } } }, features: { include: { feature: { select: { code: true } } } } },
        },
      },
    });
    if (!plan) {
      console.log(`${def.name}: not in this database, skipped (the seed will create it)`);
      continue;
    }
    if (plan.versions.some((v) => v.status === 'DRAFT')) {
      console.log(`${def.name}: has an unpublished draft, left alone`);
      continue;
    }
    const current = plan.versions.find((v) => v.status === 'PUBLISHED');
    if (!current) {
      console.log(`${def.name}: nothing published, left alone`);
      continue;
    }

    const wantModules = [...new Set([...def.modules, ...coreModules.map((m) => m.code)])];
    const wantFeatures = [...new Set([...def.features, ...coreFeatures.map((f) => f.code)])];
    const haveModules = current.modules.map((m) => m.module.code);
    const haveFeatures = current.features.map((f) => f.feature.code);

    if (same(wantModules, haveModules) && same(wantFeatures, haveFeatures)) {
      console.log(`${def.name}: already matches`);
      continue;
    }
    const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
    console.log(`${def.name}: v${current.version} -> new version`);
    console.log(`   modules   + ${diff(wantModules, haveModules).join(', ') || 'none'}   - ${diff(haveModules, wantModules).join(', ') || 'none'}`);
    console.log(`   features  + ${diff(wantFeatures, haveFeatures).join(', ') || 'none'}   - ${diff(haveFeatures, wantFeatures).join(', ') || 'none'}`);
    if (!apply) continue;

    await getOrCreateDraft(plan.id, actor);
    await updateDraft(plan.id, { moduleCodes: def.modules, featureCodes: def.features, changeNote: REASON }, actor);
    const published = await publishDraft(plan.id, actor, REASON);
    console.log(`   published v${published.version}`);

    if (migrate) {
      try {
        const m = await scheduleMigration({ planId: plan.id, fromVersionId: current.id, toVersionId: published.id, effectiveAt: new Date(), reason: REASON }, actor);
        console.log(`   moved ${m.affectedCount} subscriber(s) onto v${published.version}`);
      } catch (error) {
        console.log(`   no subscribers to move (${error instanceof Error ? error.message : error})`);
      }
    }
  }
  if (!apply) console.log('\nNothing was changed. Add --apply to publish the new versions.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // Importing the billing services starts background timers (SMS recovery), which would keep the process alive.
    process.exit(process.exitCode ?? 0);
  });
