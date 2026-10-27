/**
 * What a tenant is entitled to use, worked out in one place.
 *
 *   core modules/features  +  the subscription's plan VERSION  +  live add-ons  →  then per-tenant overrides (either direction).
 *
 * The plan version is the one the subscription was sold on, so a later price or feature change never touches an existing subscriber until
 * they are migrated. Whether the tenant may use the app at all (expiry, grace, lockout) is decided earlier, by the access check in the auth
 * middleware; this service answers "which modules and features, and how much", and ignores the clock except for add-on and override expiry.
 */
import prisma from '../../lib/prisma';
import { PlatformSettingsService } from '../../modules/admin/platform-settings.service';
import { clampGraceDays, pickDecidingSubscription } from '../subscription-access.service';
import { addDaysUtc } from './money';
import { ADDON_ONLY_LIMITS, LIMIT_DEFINITIONS, type Limits, type LimitKey } from './catalog.service';

export type EntitlementSource = 'tenant_override' | 'plan' | 'addon' | 'default';

export interface ResolvedModule {
  code: string;
  name: string;
  isCore: boolean;
  isEnabled: boolean;
  source: EntitlementSource;
  override?: { reason: string; expiresAt: string | null };
}

export interface ResolvedFeature {
  code: string;
  name: string;
  moduleCode: string;
  isEnabled: boolean;
  source: EntitlementSource;
  override?: { reason: string; expiresAt: string | null };
}

export interface Entitlements {
  associationId: number;
  /** The subscription that supplied the plan terms, or null for an association with none. */
  subscriptionId: number | null;
  planVersionId: number | null;
  planCode: string | null;
  planName: string | null;
  modules: Map<string, ResolvedModule>;
  features: Map<string, ResolvedFeature>;
  /** Plan limits plus add-on extras. A key that is null is unlimited. */
  limits: Limits;
}

/** The only non-core module a standalone thrift group can reach. */
export const THRIFT_GROUP_MODULES: ReadonlySet<string> = new Set(['ajo']);

const CACHE_MS = 20_000;
const cache = new Map<number, { at: number; value: Entitlements }>();

export function invalidateEntitlements(associationId?: number): void {
  if (associationId === undefined) cache.clear();
  else cache.delete(associationId);
}

/** Combine the plan's quota with add-on extras: any unlimited (null) wins, otherwise they add up. */
export function mergeLimits(base: Limits, extras: Limits[]): Limits {
  const out: Limits = { ...base };
  for (const def of LIMIT_DEFINITIONS) {
    const key: LimitKey = def.key;
    if (ADDON_ONLY_LIMITS.has(key)) {
      // Only add-ons grant this quota, and it counts from zero: a plan's value is ignored and no add-on means none (never unlimited).
      const granted = extras.filter((e) => key in e).map((e) => e[key]);
      out[key] = granted.some((v) => v === null) ? null : granted.reduce<number>((sum, v) => sum + (v as number), 0);
      continue;
    }
    const baseHas = key in base;
    const baseVal = base[key];
    const extraVals = extras.filter((e) => key in e).map((e) => e[key]);
    if (!baseHas && extraVals.length === 0) continue;
    if ((baseHas && baseVal === null) || extraVals.some((v) => v === null)) {
      out[key] = null;
      continue;
    }
    // A plan with no entry for this key is unlimited; extras only add to a real number.
    if (!baseHas) {
      out[key] = null;
      continue;
    }
    out[key] = (baseVal as number) + extraVals.reduce<number>((sum, v) => sum + (v as number), 0);
  }
  return out;
}

export async function getEntitlements(associationId: number, now = new Date()): Promise<Entitlements> {
  const hit = cache.get(associationId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await computeEntitlements(associationId, now);
  cache.set(associationId, { at: Date.now(), value });
  return value;
}

export async function computeEntitlements(associationId: number, now = new Date()): Promise<Entitlements> {
  const [allModules, allFeatures, subs, moduleOverrides, featureOverrides, settings, tenant] = await Promise.all([
    prisma.platformModule.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.platformFeature.findMany({ include: { module: true }, orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] }),
    prisma.subscription.findMany({
      where: { associationId },
      include: {
        plan: { select: { code: true, name: true } },
        planVersion: { include: { modules: { include: { module: true } }, features: { include: { feature: true } } } },
      },
    }),
    prisma.tenantModule.findMany({
      where: { associationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { module: true },
    }),
    prisma.tenantFeature.findMany({
      where: { associationId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      include: { feature: { include: { module: true } } },
    }),
    PlatformSettingsService.getSettings(),
    prisma.association.findUnique({ where: { id: associationId }, select: { kind: true } }),
  ]);
  const isThriftGroup = tenant?.kind === 'THRIFT_GROUP';

  const deciding = pickDecidingSubscription(subs);
  const graceDays = clampGraceDays((settings as unknown as { gracePeriodDays?: unknown }).gracePeriodDays);

  // Add-ons stay live until their end date (plus the grace period, because they end with the subscription they were bought into).
  const addons = deciding
    ? await prisma.tenantAddon.findMany({
        where: { associationId, status: 'ACTIVE', endsAt: { gt: addDaysUtc(now, -graceDays) } },
        include: { addonVersion: { include: { modules: true, features: true } } },
      })
    : [];

  const planModuleIds = new Set(deciding?.planVersion.modules.map((m) => m.moduleId) ?? []);
  const planFeatureIds = new Set(deciding?.planVersion.features.map((f) => f.featureId) ?? []);
  const addonModuleIds = new Set(addons.flatMap((a) => a.addonVersion.modules.map((m) => m.moduleId)));
  const addonFeatureIds = new Set(addons.flatMap((a) => a.addonVersion.features.map((f) => f.featureId)));
  const moduleOverrideById = new Map(moduleOverrides.map((o) => [o.moduleId, o]));
  const featureOverrideById = new Map(featureOverrides.map((o) => [o.featureId, o]));

  const modules = new Map<string, ResolvedModule>();
  for (const m of allModules) {
    const override = moduleOverrideById.get(m.id);
    let resolved: ResolvedModule;
    if (override) {
      resolved = {
        code: m.code,
        name: m.name,
        isCore: m.isCore,
        // A core module can never be switched off, even by an old override row.
        isEnabled: m.isCore ? true : override.isEnabled,
        source: 'tenant_override',
        override: { reason: override.reason || '', expiresAt: override.expiresAt ? override.expiresAt.toISOString() : null },
      };
    } else if (planModuleIds.has(m.id)) {
      resolved = { code: m.code, name: m.name, isCore: m.isCore, isEnabled: true, source: 'plan' };
    } else if (addonModuleIds.has(m.id)) {
      resolved = { code: m.code, name: m.name, isCore: m.isCore, isEnabled: true, source: 'addon' };
    } else {
      resolved = { code: m.code, name: m.name, isCore: m.isCore, isEnabled: m.isCore, source: 'default' };
    }
    // A standalone thrift group reaches core modules and Ajo only. Not even a staff override widens that: the kind is the rule.
    if (isThriftGroup && !m.isCore && !THRIFT_GROUP_MODULES.has(m.code)) {
      resolved = { code: m.code, name: m.name, isCore: m.isCore, isEnabled: false, source: 'default' };
    }
    modules.set(m.code, resolved);
  }

  const features = new Map<string, ResolvedFeature>();
  for (const f of allFeatures) {
    const override = featureOverrideById.get(f.id);
    let resolved: ResolvedFeature;
    if (override) {
      resolved = {
        code: f.code,
        name: f.name,
        moduleCode: f.module.code,
        isEnabled: override.isEnabled,
        source: 'tenant_override',
        override: { reason: override.reason || '', expiresAt: override.expiresAt ? override.expiresAt.toISOString() : null },
      };
    } else if (planFeatureIds.has(f.id)) {
      resolved = { code: f.code, name: f.name, moduleCode: f.module.code, isEnabled: true, source: 'plan' };
    } else if (addonFeatureIds.has(f.id)) {
      resolved = { code: f.code, name: f.name, moduleCode: f.module.code, isEnabled: true, source: 'addon' };
    } else {
      resolved = { code: f.code, name: f.name, moduleCode: f.module.code, isEnabled: f.isCore, source: 'default' };
    }
    if (isThriftGroup && !f.isCore && !THRIFT_GROUP_MODULES.has(f.module.code)) {
      resolved = { code: f.code, name: f.name, moduleCode: f.module.code, isEnabled: false, source: 'default' };
    }
    features.set(f.code, resolved);
  }

  const planLimits = (deciding?.planVersion.limits ?? {}) as Record<string, unknown>;
  const base: Limits = {};
  for (const def of LIMIT_DEFINITIONS) {
    if (!(def.key in planLimits)) continue;
    const v = planLimits[def.key];
    base[def.key] = v === null ? null : typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
  }
  const extras: Limits[] = addons.map((a) => {
    const raw = (a.addonVersion.limits ?? {}) as Record<string, unknown>;
    const e: Limits = {};
    for (const def of LIMIT_DEFINITIONS) {
      if (!(def.key in raw)) continue;
      const v = raw[def.key];
      e[def.key] = v === null ? null : typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    }
    return e;
  });

  return {
    associationId,
    subscriptionId: deciding?.id ?? null,
    planVersionId: deciding?.planVersionId ?? null,
    planCode: deciding?.plan.code ?? null,
    planName: deciding?.plan.name ?? null,
    modules,
    features,
    limits: mergeLimits(base, extras),
  };
}
