/**
 * Builds the list of modules and features that exist, from `platform-modules.seed.ts`.
 *
 * Which plan includes which of them is NOT in the source any more: it is configured by the platform owner in the Plan Builder and stored
 * in the database (as versions of each plan), so a table of plan columns built from source would go stale the moment a plan is edited.
 * This only documents what exists; the live plan page shows what each plan includes.
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
}

export interface ModuleRow {
  code: string;
  name: string;
  description: string;
  isCore: boolean;
  features: FeatureRow[];
}

export function buildModulesByPlan(): ModuleRow[] {
  const seedPath = apiRoot('prisma/seeds/platform-modules.seed.ts');
  const modules = parseTsConst(seedPath, 'PLATFORM_MODULES') as ModuleDef[];
  const features = parseTsConst(seedPath, 'PLATFORM_FEATURES') as FeatureDef[];

  return [...modules]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mod) => ({
      code: mod.code,
      name: mod.name,
      description: mod.description,
      isCore: mod.isCore,
      features: features
        .filter((feature) => feature.moduleCode === mod.code)
        .map((feature) => ({
          code: feature.code,
          name: feature.name,
          description: feature.description,
        })),
    }));
}
