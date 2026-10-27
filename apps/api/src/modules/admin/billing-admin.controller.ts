import { Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PlatformSettingsService } from './platform-settings.service';
import { getAssociationAccess } from '../../services/subscription-access.service';
import { getEntitlements } from '../../services/billing/entitlements.service';
import { LIMIT_DEFINITIONS, toCatalogPlan } from '../../services/billing/catalog.service';
import { BillingError } from '../../services/billing/quote.service';
import * as builder from '../../services/billing/plan-builder.service';
import * as lifecycle from '../../services/billing/lifecycle.service';
import * as migrations from '../../services/billing/migration.service';
import { afterBillingChange } from '../../services/billing/lifecycle.service';
import { priceForCycle } from '../../services/billing/money';

const id = z.coerce.number().int().positive();
const reason = z.string().trim().min(10, 'Give a reason of at least 10 characters.').max(500);
const kobo = z.number().int().min(0).max(2_000_000_000);
const limits = z.record(z.string(), z.number().int().min(0).nullable());
const codes = z.array(z.string().min(1)).max(200);

const metaSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  highlights: z.array(z.string().max(120)).max(12).optional(),
  badgeLabel: z.string().trim().max(30).nullable().optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
const versionSchema = z.object({
  priceMonthlyKobo: kobo.optional(),
  priceAnnualKobo: kobo.optional(),
  limits: limits.optional(),
  moduleCodes: codes.optional(),
  featureCodes: codes.optional(),
  changeNote: z.string().max(500).optional(),
});
const codeSchema = z.string().trim().toLowerCase().min(2).max(40);

function actor(req: AuthRequest): lifecycle.Actor {
  return {
    id: req.user!.id,
    role: String(req.user?.platformRole ?? 'SUPER_ADMIN'),
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}

function fail(res: Response, error: unknown, fallback: string) {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Invalid input', errors: error.issues });
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

const wrap =
  (fallback: string, fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthRequest, res: Response) => {
    try {
      await fn(req, res);
    } catch (error) {
      fail(res, error, fallback);
    }
  };

const ok = (res: Response, data: unknown, message?: string) => res.json({ success: true, ...(message ? { message } : {}), data });

export const billingAdmin = {
  // ------------------------------------------------------------------ catalog helpers
  catalog: wrap('Failed to load the catalog', async (_req, res) => {
    const [modules, features] = await Promise.all([
      prisma.platformModule.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.platformFeature.findMany({ include: { module: { select: { code: true } } }, orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] }),
    ]);
    ok(res, {
      modules: modules.map((m) => ({ code: m.code, name: m.name, description: m.description, isCore: m.isCore })),
      features: features.map((f) => ({ code: f.code, name: f.name, description: f.description, moduleCode: f.module.code, isCore: f.isCore })),
      limits: LIMIT_DEFINITIONS,
    });
  }),

  // ------------------------------------------------------------------ plans
  listPlans: wrap('Failed to load plans', async (_req, res) => ok(res, await builder.listPlansForBuilder())),

  createPlan: wrap('Failed to create the plan', async (req, res) => {
    const body = metaSchema
      .merge(versionSchema)
      .extend({ code: codeSchema, name: z.string().trim().min(1).max(80) })
      .parse(req.body);
    ok(res, await builder.createPlan(body, actor(req)), 'Plan created as a draft. Publish it when it is ready.');
  }),

  updatePlan: wrap('Failed to update the plan', async (req, res) => {
    const body = metaSchema.extend({ reason: reason.optional() }).parse(req.body);
    const { reason: why, ...patch } = body;
    ok(res, await builder.updatePlanMeta(id.parse(req.params.id), patch, actor(req), why), 'Plan updated.');
  }),

  archivePlan: wrap('Failed to archive the plan', async (req, res) => {
    ok(res, await builder.archivePlan(id.parse(req.params.id), actor(req), reason.parse(req.body?.reason)), 'Plan archived. Existing subscriptions are not affected.');
  }),

  restorePlan: wrap('Failed to restore the plan', async (req, res) => {
    ok(res, await builder.restorePlan(id.parse(req.params.id), actor(req), reason.parse(req.body?.reason)), 'Plan restored. Turn it on when you want to sell it again.');
  }),

  duplicatePlan: wrap('Failed to duplicate the plan', async (req, res) => {
    const body = z.object({ code: codeSchema, name: z.string().trim().min(1).max(80) }).parse(req.body);
    ok(res, await builder.duplicatePlan(id.parse(req.params.id), body, actor(req)), 'Plan duplicated as a draft.');
  }),

  startDraft: wrap('Failed to start a draft', async (req, res) => ok(res, await builder.getOrCreateDraft(id.parse(req.params.id), actor(req)))),
  updateDraft: wrap('Failed to save the draft', async (req, res) => ok(res, await builder.updateDraft(id.parse(req.params.id), versionSchema.parse(req.body), actor(req)), 'Draft saved.')),
  discardDraft: wrap('Failed to discard the draft', async (req, res) => {
    await builder.discardDraft(id.parse(req.params.id), actor(req));
    ok(res, null, 'Draft discarded.');
  }),
  previewPublish: wrap('Failed to preview the change', async (req, res) => ok(res, await builder.previewPublish(id.parse(req.params.id)))),
  publish: wrap('Failed to publish', async (req, res) => {
    const version = await builder.publishDraft(id.parse(req.params.id), actor(req), req.body?.reason);
    ok(res, { version: version.version }, 'Published. New sign-ups and renewals now use this version; existing subscribers keep theirs until you migrate them.');
  }),

  /** What the pricing page would look like if every draft were published now (nothing is saved or shown to customers). */
  previewCatalog: wrap('Failed to build the preview', async (_req, res) => {
    const plans = await prisma.plan.findMany({
      where: { isArchived: false },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        versions: {
          where: { status: { in: ['DRAFT', 'PUBLISHED'] } },
          orderBy: [{ status: 'asc' }, { version: 'desc' }],
          include: {
            modules: { include: { module: true } },
            features: { include: { feature: { include: { module: true } } } },
          },
        },
      },
    });
    const items = plans
      .map((p) => {
        const version = p.versions.find((v) => v.status === 'DRAFT') ?? p.versions.find((v) => v.status === 'PUBLISHED');
        if (!version) return null;
        const item = toCatalogPlan({ ...p, versions: [version] } as never);
        return item ? { ...item, isDraft: version.status === 'DRAFT' } : null;
      })
      .filter(Boolean);
    ok(res, items);
  }),

  // ------------------------------------------------------------------ add-ons
  listAddons: wrap('Failed to load add-ons', async (_req, res) => ok(res, await builder.listAddonsForBuilder())),
  createAddon: wrap('Failed to create the add-on', async (req, res) => {
    const body = metaSchema
      .merge(versionSchema)
      .extend({ code: codeSchema, name: z.string().trim().min(1).max(80), eligiblePlanIds: z.array(id).max(50).optional(), family: z.string().trim().max(40).nullable().optional() })
      .parse(req.body);
    ok(res, await builder.createAddon(body, actor(req)), 'Add-on created as a draft. Publish it when it is ready.');
  }),
  updateAddon: wrap('Failed to update the add-on', async (req, res) => {
    const body = metaSchema.extend({ eligiblePlanIds: z.array(id).max(50).optional(), family: z.string().trim().max(40).nullable().optional(), reason: reason.optional() }).parse(req.body);
    const { reason: why, ...patch } = body;
    ok(res, await builder.updateAddonMeta(id.parse(req.params.id), patch, actor(req), why), 'Add-on updated.');
  }),
  archiveAddon: wrap('Failed to archive the add-on', async (req, res) => {
    ok(res, await builder.archiveAddon(id.parse(req.params.id), actor(req), reason.parse(req.body?.reason)), 'Add-on archived. Holders keep it until it ends.');
  }),
  startAddonDraft: wrap('Failed to start a draft', async (req, res) => ok(res, await builder.getOrCreateAddonDraft(id.parse(req.params.id), actor(req)))),
  updateAddonDraft: wrap('Failed to save the draft', async (req, res) => ok(res, await builder.updateAddonDraft(id.parse(req.params.id), versionSchema.parse(req.body)), 'Draft saved.')),
  publishAddon: wrap('Failed to publish', async (req, res) => {
    const version = await builder.publishAddonDraft(id.parse(req.params.id), actor(req), req.body?.reason);
    ok(res, { version: version.version }, 'Published.');
  }),

  // ------------------------------------------------------------------ subscriptions
  listSubscriptions: wrap('Failed to load subscriptions', async (req, res) => {
    const q = z
      .object({
        search: z.string().trim().max(80).optional(),
        status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']).optional(),
        planId: id.optional(),
        endingInDays: z.coerce.number().int().min(1).max(365).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);

    const now = new Date();
    const where: Prisma.SubscriptionWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.planId ? { planId: q.planId } : {}),
      ...(q.endingInDays ? { currentPeriodEnd: { gt: now, lte: new Date(now.getTime() + q.endingInDays * 86_400_000) }, status: { in: ['ACTIVE', 'TRIALING'] } } : {}),
      ...(q.search ? { association: { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { subdomain: { contains: q.search, mode: 'insensitive' } }] } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        orderBy: { currentPeriodEnd: q.endingInDays ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          association: { select: { id: true, name: true, subdomain: true, status: true } },
          plan: { select: { id: true, name: true, code: true } },
          planVersion: { select: { id: true, version: true, priceMonthlyKobo: true, priceAnnualKobo: true } },
        },
      }),
    ]);
    ok(res, {
      total,
      page: q.page,
      limit: q.limit,
      items: rows.map((s) => ({
        id: s.id,
        association: s.association,
        plan: s.plan,
        planVersion: s.planVersion.version,
        source: s.source,
        status: s.status,
        billingCycle: s.billingCycle,
        priceKobo: priceForCycle(s.planVersion, s.billingCycle),
        startedAt: s.currentPeriodStart,
        endsAt: s.currentPeriodEnd,
        trialEndsAt: s.trialEndsAt,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      })),
    });
  }),

  getSubscription: wrap('Failed to load the subscription', async (req, res) => {
    const associationId = id.parse(req.params.associationId);
    const association = await prisma.association.findUnique({ where: { id: associationId }, select: { id: true, name: true, subdomain: true, status: true, tier: true } });
    if (!association) throw new BillingError('ASSOCIATION_NOT_FOUND', 'Association not found.', 404);

    const subs = await prisma.subscription.findMany({
      where: { associationId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, planVersion: true },
    });
    const subscriptionIds = subs.map((s) => s.id);
    const [access, entitlements, terms, payments, addons, history] = await Promise.all([
      getAssociationAccess(associationId),
      getEntitlements(associationId),
      prisma.subscriptionTerm.findMany({ where: { associationId }, orderBy: { startsAt: 'desc' }, take: 50 }),
      prisma.paymentHistory.findMany({
        where: { subscriptionId: { in: subscriptionIds } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, amount: true, status: true, provider: true, reference: true, paidAt: true, purpose: true, needsReview: true, expectedAmountKobo: true, appliedAt: true, createdAt: true },
      }),
      prisma.tenantAddon.findMany({ where: { associationId }, orderBy: { createdAt: 'desc' }, include: { addonVersion: { include: { addon: { select: { name: true, code: true } } } } } }),
      prisma.platformActionLog.findMany({
        where: { associationId, OR: [{ actionType: { startsWith: 'SUBSCRIPTION' } }, { actionType: { startsWith: 'ADDON' } }, { actionType: { startsWith: 'PLAN' } }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    ok(res, {
      association,
      access,
      subscriptions: subs,
      terms,
      payments,
      addons: addons.map((a) => ({ id: a.id, status: a.status, name: a.addonVersion.addon.name, code: a.addonVersion.addon.code, version: a.addonVersion.version, startsAt: a.startsAt, endsAt: a.endsAt, source: a.source, amountPaidKobo: a.amountPaidKobo, cancelAtPeriodEnd: a.cancelAtPeriodEnd })),
      entitlements: {
        planCode: entitlements.planCode,
        modules: [...entitlements.modules.values()].filter((m) => m.isEnabled).map((m) => ({ code: m.code, source: m.source })),
        features: [...entitlements.features.values()].filter((f) => f.isEnabled).map((f) => ({ code: f.code, source: f.source })),
        limits: entitlements.limits,
      },
      history,
    });
  }),

  activate: wrap('Failed to activate the subscription', async (req, res) => {
    const body = z
      .object({
        planId: id,
        planVersionId: id.optional(),
        billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
        days: z.number().int().min(1).max(1100).optional(),
        endsAt: z.coerce.date().optional(),
        complimentary: z.boolean().optional(),
        reason,
      })
      .parse(req.body);
    const sub = await lifecycle.activateManually({ associationId: id.parse(req.params.associationId), ...body, actor: actor(req) });
    ok(res, sub, 'Subscription activated. No payment was recorded.');
  }),
  extend: wrap('Failed to extend the subscription', async (req, res) => {
    const body = z.object({ days: z.number().int().min(1).max(366), reason }).parse(req.body);
    ok(res, await lifecycle.extendSubscription({ associationId: id.parse(req.params.associationId), ...body, actor: actor(req) }), 'Subscription extended.');
  }),
  suspend: wrap('Failed to suspend the subscription', async (req, res) => {
    ok(res, await lifecycle.suspendSubscription({ associationId: id.parse(req.params.associationId), reason: req.body?.reason, actor: actor(req) }), 'Subscription suspended. Their records are untouched.');
  }),
  reactivate: wrap('Failed to reactivate the subscription', async (req, res) => {
    ok(res, await lifecycle.reactivateSubscription({ associationId: id.parse(req.params.associationId), reason: req.body?.reason, actor: actor(req) }), 'Subscription reactivated.');
  }),
  grantAddon: wrap('Failed to grant the add-on', async (req, res) => {
    const body = z.object({ addonId: id, reason }).parse(req.body);
    ok(res, await lifecycle.grantAddonManually({ associationId: id.parse(req.params.associationId), ...body, actor: actor(req) }), 'Add-on granted until the plan renewal date.');
  }),

  // ------------------------------------------------------------------ payments needing attention
  listPayments: wrap('Failed to load payments', async (req, res) => {
    const q = z
      .object({ filter: z.enum(['REVIEW', 'FAILED', 'PENDING']).default('REVIEW'), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) })
      .parse(req.query);
    const where: Prisma.PaymentHistoryWhereInput = q.filter === 'REVIEW' ? { needsReview: true, appliedAt: null } : { status: q.filter };
    const [total, rows] = await Promise.all([
      prisma.paymentHistory.count({ where }),
      prisma.paymentHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { subscription: { select: { associationId: true, association: { select: { name: true, subdomain: true } } } } },
      }),
    ]);
    ok(res, {
      total,
      items: rows.map((p) => ({
        id: p.id,
        reference: p.reference,
        provider: p.provider,
        purpose: p.purpose,
        status: p.status,
        amount: p.amount,
        expectedAmountKobo: p.expectedAmountKobo,
        needsReview: p.needsReview,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        association: { id: p.subscription.associationId, ...p.subscription.association },
      })),
    });
  }),

  /** Close a flagged payment without activating anything (for example after refunding it at the gateway). */
  closeReview: wrap('Failed to close the review', async (req, res) => {
    const paymentId = id.parse(req.params.paymentId);
    const why = reason.parse(req.body?.reason);
    const a = actor(req);
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.paymentHistory.findUnique({ where: { id: paymentId }, include: { subscription: { select: { associationId: true } } } });
      if (!p || !p.needsReview || p.appliedAt) throw new BillingError('NOT_IN_REVIEW', 'That payment is not waiting for review.', 404);
      const updated = await tx.paymentHistory.update({ where: { id: paymentId }, data: { needsReview: false, appliedAt: new Date() } });
      await tx.platformActionLog.create({
        data: { actorId: a.id, actorRole: a.role, actionType: 'SUBSCRIPTION_PAYMENT_REVIEW_CLOSED', targetType: 'billing', targetId: paymentId, associationId: p.subscription.associationId, afterState: { reference: p.reference }, reason: why, ipAddress: a.ipAddress, userAgent: a.userAgent },
      });
      return updated;
    });
    ok(res, payment, 'Review closed. Nothing was activated.');
  }),

  // ------------------------------------------------------------------ migrations
  listMigrations: wrap('Failed to load migrations', async (req, res) => ok(res, await migrations.listMigrations(req.query.planId ? id.parse(req.query.planId) : undefined))),
  previewMigration: wrap('Failed to preview the migration', async (req, res) => {
    const body = z.object({ planId: id, fromVersionId: id, toVersionId: id }).parse(req.body);
    ok(res, await migrations.previewMigration(body));
  }),
  scheduleMigration: wrap('Failed to schedule the migration', async (req, res) => {
    const body = z.object({ planId: id, fromVersionId: id, toVersionId: id, effectiveAt: z.coerce.date(), reason }).parse(req.body);
    ok(res, await migrations.scheduleMigration(body, actor(req)), 'Migration scheduled. The affected subscribers have been told.');
  }),
  cancelMigration: wrap('Failed to cancel the migration', async (req, res) => ok(res, await migrations.cancelMigration(id.parse(req.params.id), req.body?.reason, actor(req)), 'Migration cancelled.')),

  // ------------------------------------------------------------------ onboarding policy (read-only summary of the settings)
  onboarding: wrap('Failed to load the onboarding settings', async (_req, res) => {
    const s = await PlatformSettingsService.getSettings();
    ok(res, { onboardingPolicy: s.onboardingPolicy, onboardingPlanCode: s.onboardingPlanCode, defaultTrialDays: s.defaultTrialDays, gracePeriodDays: s.gracePeriodDays, expiryReminderDays: s.expiryReminderDays });
  }),

  /** Refresh every cache that holds billing state (after a manual database change, for example). */
  refresh: wrap('Failed to refresh', async (_req, res) => {
    afterBillingChange(0);
    ok(res, null, 'Refreshed.');
  }),
};
