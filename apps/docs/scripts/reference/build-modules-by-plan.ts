/**
 * Builds the modules-by-plan reference table from `platform-modules.seed.ts`.
 *
 * This documents the *intended* tiering design, which is real seed data —
 * but per the known gap G13 (`progress-tracker.md`), module/plan gating is
 * not currently enforced anywhere in the app (`requireModule()` defaults to
 * shadow mode). The generated page must carry a callout saying so; this
 * module only builds the data, the caller adds the callout.
 */
import path from 'node:path';
import { parseTsConst } from './parse-ts-const';

const apiRoot = (...parts: string[]) => path.join(__dirname, '..', '..', '..', 'api', ...parts);

interface ModuleDef {
  code: string;
  name: string;
  description: string;
  isCore: boolean;
  sortOrder: number;
}

interface FeatureDef {
  moduleCode: string;
  code: string;
  name: string;
  description: string;
}

export interface FeatureRow {
  code: string;
  name: string;
  description: string;
  plans: string[];
}

export interface ModuleRow {
  code: string;
  name: string;
  description: string;
  isCore: boolean;
  plans: string[];
  features: FeatureRow[];
}

const PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;

export function buildModulesByPlan(): ModuleRow[] {
  const seedPath = apiRoot('prisma/seeds/platform-modules.seed.ts');
  const modules = parseTsConst(seedPath, 'PLATFORM_MODULES') as ModuleDef[];
  const features = parseTsConst(seedPath, 'PLATFORM_FEATURES') as FeatureDef[];
  const moduleAssignments = parseTsConst(seedPath, 'PLAN_MODULE_ASSIGNMENTS') as Record<string, string[]>;
  const featureAssignments = parseTsConst(seedPath, 'PLAN_FEATURE_ASSIGNMENTS') as Record<string, string[]>;

  return [...modules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mod) => ({
      code: mod.code,
      name: mod.name,
      description: mod.description,
      isCore: mod.isCore,
      plans: PLANS.filter((plan) => moduleAssignments[plan]?.includes(mod.code)),
      features: features
        .filter((feature) => feature.moduleCode === mod.code)
        .map((feature) => ({
          code: feature.code,
          name: feature.name,
          description: feature.description,
          plans: PLANS.filter((plan) => featureAssignments[plan]?.includes(feature.code)),
        })),
    }));
}
