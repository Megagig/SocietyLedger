/**
 * The Plan Builder: how the platform owner creates and changes plans and add-ons without touching code.
 *
 * Editing happens on a DRAFT version that customers never see. Publishing turns the draft into the new current version and retires the
 * previous one for new sales, but existing subscribers stay on the version they bought until they are migrated (migration.service).
 * Presentation changes (name, copy, visibility, order, the recommended flag) are not commercial terms, so they apply immediately and do
 * not create a version. Every change is written to the platform action log in the same transaction, with who, when, why, before and after.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { PlatformSettingsService } from '../../modules/admin/platform-settings.service';
import { invalidateEntitlements } from './entitlements.service';
import { invalidateAccessCache } from '../subscription-access.service';
import { ADDON_ONLY_LIMITS, LIMIT_DEFINITIONS, invalidateCatalogCache } from './catalog.service';
import { BillingError } from './quote.service';
import { requestPublicRevalidation } from './revalidate';
import type { Actor } from './lifecycle.service';

type Tx = Prisma.TransactionClient;

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_KOBO = 2_000_000_000; // stays inside a 32-bit integer column

export interface VersionInput {
  priceMonthlyKobo?: number;
  priceAnnualKobo?: number;
  /** { members: 500 } - a null value or a missing key means unlimited. */
  limits?: Record<string, number | null>;
  moduleCodes?: string[];
  featureCodes?: string[];
  changeNote?: string;
}

export interface PlanMetaInput {
  name?: string;
  description?: string | null;
  highlights?: string[];
  badgeLabel?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
  isRecommended?: boolean;
  sortOrder?: number;
}

function assertKobo(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_KOBO) {
    throw new BillingError('INVALID_PRICE', `${label} must be a whole number of kobo, from 0 up to ${MAX_KOBO}.`);
  }
  return value;
}

function cleanLimits(input: Record<string, number | null> | undefined, scope: 'plan' | 'addon' = 'plan'): Prisma.InputJsonValue {
  const out: Record<string, number | null> = {};
  const known = new Set<string>(LIMIT_DEFINITIONS.map((d) => d.key));
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!known.has(key)) throw new BillingError('INVALID_LIMIT', `"${key}" is not a limit that can be set.`);
    if (scope === 'plan' && ADDON_ONLY_LIMITS.has(key)) throw new BillingError('INVALID_LIMIT', `"${key}" can only be granted by an add-on, not a plan.`);
    if (value === null) out[key] = null;
    else if (typeof value === 'number' && Number.isInteger(value) && value >= 0) out[key] = value;
    else throw new BillingError('INVALID_LIMIT', `The limit for ${key} must be a whole number of 0 or more, or empty for unlimited.`);
  }
  return out;
}

function cleanFamily(value: string | null | undefined): string | null {
  const family = (value ?? '').trim().toLowerCase();
  if (!family) return null;
  if (!CODE_RE.test(family)) throw new BillingError('INVALID_FAMILY', 'The add-on family can use lower-case letters, numbers and single dashes only.');
  return family;
}

function cleanHighlights(list: string[] | undefined): string[] | undefined {
  if (!list) return undefined;
  return list.map((s) => s.trim()).filter(Boolean).slice(0, 12);
}

async function resolveModuleIds(tx: Tx, codes: string[]): Promise<number[]> {
  const unique = [...new Set(codes)];
  const rows = await tx.platformModule.findMany({ where: { code: { in: unique } } });
  const missing = unique.filter((c) => !rows.some((r) => r.code === c));
  if (missing.length) throw new BillingError('UNKNOWN_MODULE', `Unknown module: ${missing.join(', ')}.`);
  // Core modules are part of every plan, so a plan can never be published without them.
  const core = await tx.platformModule.findMany({ where: { isCore: true }, select: { id: true } });
  return [...new Set([...rows.map((r) => r.id), ...core.map((c) => c.id)])];
}

async function resolveFeatureIds(tx: Tx, codes: string[]): Promise<number[]> {
  const unique = [...new Set(codes)];
  const rows = await tx.platformFeature.findMany({ where: { code: { in: unique } } });
  const missing = unique.filter((c) => !rows.some((r) => r.code === c));
  if (missing.length) throw new BillingError('UNKNOWN_FEATURE', `Unknown feature: ${missing.join(', ')}.`);
  const core = await tx.platformFeature.findMany({ where: { isCore: true }, select: { id: true } });
  return [...new Set([...rows.map((r) => r.id), ...core.map((c) => c.id)])];
}

const versionSelect = {
  modules: { include: { module: { select: { code: true, name: true } } } },
  features: { include: { feature: { select: { code: true, name: true, module: { select: { code: true } } } } } },
} as const;

/** A compact, comparable picture of a version, used for the audit trail and the publish preview. */
export function snapshotOf(v: {
  version: number;
  priceMonthlyKobo: number;
  priceAnnualKobo: number;
  limits: Prisma.JsonValue | null;
  modules: { module: { code: string } }[];
  features: { feature: { code: string } }[];
}) {
  return {
    version: v.version,
    priceMonthlyKobo: v.priceMonthlyKobo,
    priceAnnualKobo: v.priceAnnualKobo,
    limits: (v.limits ?? {}) as Record<string, number | null>,
    modules: v.modules.map((m) => m.module.code).sort(),
    features: v.features.map((f) => f.feature.code).sort(),
  };
}

async function audit(tx: Tx, actor: Actor, entry: { actionType: string; targetType: 'plan' | 'addon'; targetId: number; before?: object; after?: object; reason?: string }) {
  await tx.platformActionLog.create({
    data: {
      actorId: actor.id,
      actorRole: actor.role,
      actionType: entry.actionType,
      targetType: entry.targetType,
      targetId: entry.targetId,
      beforeState: entry.before,
      afterState: entry.after,
      reason: entry.reason,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    },
  });
}

/** Everything that depends on the catalog is refreshed together: the server caches, entitlements, and the public pages. */
function published(): void {
  invalidateCatalogCache();
  invalidateEntitlements();
  invalidateAccessCache();
  void requestPublicRevalidation();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------------------------------------------

export async function listPlansForBuilder() {
  const plans = await prisma.plan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { versions: { orderBy: { version: 'desc' }, include: versionSelect } },
  });
  const counts = await prisma.subscription.groupBy({
    by: ['planVersionId'],
    where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    _count: { _all: true },
  });
  const byVersion = new Map(counts.map((c) => [c.planVersionId, c._count._all]));
  const settings = await PlatformSettingsService.getSettings();
  return plans.map((p) => ({
    ...p,
    isOnboardingPlan: p.code === settings.onboardingPlanCode,
    versions: p.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      priceMonthlyKobo: v.priceMonthlyKobo,
      priceAnnualKobo: v.priceAnnualKobo,
      limits: v.limits,
      changeNote: v.changeNote,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      moduleCodes: v.modules.map((m) => m.module.code),
      featureCodes: v.features.map((f) => f.feature.code),
      subscribers: byVersion.get(v.id) ?? 0,
    })),
  }));
}

export async function createPlan(input: { code: string; name: string; description?: string | null } & PlanMetaInput & VersionInput, actor: Actor) {
  const code = input.code.trim().toLowerCase();
  if (!CODE_RE.test(code)) throw new BillingError('INVALID_CODE', 'The plan code can use lower-case letters, numbers and single dashes only.');
  if (!input.name?.trim()) throw new BillingError('NAME_REQUIRED', 'Give the plan a name.');
  const monthly = assertKobo(input.priceMonthlyKobo ?? 0, 'The monthly price');
  const annual = assertKobo(input.priceAnnualKobo ?? 0, 'The annual price');

  const plan = await prisma.$transaction(async (tx) => {
    if (await tx.plan.findUnique({ where: { code } })) throw new BillingError('CODE_TAKEN', `A plan with the code "${code}" already exists.`, 409);
    const last = await tx.plan.aggregate({ _max: { sortOrder: true } });
    // Only one plan is highlighted at a time.
    if (input.isRecommended) await tx.plan.updateMany({ where: { isRecommended: true }, data: { isRecommended: false } });
    const created = await tx.plan.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description ?? null,
        highlights: cleanHighlights(input.highlights) ?? [],
        badgeLabel: input.badgeLabel ?? null,
        isPublic: input.isPublic ?? false,
        isActive: input.isActive ?? true,
        isRecommended: input.isRecommended ?? false,
        sortOrder: input.sortOrder ?? (last._max.sortOrder ?? 0) + 1,
      },
    });
    const moduleIds = await resolveModuleIds(tx, input.moduleCodes ?? []);
    const featureIds = await resolveFeatureIds(tx, input.featureCodes ?? []);
    await tx.planVersion.create({
      data: {
        planId: created.id,
        version: 1,
        status: 'DRAFT',
        priceMonthlyKobo: monthly,
        priceAnnualKobo: annual,
        limits: cleanLimits(input.limits),
        changeNote: input.changeNote ?? null,
        createdBy: actor.id,
        modules: { create: moduleIds.map((moduleId) => ({ moduleId })) },
        features: { create: featureIds.map((featureId) => ({ featureId })) },
      },
    });
    await audit(tx, actor, { actionType: 'PLAN_CREATED', targetType: 'plan', targetId: created.id, after: { code, name: created.name } });
    return created;
  });
  return plan;
}

export async function updatePlanMeta(planId: number, patch: PlanMetaInput, actor: Actor, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.plan.findUnique({ where: { id: planId } });
    if (!before) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
    if (before.isArchived && (patch.isActive || patch.isPublic)) throw new BillingError('PLAN_ARCHIVED', 'An archived plan cannot be put on sale. Restore it first.');
    if (patch.name !== undefined && !patch.name.trim()) throw new BillingError('NAME_REQUIRED', 'Give the plan a name.');

    // Taking the onboarding plan off sale would leave new associations with nothing to be given.
    const settings = await PlatformSettingsService.getSettings();
    if (before.code === settings.onboardingPlanCode && (patch.isActive === false)) {
      throw new BillingError('ONBOARDING_PLAN', 'This is the plan new associations are given. Choose a different onboarding plan in the platform settings first.');
    }

    if (patch.isRecommended) await tx.plan.updateMany({ where: { id: { not: planId }, isRecommended: true }, data: { isRecommended: false } });
    const data: Prisma.PlanUpdateInput = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.highlights !== undefined ? { highlights: cleanHighlights(patch.highlights) } : {}),
      ...(patch.badgeLabel !== undefined ? { badgeLabel: patch.badgeLabel } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      ...(patch.isRecommended !== undefined ? { isRecommended: patch.isRecommended } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
    };
    const after = await tx.plan.update({ where: { id: planId }, data });
    await audit(tx, actor, {
      actionType: 'PLAN_UPDATED',
      targetType: 'plan',
      targetId: planId,
      before: pickMeta(before),
      after: pickMeta(after),
      reason,
    });
    return after;
  });
  published();
  return result;
}

function pickMeta(p: { name: string; description: string | null; badgeLabel: string | null; isPublic: boolean; isActive: boolean; isRecommended: boolean; sortOrder: number; isArchived: boolean }) {
  return { name: p.name, description: p.description, badgeLabel: p.badgeLabel, isPublic: p.isPublic, isActive: p.isActive, isRecommended: p.isRecommended, sortOrder: p.sortOrder, isArchived: p.isArchived };
}

/** Archive: never offered again, hidden everywhere, but every existing subscription on it keeps working and stays auditable. */
export async function archivePlan(planId: number, actor: Actor, reason: string) {
  const plan = await prisma.$transaction(async (tx) => {
    const before = await tx.plan.findUnique({ where: { id: planId } });
    if (!before) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
    const settings = await PlatformSettingsService.getSettings();
    if (before.code === settings.onboardingPlanCode) {
      throw new BillingError('ONBOARDING_PLAN', 'This is the plan new associations are given. Choose a different onboarding plan in the platform settings first.');
    }
    const after = await tx.plan.update({ where: { id: planId }, data: { isArchived: true, isActive: false, isPublic: false, isRecommended: false } });
    await audit(tx, actor, { actionType: 'PLAN_ARCHIVED', targetType: 'plan', targetId: planId, before: pickMeta(before), after: pickMeta(after), reason });
    return after;
  });
  published();
  return plan;
}

export async function restorePlan(planId: number, actor: Actor, reason: string) {
  const plan = await prisma.$transaction(async (tx) => {
    const before = await tx.plan.findUnique({ where: { id: planId } });
    if (!before) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
    const after = await tx.plan.update({ where: { id: planId }, data: { isArchived: false } });
    await audit(tx, actor, { actionType: 'PLAN_RESTORED', targetType: 'plan', targetId: planId, before: pickMeta(before), after: pickMeta(after), reason });
    return after;
  });
  published();
  return plan;
}

/** Start (or return) the draft for a plan. A new draft begins as a copy of what is on sale now. */
export async function getOrCreateDraft(planId: number, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.planVersion.findFirst({ where: { planId, status: 'DRAFT' }, include: versionSelect });
    if (existing) return existing;
    const latest = await tx.planVersion.findFirst({ where: { planId }, orderBy: { version: 'desc' }, include: versionSelect });
    const source = (await tx.planVersion.findFirst({ where: { planId, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, include: versionSelect })) ?? latest;
    if (!(await tx.plan.findUnique({ where: { id: planId } }))) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
    const draft = await tx.planVersion.create({
      data: {
        planId,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        priceMonthlyKobo: source?.priceMonthlyKobo ?? 0,
        priceAnnualKobo: source?.priceAnnualKobo ?? 0,
        limits: (source?.limits ?? {}) as Prisma.InputJsonValue,
        createdBy: actor.id,
        modules: { create: (source?.modules ?? []).map((m) => ({ moduleId: m.moduleId })) },
        features: { create: (source?.features ?? []).map((f) => ({ featureId: f.featureId })) },
      },
      include: versionSelect,
    });
    await audit(tx, actor, { actionType: 'PLAN_DRAFT_STARTED', targetType: 'plan', targetId: planId, after: { version: draft.version } });
    return draft;
  });
}

export async function updateDraft(planId: number, patch: VersionInput, _actor?: Actor) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.planVersion.findFirst({ where: { planId, status: 'DRAFT' } });
    if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to edit. Start one first.', 404);
    const data: Prisma.PlanVersionUpdateInput = {};
    if (patch.priceMonthlyKobo !== undefined) data.priceMonthlyKobo = assertKobo(patch.priceMonthlyKobo, 'The monthly price');
    if (patch.priceAnnualKobo !== undefined) data.priceAnnualKobo = assertKobo(patch.priceAnnualKobo, 'The annual price');
    if (patch.limits !== undefined) data.limits = cleanLimits(patch.limits);
    if (patch.changeNote !== undefined) data.changeNote = patch.changeNote;
    if (patch.moduleCodes !== undefined) {
      const ids = await resolveModuleIds(tx, patch.moduleCodes);
      await tx.planVersionModule.deleteMany({ where: { planVersionId: draft.id } });
      await tx.planVersionModule.createMany({ data: ids.map((moduleId) => ({ planVersionId: draft.id, moduleId })) });
    }
    if (patch.featureCodes !== undefined) {
      const ids = await resolveFeatureIds(tx, patch.featureCodes);
      await tx.planVersionFeature.deleteMany({ where: { planVersionId: draft.id } });
      await tx.planVersionFeature.createMany({ data: ids.map((featureId) => ({ planVersionId: draft.id, featureId })) });
    }
    return tx.planVersion.update({ where: { id: draft.id }, data, include: versionSelect });
  });
}

export async function discardDraft(planId: number, actor: Actor) {
  await prisma.$transaction(async (tx) => {
    const draft = await tx.planVersion.findFirst({ where: { planId, status: 'DRAFT' } });
    if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to discard.', 404);
    // A first-ever draft (never published) is the only version: discarding it leaves the plan with nothing to sell, which is fine.
    await tx.planVersion.delete({ where: { id: draft.id } });
    await audit(tx, actor, { actionType: 'PLAN_DRAFT_DISCARDED', targetType: 'plan', targetId: planId, after: { version: draft.version } });
  });
}

export interface PublishPreview {
  planId: number;
  planName: string;
  hasPublished: boolean;
  fromVersion: number | null;
  toVersion: number;
  price: { monthly: { from: number | null; to: number }; annual: { from: number | null; to: number } };
  modulesAdded: string[];
  modulesRemoved: string[];
  featuresAdded: string[];
  featuresRemoved: string[];
  limits: { from: Record<string, number | null>; to: Record<string, number | null> };
  /** Live subscriptions on the version being replaced. They keep their current terms until you migrate them. */
  subscribersOnCurrentVersion: number;
  isOnboardingPlan: boolean;
  warnings: string[];
  blockers: string[];
}

/** Show what publishing the draft would do, before it does it. */
export async function previewPublish(planId: number): Promise<PublishPreview> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
  const [draft, current, settings] = await Promise.all([
    prisma.planVersion.findFirst({ where: { planId, status: 'DRAFT' }, include: versionSelect }),
    prisma.planVersion.findFirst({ where: { planId, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, include: versionSelect }),
    PlatformSettingsService.getSettings(),
  ]);
  if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to publish.', 404);

  const to = snapshotOf(draft);
  const from = current ? snapshotOf(current) : null;
  const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
  const subscribers = current
    ? await prisma.subscription.count({ where: { planVersionId: current.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } } })
    : 0;

  const warnings: string[] = [];
  const blockers: string[] = [];
  if (to.priceMonthlyKobo === 0 && to.priceAnnualKobo === 0) warnings.push('Both prices are zero, so this plan will be free.');
  if (to.priceAnnualKobo > to.priceMonthlyKobo * 12 && to.priceMonthlyKobo > 0) warnings.push('The annual price is higher than twelve months at the monthly price.');
  if (from && to.priceMonthlyKobo < from.priceMonthlyKobo) warnings.push('The monthly price goes down. Existing subscribers keep their current price unless you migrate them.');
  if (draft.modules.length === 0) blockers.push('Add at least one module.');
  const moduleCodes = new Set(to.modules);
  const orphan = draft.features.filter((f) => !moduleCodes.has(f.feature.module.code)).map((f) => f.feature.code);
  if (orphan.length) warnings.push(`These features belong to modules the plan does not include, so they will not be usable: ${orphan.join(', ')}.`);
  const isOnboardingPlan = plan.code === settings.onboardingPlanCode;
  if (isOnboardingPlan && from) {
    const removed = diff(from.modules, to.modules);
    if (removed.length) warnings.push(`New associations are given this plan, and they will no longer get: ${removed.join(', ')}.`);
  }
  if (from && (diff(from.modules, to.modules).length || diff(from.features, to.features).length)) {
    warnings.push('Some modules or features are being removed. Existing subscribers keep them until you migrate them.');
  }

  return {
    planId,
    planName: plan.name,
    hasPublished: !!current,
    fromVersion: current?.version ?? null,
    toVersion: draft.version,
    price: {
      monthly: { from: from?.priceMonthlyKobo ?? null, to: to.priceMonthlyKobo },
      annual: { from: from?.priceAnnualKobo ?? null, to: to.priceAnnualKobo },
    },
    modulesAdded: diff(to.modules, from?.modules ?? []),
    modulesRemoved: diff(from?.modules ?? [], to.modules),
    featuresAdded: diff(to.features, from?.features ?? []),
    featuresRemoved: diff(from?.features ?? [], to.features),
    limits: { from: from?.limits ?? {}, to: to.limits },
    subscribersOnCurrentVersion: subscribers,
    isOnboardingPlan,
    warnings,
    blockers,
  };
}

export async function publishDraft(planId: number, actor: Actor, reason?: string) {
  const preview = await previewPublish(planId);
  if (preview.blockers.length) throw new BillingError('CANNOT_PUBLISH', preview.blockers.join(' '));
  // A change to something customers already pay for needs a recorded reason.
  const why = (reason ?? '').trim();
  if (preview.hasPublished && why.length < 10) {
    throw new BillingError('REASON_REQUIRED', 'Give a reason of at least 10 characters for changing a plan that is already on sale. It is kept in the audit trail.');
  }

  const version = await prisma.$transaction(async (tx) => {
    const draft = await tx.planVersion.findFirst({ where: { planId, status: 'DRAFT' }, include: versionSelect });
    if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to publish.', 404);
    const current = await tx.planVersion.findFirst({ where: { planId, status: 'PUBLISHED' }, include: versionSelect });
    if (current) await tx.planVersion.update({ where: { id: current.id }, data: { status: 'SUPERSEDED' } });
    const now = new Date();
    const live = await tx.planVersion.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedAt: now, publishedBy: actor.id, changeNote: why || draft.changeNote },
      include: versionSelect,
    });
    await audit(tx, actor, {
      actionType: 'PLAN_VERSION_PUBLISHED',
      targetType: 'plan',
      targetId: planId,
      before: current ? snapshotOf(current) : undefined,
      after: snapshotOf(live),
      reason: why || undefined,
    });
    return live;
  });
  published();
  return version;
}

export async function duplicatePlan(planId: number, input: { code: string; name: string }, actor: Actor) {
  const source = await prisma.plan.findUnique({ where: { id: planId }, include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1, include: versionSelect } } });
  if (!source) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
  const v = source.versions[0];
  return createPlan(
    {
      code: input.code,
      name: input.name,
      description: source.description,
      highlights: Array.isArray(source.highlights) ? (source.highlights as string[]) : [],
      badgeLabel: null,
      isPublic: false,
      isActive: true,
      priceMonthlyKobo: v?.priceMonthlyKobo ?? 0,
      priceAnnualKobo: v?.priceAnnualKobo ?? 0,
      limits: (v?.limits ?? {}) as Record<string, number | null>,
      moduleCodes: v?.modules.map((m) => m.module.code) ?? [],
      featureCodes: v?.features.map((f) => f.feature.code) ?? [],
      changeNote: `Copy of ${source.name}`,
    },
    actor,
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Add-ons (same shape: identity + copy on the add-on, commercial terms on its versions)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface AddonMetaInput {
  name?: string;
  description?: string | null;
  highlights?: string[];
  isPublic?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  /** Add-ons sharing a family are tiers of one product: a tenant holds at most one. Null or empty = no family. */
  family?: string | null;
  /** Plan ids that may buy it. Empty or omitted = every plan. */
  eligiblePlanIds?: number[];
}

export async function listAddonsForBuilder() {
  const addons = await prisma.addon.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      eligiblePlans: { include: { plan: { select: { id: true, code: true, name: true } } } },
      versions: { orderBy: { version: 'desc' }, include: versionSelect },
    },
  });
  const counts = await prisma.tenantAddon.groupBy({ by: ['addonVersionId'], where: { status: 'ACTIVE' }, _count: { _all: true } });
  const byVersion = new Map(counts.map((c) => [c.addonVersionId, c._count._all]));
  return addons.map((a) => ({
    ...a,
    versions: a.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      priceMonthlyKobo: v.priceMonthlyKobo,
      priceAnnualKobo: v.priceAnnualKobo,
      limits: v.limits,
      changeNote: v.changeNote,
      publishedAt: v.publishedAt,
      moduleCodes: v.modules.map((m) => m.module.code),
      featureCodes: v.features.map((f) => f.feature.code),
      holders: byVersion.get(v.id) ?? 0,
    })),
  }));
}

export async function createAddon(input: { code: string; name: string } & AddonMetaInput & VersionInput, actor: Actor) {
  const code = input.code.trim().toLowerCase();
  if (!CODE_RE.test(code)) throw new BillingError('INVALID_CODE', 'The add-on code can use lower-case letters, numbers and single dashes only.');
  if (!input.name?.trim()) throw new BillingError('NAME_REQUIRED', 'Give the add-on a name.');
  const monthly = assertKobo(input.priceMonthlyKobo ?? 0, 'The monthly price');
  const annual = assertKobo(input.priceAnnualKobo ?? 0, 'The annual price');

  return prisma.$transaction(async (tx) => {
    if (await tx.addon.findUnique({ where: { code } })) throw new BillingError('CODE_TAKEN', `An add-on with the code "${code}" already exists.`, 409);
    const addon = await tx.addon.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description ?? null,
        highlights: cleanHighlights(input.highlights) ?? [],
        family: cleanFamily(input.family),
        isPublic: input.isPublic ?? false,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        eligiblePlans: { create: [...new Set(input.eligiblePlanIds ?? [])].map((planId) => ({ planId })) },
      },
    });
    const moduleIds = input.moduleCodes?.length ? await resolveModuleIds(tx, input.moduleCodes) : [];
    const featureIds = input.featureCodes?.length ? await resolveFeatureIds(tx, input.featureCodes) : [];
    await tx.addonVersion.create({
      data: {
        addonId: addon.id,
        version: 1,
        status: 'DRAFT',
        priceMonthlyKobo: monthly,
        priceAnnualKobo: annual,
        limits: cleanLimits(input.limits, 'addon'),
        createdBy: actor.id,
        modules: { create: moduleIds.map((moduleId) => ({ moduleId })) },
        features: { create: featureIds.map((featureId) => ({ featureId })) },
      },
    });
    await audit(tx, actor, { actionType: 'ADDON_CREATED', targetType: 'addon', targetId: addon.id, after: { code, name: addon.name } });
    return addon;
  });
}

export async function updateAddonMeta(addonId: number, patch: AddonMetaInput, actor: Actor, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.addon.findUnique({ where: { id: addonId } });
    if (!before) throw new BillingError('ADDON_NOT_FOUND', 'Add-on not found.', 404);
    if (patch.eligiblePlanIds) {
      await tx.addonEligiblePlan.deleteMany({ where: { addonId } });
      await tx.addonEligiblePlan.createMany({ data: [...new Set(patch.eligiblePlanIds)].map((planId) => ({ addonId, planId })) });
    }
    const after = await tx.addon.update({
      where: { id: addonId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.highlights !== undefined ? { highlights: cleanHighlights(patch.highlights) } : {}),
        ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.family !== undefined ? { family: cleanFamily(patch.family) } : {}),
      },
    });
    await audit(tx, actor, { actionType: 'ADDON_UPDATED', targetType: 'addon', targetId: addonId, before: { name: before.name, isPublic: before.isPublic, isActive: before.isActive }, after: { name: after.name, isPublic: after.isPublic, isActive: after.isActive, eligiblePlanIds: patch.eligiblePlanIds }, reason });
    return after;
  });
  published();
  return result;
}

export async function archiveAddon(addonId: number, actor: Actor, reason: string) {
  const result = await prisma.$transaction(async (tx) => {
    const before = await tx.addon.findUnique({ where: { id: addonId } });
    if (!before) throw new BillingError('ADDON_NOT_FOUND', 'Add-on not found.', 404);
    const after = await tx.addon.update({ where: { id: addonId }, data: { isArchived: true, isActive: false, isPublic: false } });
    await audit(tx, actor, { actionType: 'ADDON_ARCHIVED', targetType: 'addon', targetId: addonId, before: { isArchived: before.isArchived }, after: { isArchived: true }, reason });
    return after;
  });
  published();
  return result;
}

export async function getOrCreateAddonDraft(addonId: number, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.addonVersion.findFirst({ where: { addonId, status: 'DRAFT' }, include: versionSelect });
    if (existing) return existing;
    const latest = await tx.addonVersion.findFirst({ where: { addonId }, orderBy: { version: 'desc' }, include: versionSelect });
    const source = (await tx.addonVersion.findFirst({ where: { addonId, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, include: versionSelect })) ?? latest;
    if (!(await tx.addon.findUnique({ where: { id: addonId } }))) throw new BillingError('ADDON_NOT_FOUND', 'Add-on not found.', 404);
    return tx.addonVersion.create({
      data: {
        addonId,
        version: (latest?.version ?? 0) + 1,
        status: 'DRAFT',
        priceMonthlyKobo: source?.priceMonthlyKobo ?? 0,
        priceAnnualKobo: source?.priceAnnualKobo ?? 0,
        limits: (source?.limits ?? {}) as Prisma.InputJsonValue,
        createdBy: actor.id,
        modules: { create: (source?.modules ?? []).map((m) => ({ moduleId: m.moduleId })) },
        features: { create: (source?.features ?? []).map((f) => ({ featureId: f.featureId })) },
      },
      include: versionSelect,
    });
  });
}

export async function updateAddonDraft(addonId: number, patch: VersionInput) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.addonVersion.findFirst({ where: { addonId, status: 'DRAFT' } });
    if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to edit. Start one first.', 404);
    const data: Prisma.AddonVersionUpdateInput = {};
    if (patch.priceMonthlyKobo !== undefined) data.priceMonthlyKobo = assertKobo(patch.priceMonthlyKobo, 'The monthly price');
    if (patch.priceAnnualKobo !== undefined) data.priceAnnualKobo = assertKobo(patch.priceAnnualKobo, 'The annual price');
    if (patch.limits !== undefined) data.limits = cleanLimits(patch.limits, 'addon');
    if (patch.changeNote !== undefined) data.changeNote = patch.changeNote;
    if (patch.moduleCodes !== undefined) {
      const ids = patch.moduleCodes.length ? await resolveModuleIds(tx, patch.moduleCodes) : [];
      await tx.addonVersionModule.deleteMany({ where: { addonVersionId: draft.id } });
      await tx.addonVersionModule.createMany({ data: ids.map((moduleId) => ({ addonVersionId: draft.id, moduleId })) });
    }
    if (patch.featureCodes !== undefined) {
      const ids = patch.featureCodes.length ? await resolveFeatureIds(tx, patch.featureCodes) : [];
      await tx.addonVersionFeature.deleteMany({ where: { addonVersionId: draft.id } });
      await tx.addonVersionFeature.createMany({ data: ids.map((featureId) => ({ addonVersionId: draft.id, featureId })) });
    }
    return tx.addonVersion.update({ where: { id: draft.id }, data, include: versionSelect });
  });
}

export async function publishAddonDraft(addonId: number, actor: Actor, reason?: string) {
  const version = await prisma.$transaction(async (tx) => {
    const draft = await tx.addonVersion.findFirst({ where: { addonId, status: 'DRAFT' }, include: versionSelect });
    if (!draft) throw new BillingError('NO_DRAFT', 'There is no draft to publish.', 404);
    const current = await tx.addonVersion.findFirst({ where: { addonId, status: 'PUBLISHED' }, include: versionSelect });
    const why = (reason ?? '').trim();
    if (current && why.length < 10) throw new BillingError('REASON_REQUIRED', 'Give a reason of at least 10 characters for changing an add-on that is already on sale.');
    if (draft.modules.length === 0 && draft.features.length === 0 && !draft.limits) {
      throw new BillingError('CANNOT_PUBLISH', 'An add-on needs to unlock at least one module, feature or limit.');
    }
    if (current) await tx.addonVersion.update({ where: { id: current.id }, data: { status: 'SUPERSEDED' } });
    const live = await tx.addonVersion.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED', publishedAt: new Date(), publishedBy: actor.id, changeNote: why || draft.changeNote },
      include: versionSelect,
    });
    await audit(tx, actor, { actionType: 'ADDON_VERSION_PUBLISHED', targetType: 'addon', targetId: addonId, before: current ? snapshotOf(current) : undefined, after: snapshotOf(live), reason: why || undefined });
    return live;
  });
  published();
  return version;
}
