/**
 * Generates `content/docs/reference/{permissions,statuses,payment-methods,
 * modules-by-plan}.mdx` from `apps/api`'s source (`project-overview.md
 * §9.6.21`). Statically parses the relevant files (see `reference/parse-ts-
 * const.ts` and `reference/parse-prisma-enums.ts`) rather than importing or
 * executing them — `apps/docs` has no workspace dependency on `apps/api`,
 * and several seed files instantiate a `PrismaClient` at module scope, so
 * importing them would need a DB connection and `.env` this script must not
 * depend on. `release-notes.mdx` is out of scope here — it's hand-written
 * per release (`build-plan.md` D6.1).
 *
 * Any inconsistency the builders find between seed files (a role mapping
 * referencing an unseeded permission key, etc.) is printed as a warning,
 * not a failure — those are known, already-logged gaps
 * (`progress-tracker.md`), not something a CI run should block on.
 *
 * Wired into CI since D1.7 (generate, then fail if the generated files
 * changed but weren't committed) — this is the first run that actually
 * generates content; previously a no-op stub.
 *
 * Run: pnpm -F @societyledger/docs gen:reference
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPermissions } from './reference/build-permissions';
import { buildStatuses } from './reference/build-statuses';
import { buildPaymentMethods } from './reference/build-payment-methods';
import { buildModulesByPlan } from './reference/build-modules-by-plan';
import { frontmatter, GENERATED_BANNER, table, humanizeEnumName } from './reference/render';

const contentDir = path.join(__dirname, '..', 'content', 'docs', 'reference');

function writePage(slug: string, content: string): void {
  writeFileSync(path.join(contentDir, `${slug}.mdx`), content, 'utf8');
  console.log(`  wrote ${slug}.mdx`);
}

function renderPermissionsPage(): string {
  const { rows, warnings } = buildPermissions();
  for (const warning of warnings) console.warn(`[gen-reference] permissions: ${warning}`);

  const byModule = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!byModule.has(row.module)) byModule.set(row.module, []);
    byModule.get(row.module)!.push(row);
  }

  const sections = [...byModule.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleName, moduleRows]) => {
      const body = table(
        ['Key', 'Description', 'Default roles', 'Also known as'],
        moduleRows.map((row) => [
          `\`${row.key}\``,
          row.description,
          row.roles.length > 0 ? row.roles.join(', ') : '—',
          row.aliases.length > 0 ? row.aliases.map((a) => `\`${a}\``).join(', ') : '—',
        ]),
      );
      return `### ${moduleName}\n\n${body}`;
    })
    .join('\n\n');

  return [
    frontmatter({
      title: 'Permissions reference',
      description: 'Every permission key the app recognises, who gets it by default, and any older name it used to go by.',
      audience: ['admin'],
      platforms: ['web', 'mobile'],
      covers: [
        'apps/api/src/lib/permissions.ts',
        'apps/api/prisma/seeds/rbac-seed.ts',
        'apps/api/prisma/seeds/help-permissions.seed.ts',
      ],
    }),
    '',
    GENERATED_BANNER,
    '',
    'Permissions control what a role can see and do. This reference lists every permission SocietyLedger recognises, which of the built-in roles get it automatically, and (for a few older ones) the earlier name it was known by. Custom roles you create can be granted any of these individually — see [Custom roles](/docs/settings/custom-roles).',
    '',
    sections,
    '',
  ].join('\n');
}

function renderStatusesPage(): string {
  const groups = buildStatuses();

  const sections = groups
    .map((group) => {
      const list = group.values.map((value) => `- \`${value}\``).join('\n');
      return `### ${humanizeEnumName(group.name)}\n\n${list}`;
    })
    .join('\n\n');

  return [
    frontmatter({
      title: 'Statuses reference',
      description: 'Every status value you may see across SocietyLedger, grouped by what it applies to.',
      audience: ['admin'],
      platforms: ['web', 'mobile'],
      covers: ['apps/api/prisma/schema.prisma'],
    }),
    '',
    GENERATED_BANNER,
    '',
    "A quick lookup for status values you'll see on screens throughout SocietyLedger — what a record's current status can be, grouped by the kind of record it applies to.",
    '',
    sections,
    '',
  ].join('\n');
}

function renderPaymentMethodsPage(): string {
  const rows = buildPaymentMethods();

  const body = table(
    ['Value', 'Label'],
    rows.map((row) => [`\`${row.value}\``, row.name]),
  );

  return [
    frontmatter({
      title: 'Payment methods',
      description: 'The payment methods SocietyLedger recognises when recording a payment.',
      audience: ['admin'],
      platforms: ['web', 'mobile'],
      covers: ['apps/api/src/modules/finance/finance.controller.ts', 'apps/api/src/modules/dashboard/dashboard.types.ts'],
    }),
    '',
    GENERATED_BANNER,
    '',
    'These are the payment methods available when an officer records a payment manually (see [Recording a payment](/docs/finance/creating-charges)).',
    '',
    body,
    '',
  ].join('\n');
}

function renderModulesByPlanPage(): string {
  const modules = buildModulesByPlan();

  const moduleTable = table(
    ['Module', 'What it covers'],
    modules.map((mod) => [mod.isCore ? `${mod.name} (in every plan)` : mod.name, mod.description]),
  );

  const allFeatures = modules.flatMap((mod) => mod.features.map((feature) => ({ ...feature, moduleName: mod.name })));
  const featureTable =
    allFeatures.length > 0
      ? table(
          ['Feature', 'Module', 'What it does'],
          allFeatures.map((feature) => [feature.name, feature.moduleName, feature.description]),
        )
      : '';

  return [
    frontmatter({
      title: 'Modules by plan',
      description: 'The modules and features that exist, and where to see which plan includes each.',
      audience: ['admin'],
      platforms: ['web', 'mobile'],
      covers: ['apps/api/prisma/seeds/platform-modules.seed.ts'],
    }),
    '',
    GENERATED_BANNER,
    '',
    'Which plan includes which module or feature is set by SocietyLedger and can change, so it is not listed here. To see exactly what each plan includes today, open **Subscription → Plans**: the cards and the **Compare plans** table show the current plans, and the pricing page shows the same. Your own subscription page shows the version of your plan you are on. See [Understanding your plan and what’s included](/docs/plan-billing/plans-and-whats-included).',
    '',
    'Modules marked "in every plan" are part of all plans. Anything else is available only if your plan, or an [add-on](/docs/plan-billing/add-ons) you hold, includes it.',
    '',
    '## Modules',
    '',
    moduleTable,
    '',
    featureTable ? '## Features\n\n' + featureTable + '\n' : '',
  ].join('\n');
}

console.log('gen:reference — generating reference pages from apps/api source...');
// GEN_ONLY=modules-by-plan (comma separated) regenerates just those pages.
const only = process.env.GEN_ONLY ? process.env.GEN_ONLY.split(',').map((x) => x.trim()) : null;
const wanted = (name: string) => !only || only.includes(name);
if (wanted('permissions')) writePage('permissions', renderPermissionsPage());
if (wanted('statuses')) writePage('statuses', renderStatusesPage());
if (wanted('payment-methods')) writePage('payment-methods', renderPaymentMethodsPage());
if (wanted('modules-by-plan')) writePage('modules-by-plan', renderModulesByPlanPage());
console.log('gen:reference — done (release-notes.mdx is hand-written, not generated).');
