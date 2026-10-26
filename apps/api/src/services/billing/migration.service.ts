/**
 * Moving existing subscribers from one version of a plan to another.
 *
 * Publishing a new version never touches current subscribers. This is the deliberate, reviewed way to do it: preview who is affected and
 * what changes, schedule it for a date with a reason, and apply it. Entitlements change from the moment it is applied; the new price
 * starts at the subscriber's next renewal (what they already paid for is not changed).
 */
import prisma from '../../lib/prisma';
import { afterBillingChange, requireReason, type Actor } from './lifecycle.service';
import { notifyBillingEvent } from './billing-notifications.service';
import { snapshotOf } from './plan-builder.service';
import { BillingError } from './quote.service';
import { priceForCycle } from './money';

const LIVE = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;
const versionInclude = {
  modules: { include: { module: { select: { code: true } } } },
  features: { include: { feature: { select: { code: true } } } },
} as const;

export interface MigrationPreview {
  planId: number;
  planName: string;
  from: { id: number; version: number };
  to: { id: number; version: number };
  affectedSubscriptions: number;
  priceChange: { monthlyKobo: { from: number; to: number }; annualKobo: { from: number; to: number } };
  modulesGained: string[];
  modulesLost: string[];
  featuresGained: string[];
  featuresLost: string[];
  /** The first 50 affected associations and what each would pay at its next renewal. */
  sample: { associationId: number; associationName: string; billingCycle: string; currentPriceKobo: number; newPriceKobo: number; periodEnd: string }[];
}

async function loadPair(planId: number, fromVersionId: number, toVersionId: number) {
  if (fromVersionId === toVersionId) throw new BillingError('SAME_VERSION', 'Choose two different versions.');
  const [plan, from, to] = await Promise.all([
    prisma.plan.findUnique({ where: { id: planId } }),
    prisma.planVersion.findFirst({ where: { id: fromVersionId, planId }, include: versionInclude }),
    prisma.planVersion.findFirst({ where: { id: toVersionId, planId }, include: versionInclude }),
  ]);
  if (!plan) throw new BillingError('PLAN_NOT_FOUND', 'Plan not found.', 404);
  if (!from || !to) throw new BillingError('VERSION_NOT_FOUND', 'Both versions must belong to this plan.', 404);
  // Subscribers can only be moved onto a version that has been published (never onto a draft).
  if (to.status === 'DRAFT') throw new BillingError('VERSION_NOT_PUBLISHED', 'You can only move subscribers onto a published version.');
  return { plan, from, to };
}

export async function previewMigration(input: { planId: number; fromVersionId: number; toVersionId: number }): Promise<MigrationPreview> {
  const { plan, from, to } = await loadPair(input.planId, input.fromVersionId, input.toVersionId);
  const subs = await prisma.subscription.findMany({
    where: { planVersionId: from.id, status: { in: [...LIVE] } },
    include: { association: { select: { id: true, name: true } } },
    orderBy: { currentPeriodEnd: 'asc' },
  });
  const a = snapshotOf(from);
  const b = snapshotOf(to);
  const diff = (x: string[], y: string[]) => x.filter((v) => !y.includes(v));

  return {
    planId: plan.id,
    planName: plan.name,
    from: { id: from.id, version: from.version },
    to: { id: to.id, version: to.version },
    affectedSubscriptions: subs.length,
    priceChange: {
      monthlyKobo: { from: from.priceMonthlyKobo, to: to.priceMonthlyKobo },
      annualKobo: { from: from.priceAnnualKobo, to: to.priceAnnualKobo },
    },
    modulesGained: diff(b.modules, a.modules),
    modulesLost: diff(a.modules, b.modules),
    featuresGained: diff(b.features, a.features),
    featuresLost: diff(a.features, b.features),
    sample: subs.slice(0, 50).map((s) => ({
      associationId: s.association.id,
      associationName: s.association.name,
      billingCycle: s.billingCycle,
      currentPriceKobo: priceForCycle(from, s.billingCycle),
      newPriceKobo: priceForCycle(to, s.billingCycle),
      periodEnd: s.currentPeriodEnd.toISOString(),
    })),
  };
}

export async function scheduleMigration(input: { planId: number; fromVersionId: number; toVersionId: number; effectiveAt: Date; reason: unknown }, actor: Actor) {
  const reason = requireReason(input.reason);
  const preview = await previewMigration(input);
  if (preview.affectedSubscriptions === 0) throw new BillingError('NOBODY_TO_MOVE', 'No current subscribers are on that version, so there is nothing to migrate.');
  const effectiveAt = input.effectiveAt;
  if (Number.isNaN(effectiveAt.getTime())) throw new BillingError('INVALID_DATE', 'Choose a valid effective date.');

  const migration = await prisma.$transaction(async (tx) => {
    const created = await tx.planMigration.create({
      data: {
        planId: input.planId,
        fromVersionId: input.fromVersionId,
        toVersionId: input.toVersionId,
        effectiveAt,
        reason,
        summary: JSON.parse(JSON.stringify({ ...preview, sample: preview.sample.slice(0, 10) })),
        affectedCount: preview.affectedSubscriptions,
        createdBy: actor.id,
      },
    });
    await tx.platformActionLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        actionType: 'PLAN_MIGRATION_SCHEDULED',
        targetType: 'plan',
        targetId: input.planId,
        beforeState: { versionId: input.fromVersionId },
        afterState: { versionId: input.toVersionId, effectiveAt: effectiveAt.toISOString(), affected: preview.affectedSubscriptions },
        reason,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
    return created;
  });

  // Tell the affected subscribers what is coming and when.
  const subs = await prisma.subscription.findMany({ where: { planVersionId: input.fromVersionId, status: { in: [...LIVE] } }, select: { associationId: true } });
  for (const s of subs) void notifyBillingEvent({ type: 'PLAN_TERMS_CHANGED', associationId: s.associationId, planName: preview.planName, effectiveAt });

  // Effective now: apply straight away instead of waiting for the next hourly run.
  if (effectiveAt.getTime() <= Date.now() + 60_000) await applyMigration(migration.id);
  return prisma.planMigration.findUniqueOrThrow({ where: { id: migration.id } });
}

export async function cancelMigration(id: number, reason: unknown, actor: Actor) {
  const why = requireReason(reason);
  return prisma.$transaction(async (tx) => {
    const m = await tx.planMigration.findUnique({ where: { id } });
    if (!m) throw new BillingError('MIGRATION_NOT_FOUND', 'Migration not found.', 404);
    if (m.status !== 'SCHEDULED') throw new BillingError('NOT_SCHEDULED', 'Only a scheduled migration can be cancelled.');
    const updated = await tx.planMigration.update({ where: { id }, data: { status: 'CANCELLED' } });
    await tx.platformActionLog.create({
      data: { actorId: actor.id, actorRole: actor.role, actionType: 'PLAN_MIGRATION_CANCELLED', targetType: 'plan', targetId: m.planId, afterState: { migrationId: id }, reason: why },
    });
    return updated;
  });
}

export async function listMigrations(planId?: number) {
  return prisma.planMigration.findMany({
    where: planId ? { planId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { fromVersion: { select: { version: true } }, toVersion: { select: { version: true } }, plan: { select: { name: true, code: true } } },
  });
}

/** Apply one scheduled migration. Safe to call twice: the status is claimed first. */
export async function applyMigration(id: number): Promise<number> {
  const now = new Date();
  const touched: number[] = [];
  const applied = await prisma.$transaction(async (tx) => {
    const claimed = await tx.planMigration.updateMany({ where: { id, status: 'SCHEDULED' }, data: { status: 'APPLIED', appliedAt: now } });
    if (claimed.count === 0) return 0;
    const m = await tx.planMigration.findUniqueOrThrow({ where: { id } });
    const subs = await tx.subscription.findMany({ where: { planVersionId: m.fromVersionId, status: { in: [...LIVE] } } });

    for (const sub of subs) {
      await tx.subscription.update({ where: { id: sub.id }, data: { planVersionId: m.toVersionId } });
      await tx.subscriptionTerm.create({
        data: {
          subscriptionId: sub.id,
          associationId: sub.associationId,
          planVersionId: m.toVersionId,
          kind: 'MIGRATION',
          billingCycle: sub.billingCycle,
          startsAt: now,
          endsAt: sub.currentPeriodEnd,
          amountKobo: 0,
          actorId: m.createdBy,
          reason: m.reason,
        },
      });
      touched.push(sub.associationId);
    }
    if (subs.length > 0) {
      await tx.platformActionLog.createMany({
        data: subs.map((s) => ({
          actorId: m.createdBy,
          actorRole: 'PLATFORM_ADMIN',
          actionType: 'SUBSCRIPTION_MIGRATED',
          targetType: 'subscription',
          targetId: s.id,
          associationId: s.associationId,
          beforeState: { planVersionId: m.fromVersionId },
          afterState: { planVersionId: m.toVersionId, migrationId: m.id },
          reason: m.reason,
        })),
      });
    }
    await tx.planMigration.update({ where: { id }, data: { affectedCount: subs.length } });
    return subs.length;
  });
  for (const associationId of touched) afterBillingChange(associationId);
  return applied;
}

/** Apply every scheduled migration whose date has arrived. Called by the hourly maintenance job. */
export async function applyDueMigrations(now = new Date()): Promise<number> {
  const due = await prisma.planMigration.findMany({ where: { status: 'SCHEDULED', effectiveAt: { lte: now } }, select: { id: true } });
  let total = 0;
  for (const m of due) total += await applyMigration(m.id);
  return total;
}
