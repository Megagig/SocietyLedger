/**
 * The plan catalog: the one place that answers "what can be bought, at what price, with what included".
 *
 * Plans and add-ons are read from the database only. The landing page, homepage, pricing page, checkout, resubscription screen and the
 * admin summaries all go through here, so a published change shows up everywhere at once. Only PUBLISHED versions are ever offered;
 * drafts are invisible to customers.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { formatNaira } from './money';

/** Quotas a plan can set. Only `members` is enforced by the API today; the builder lists exactly what is enforced. */
export const LIMIT_DEFINITIONS = [{ key: 'members', label: 'Active members', unit: 'members' }] as const;
export type LimitKey = (typeof LIMIT_DEFINITIONS)[number]['key'];
export type Limits = Partial<Record<LimitKey, number | null>>;

export interface CatalogModule {
  code: string;
  name: string;
  isCore: boolean;
}

export interface CatalogFeature {
  code: string;
  name: string;
  moduleCode: string;
}

export interface CatalogPrices {
  monthlyKobo: number;
  annualKobo: number;
  /** Already formatted in full, e.g. "₦10,000.00". */
  monthly: string;
  annual: string;
  /** What choosing annual saves against paying monthly for 12 months (0 when annual is not cheaper). */
  annualSavingsKobo: number;
  annualSavings: string;
}

export interface CatalogPlan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[];
  badgeLabel: string | null;
  isRecommended: boolean;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  currency: string;
  versionId: number;
  version: number;
  prices: CatalogPrices;
  limits: Limits;
  modules: CatalogModule[];
  features: CatalogFeature[];
}

export interface CatalogAddon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  highlights: string[];
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;
  versionId: number;
  version: number;
  prices: CatalogPrices;
  limits: Limits;
  modules: CatalogModule[];
  features: CatalogFeature[];
  /** Empty = every plan can buy it; otherwise the plan codes that can. */
  eligiblePlanCodes: string[];
}

export function pricesOf(monthlyKobo: number, annualKobo: number): CatalogPrices {
  const savings = Math.max(0, monthlyKobo * 12 - annualKobo);
  return {
    monthlyKobo,
    annualKobo,
    monthly: formatNaira(monthlyKobo),
    annual: formatNaira(annualKobo),
    annualSavingsKobo: savings,
    annualSavings: formatNaira(savings),
  };
}

function asLimits(value: Prisma.JsonValue | null | undefined): Limits {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Limits = {};
  for (const def of LIMIT_DEFINITIONS) {
    const v = (value as Record<string, unknown>)[def.key];
    if (v === null) out[def.key] = null;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[def.key] = Math.floor(v);
  }
  return out;
}

function asHighlights(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

const versionInclude = {
  modules: { include: { module: true } },
  features: { include: { feature: { include: { module: true } } } },
} as const;

type PlanWithVersion = Prisma.PlanGetPayload<{ include: { versions: { include: typeof versionInclude } } }>;

export function toCatalogPlan(plan: PlanWithVersion): CatalogPlan | null {
  const v = plan.versions[0];
  if (!v) return null;
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    description: plan.description,
    highlights: asHighlights(plan.highlights),
    badgeLabel: plan.badgeLabel,
    isRecommended: plan.isRecommended,
    isPublic: plan.isPublic,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
    currency: plan.currency,
    versionId: v.id,
    version: v.version,
    prices: pricesOf(v.priceMonthlyKobo, v.priceAnnualKobo),
    limits: asLimits(v.limits),
    modules: v.modules
      .map((m) => ({ code: m.module.code, name: m.module.name, isCore: m.module.isCore, order: m.module.sortOrder }))
      .sort((a, b) => a.order - b.order)
      .map(({ code, name, isCore }) => ({ code, name, isCore })),
    features: v.features
      .map((f) => ({ code: f.feature.code, name: f.feature.name, moduleCode: f.feature.module.code, order: f.feature.sortOrder }))
      .sort((a, b) => a.order - b.order)
      .map(({ code, name, moduleCode }) => ({ code, name, moduleCode })),
  };
}

const publishedVersionArgs = {
  where: { status: 'PUBLISHED' as const },
  orderBy: { version: 'desc' as const },
  take: 1,
  include: versionInclude,
};

// Pricing is read on every public page view, so a short cache keeps it cheap. It is dropped the moment anything is published.
const CATALOG_TTL_MS = 30_000;
const catalogCache = new Map<string, { at: number; value: unknown }>();

export function invalidateCatalogCache(): void {
  catalogCache.clear();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.at < CATALOG_TTL_MS) return hit.value as T;
  const value = await load();
  catalogCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Plans a customer may newly buy. `public` is what the marketing pages show; `purchase` is what a signed-in association sees when it
 * subscribes (the same today, kept separate so the owner can later offer private plans to specific customers).
 */
export async function listPurchasablePlans(): Promise<CatalogPlan[]> {
  return cached('plans:purchasable', async () => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true, isArchived: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { versions: publishedVersionArgs },
    });
    return plans.map(toCatalogPlan).filter((p): p is CatalogPlan => p !== null);
  });
}

export async function listPurchasableAddons(): Promise<CatalogAddon[]> {
  return cached('addons:purchasable', async () => {
    const addons = await prisma.addon.findMany({
      where: { isActive: true, isPublic: true, isArchived: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: { versions: publishedVersionArgs, eligiblePlans: { include: { plan: { select: { code: true } } } } },
    });
    return addons
      .map((a) => {
        const v = a.versions[0];
        if (!v) return null;
        const item: CatalogAddon = {
          id: a.id,
          code: a.code,
          name: a.name,
          description: a.description,
          highlights: asHighlights(a.highlights),
          isPublic: a.isPublic,
          isActive: a.isActive,
          sortOrder: a.sortOrder,
          versionId: v.id,
          version: v.version,
          prices: pricesOf(v.priceMonthlyKobo, v.priceAnnualKobo),
          limits: asLimits(v.limits),
          modules: v.modules.map((m) => ({ code: m.module.code, name: m.module.name, isCore: m.module.isCore })),
          features: v.features.map((f) => ({ code: f.feature.code, name: f.feature.name, moduleCode: f.feature.module.code })),
          eligiblePlanCodes: a.eligiblePlans.map((e) => e.plan.code),
        };
        return item;
      })
      .filter((a): a is CatalogAddon => a !== null);
  });
}

/** A single plan that can be bought right now, or null (hidden, deactivated, archived or with nothing published). */
export async function getPurchasablePlan(planId: number): Promise<CatalogPlan | null> {
  const plans = await listPurchasablePlans();
  return plans.find((p) => p.id === planId) ?? null;
}

export async function getPurchasableAddon(addonId: number): Promise<CatalogAddon | null> {
  const addons = await listPurchasableAddons();
  return addons.find((a) => a.id === addonId) ?? null;
}

/** Can this add-on be bought by someone on this plan? */
export function addonFitsPlan(addon: Pick<CatalogAddon, 'eligiblePlanCodes'>, planCode: string): boolean {
  return addon.eligiblePlanCodes.length === 0 || addon.eligiblePlanCodes.includes(planCode);
}

/** The latest published version of any plan (even a hidden or deactivated one): used to read terms, never to offer a sale. */
export async function getLatestPublishedPlan(planId: number): Promise<CatalogPlan | null> {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { versions: publishedVersionArgs } });
  return plan ? toCatalogPlan(plan) : null;
}

/** The exact version a subscription was sold on, whatever its status now. */
export async function getPlanVersionTerms(planVersionId: number): Promise<CatalogPlan | null> {
  const version = await prisma.planVersion.findUnique({
    where: { id: planVersionId },
    include: { plan: true, ...versionInclude },
  });
  if (!version) return null;
  const { plan, ...rest } = version;
  return toCatalogPlan({ ...plan, versions: [rest] } as PlanWithVersion);
}

/** The plan a new association is given at registration: the configured onboarding plan's latest published version. */
export async function getOnboardingPlan(code: string): Promise<CatalogPlan | null> {
  const plan = await prisma.plan.findUnique({ where: { code }, include: { versions: publishedVersionArgs } });
  return plan ? toCatalogPlan(plan) : null;
}

export function limitFor(limits: Limits, key: LimitKey): number | null {
  const v = limits[key];
  return v === undefined ? null : v;
}
