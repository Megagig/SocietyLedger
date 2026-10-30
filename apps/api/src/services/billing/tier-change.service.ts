/**
 * Staff change of an add-on tier (T9): move a tenant up or down a tier of one product family, with a reason, audited.
 *
 * Billing owns the add-on tables, so the Ajo oversight module asks here instead of reading them.
 *  - UPGRADE applies now. It is a staff override, so nothing is charged: the new tier runs to the end of the current period and the tenant
 *    pays the new tier's price at renewal.
 *  - DOWNGRADE waits for the end of the paid period when the tier was paid for (the tenant keeps what it bought); renewal then prices
 *    the lower tier. A tier that was never paid for (trial, complimentary, granted) has no period to honour, so it changes now.
 *  - A downgrade is refused when the tenant is over the lower tier's limit. Staff cannot force it: nobody loses data or access to a
 *    circle because of a price change; they remove contributors first (the capacity check already stops anyone new joining).
 */
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { afterBillingChange, grantAddonInTx, requireReason, type Actor } from './lifecycle.service';
import { BillingError } from './quote.service';

type Db = Prisma.TransactionClient;

export interface TierOption {
  addonId: number;
  code: string;
  name: string;
  sortOrder: number;
  isPublic: boolean;
  priceMonthlyKobo: number;
  priceAnnualKobo: number;
  /** Null = unlimited. */
  contributorLimit: number | null;
}

export interface HeldTier extends TierOption {
  tenantAddonId: number;
  endsAt: Date;
  amountPaidKobo: number;
  source: string;
  /** The tier it becomes at the end of the period, if a downgrade is waiting. */
  pendingAddonId: number | null;
}

const LIMIT_KEY = 'ajoContributors';

function limitOf(limits: unknown): number | null {
  if (!limits || typeof limits !== 'object') return null;
  const v = (limits as Record<string, unknown>)[LIMIT_KEY];
  return typeof v === 'number' ? v : null;
}

/** The published tiers of a family, smallest first. Archived and inactive ones are left out. */
export async function listTierOptions(family: string, db: Db = prisma): Promise<TierOption[]> {
  const addons = await db.addon.findMany({
    where: { family, isArchived: false, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { versions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } },
  });
  return addons.flatMap((a) => {
    const v = a.versions[0];
    return v
      ? [{ addonId: a.id, code: a.code, name: a.name, sortOrder: a.sortOrder, isPublic: a.isPublic, priceMonthlyKobo: v.priceMonthlyKobo, priceAnnualKobo: v.priceAnnualKobo, contributorLimit: limitOf(v.limits) }]
      : [];
  });
}

/** The tier the tenant holds right now in a family, or null. */
export async function getHeldTier(associationId: number, family: string, now: Date = new Date(), db: Db = prisma): Promise<HeldTier | null> {
  const row = await db.tenantAddon.findFirst({
    where: { associationId, status: 'ACTIVE', endsAt: { gt: now }, addonVersion: { addon: { family } } },
    orderBy: { endsAt: 'desc' },
    include: { addonVersion: { include: { addon: true } } },
  });
  if (!row) return null;
  const a = row.addonVersion.addon;
  return {
    addonId: a.id,
    code: a.code,
    name: a.name,
    sortOrder: a.sortOrder,
    isPublic: a.isPublic,
    priceMonthlyKobo: row.addonVersion.priceMonthlyKobo,
    priceAnnualKobo: row.addonVersion.priceAnnualKobo,
    contributorLimit: limitOf(row.addonVersion.limits),
    tenantAddonId: row.id,
    endsAt: row.endsAt,
    amountPaidKobo: row.amountPaidKobo,
    source: row.source,
    pendingAddonId: row.pendingAddonId,
  };
}

export interface TierDecision {
  direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME' | 'NEW';
  timing: 'NOW' | 'PERIOD_END';
  blockers: string[];
}

/** Pure. What would moving to `target` do, and is anything in the way? */
export function decideTierChange(input: {
  current: Pick<TierOption, 'sortOrder'> | null;
  target: Pick<TierOption, 'sortOrder' | 'name' | 'contributorLimit'>;
  activeContributors: number;
  /** The current tier was paid for, so the tenant keeps it until the period ends. */
  paid: boolean;
}): TierDecision {
  const { current, target, activeContributors, paid } = input;
  if (!current) return { direction: 'NEW', timing: 'NOW', blockers: [] };
  if (target.sortOrder === current.sortOrder) return { direction: 'SAME', timing: 'NOW', blockers: [] };
  if (target.sortOrder > current.sortOrder) return { direction: 'UPGRADE', timing: 'NOW', blockers: [] };
  const blockers: string[] = [];
  if (target.contributorLimit !== null && activeContributors > target.contributorLimit) {
    blockers.push(`${target.name} allows ${target.contributorLimit} active contributors and this group has ${activeContributors}. Ask the group to remove ${activeContributors - target.contributorLimit} first.`);
  }
  return { direction: 'DOWNGRADE', timing: paid ? 'PERIOD_END' : 'NOW', blockers };
}

export interface TierChangeInput {
  associationId: number;
  family: string;
  targetAddonId: number;
  /** The head count, or a function that reads it inside the change's own transaction (so it is the count at the moment of the lock). */
  activeContributors: number | ((db: Db) => Promise<number>);
  reason: unknown;
  actor: Actor;
}

async function headCount(input: Pick<TierChangeInput, 'activeContributors'>, db: Db): Promise<number> {
  return typeof input.activeContributors === 'number' ? input.activeContributors : input.activeContributors(db);
}

async function previewIn(db: Db, input: Omit<TierChangeInput, 'reason' | 'actor'>) {
  const [options, held] = await Promise.all([listTierOptions(input.family, db), getHeldTier(input.associationId, input.family, new Date(), db)]);
  const target = options.find((o) => o.addonId === input.targetAddonId);
  if (!target) throw new BillingError('TIER_NOT_FOUND', 'That tier is not available.', 404);
  const activeContributors = await headCount(input, db);
  const decision = decideTierChange({ current: held, target, activeContributors, paid: !!held && held.amountPaidKobo > 0 });
  return { current: held, target, decision, activeContributors, effectiveAt: decision.timing === 'PERIOD_END' && held ? held.endsAt : null };
}

export async function previewTierChange(input: Omit<TierChangeInput, 'reason' | 'actor'>) {
  return previewIn(prisma, input);
}

/**
 * Move a tenant to another tier. Returns when it takes effect. Throws BillingError when blocked.
 *
 * Everything happens in one transaction behind a per-tenant lock: two staff acting at once take turns, the second sees what the first did,
 * and the change and its Action log row either both happen or neither does.
 */
export async function changeTier(input: TierChangeInput): Promise<{ applied: 'NOW' | 'PERIOD_END' | 'CLEARED'; effectiveAt: Date | null }> {
  const reason = requireReason(input.reason);
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tier-change:' + input.associationId}))`;
    const { current: held, target, decision, activeContributors, effectiveAt } = await previewIn(tx, input);
    const state = (tier: string | null) => ({ tier, activeContributors });

    if (decision.blockers.length > 0) throw new BillingError('TIER_BLOCKED', decision.blockers.join(' '), 409);

    const log = (actionType: string, afterState: Prisma.InputJsonValue) =>
      tx.platformActionLog.create({
        data: {
          actorId: input.actor.id,
          actorRole: input.actor.role,
          actionType,
          targetType: 'ajo_tier',
          targetId: target.addonId,
          associationId: input.associationId,
          beforeState: state(held?.code ?? null),
          afterState,
          reason,
          ipAddress: input.actor.ipAddress,
          userAgent: input.actor.userAgent,
        },
      });

    if (decision.direction === 'SAME') {
      // Choosing the tier it already is answers a downgrade that was waiting; otherwise there is nothing to do.
      if (held?.pendingAddonId) {
        await tx.tenantAddon.update({ where: { id: held.tenantAddonId }, data: { pendingAddonId: null } });
        await log('AJO_TIER_DOWNGRADE_CANCELLED', { tier: target.code });
        return { applied: 'CLEARED' as const, effectiveAt: null };
      }
      throw new BillingError('TIER_UNCHANGED', `This group is already on ${target.name}.`, 409);
    }

    if (decision.timing === 'PERIOD_END' && held) {
      await tx.tenantAddon.update({ where: { id: held.tenantAddonId }, data: { pendingAddonId: target.addonId } });
      await log('AJO_TIER_DOWNGRADE_SCHEDULED', { tier: target.code, ...(effectiveAt ? { effectiveAt: effectiveAt.toISOString() } : {}) });
      return { applied: 'PERIOD_END' as const, effectiveAt };
    }

    // Now: the grant ends the tier it replaces, so a tenant never holds two tiers of one product. It writes the one audit row.
    await grantAddonInTx(tx, {
      associationId: input.associationId,
      addonId: target.addonId,
      reason,
      actor: input.actor,
      audit: { actionType: 'AJO_TIER_CHANGED', targetType: 'ajo_tier', targetId: target.addonId, beforeState: state(held?.code ?? null), afterState: { tier: target.code } },
    });
    return { applied: 'NOW' as const, effectiveAt: null };
  });
  afterBillingChange(input.associationId);
  return result;
}

export interface TierAdoptionRow {
  code: string;
  name: string;
  sortOrder: number;
  /** Tenants holding this tier right now, by who they are and whether the tier is paid for. */
  holders: number;
  paying: number;
  standalone: number;
  /** What the paying holders pay each month, with annual prices spread over 12 months. Kobo. */
  monthlyRecurringKobo: number;
}

/** How many tenants hold each tier of a family right now, and what the paying ones bring in each month. */
export async function tierAdoption(family: string, now: Date = new Date()): Promise<TierAdoptionRow[]> {
  const rows = await prisma.tenantAddon.findMany({
    where: { status: 'ACTIVE', endsAt: { gt: now }, addonVersion: { addon: { family } } },
    select: {
      associationId: true,
      source: true,
      amountPaidKobo: true,
      billingCycle: true,
      addonVersion: { select: { priceMonthlyKobo: true, priceAnnualKobo: true, addon: { select: { code: true, name: true, sortOrder: true } } } },
    },
  });
  const kinds = await prisma.association.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.associationId))] } }, select: { id: true, kind: true } });
  const kindOf = new Map(kinds.map((k) => [k.id, k.kind]));
  const out = new Map<string, TierAdoptionRow>();
  for (const r of rows) {
    const a = r.addonVersion.addon;
    const row = out.get(a.code) ?? { code: a.code, name: a.name, sortOrder: a.sortOrder, holders: 0, paying: 0, standalone: 0, monthlyRecurringKobo: 0 };
    row.holders += 1;
    if (kindOf.get(r.associationId) === 'THRIFT_GROUP') row.standalone += 1;
    if (r.source === 'PURCHASE' && r.amountPaidKobo > 0) {
      row.paying += 1;
      row.monthlyRecurringKobo += r.billingCycle === 'ANNUAL' ? Math.round(r.addonVersion.priceAnnualKobo / 12) : r.addonVersion.priceMonthlyKobo;
    }
    out.set(a.code, row);
  }
  return [...out.values()].sort((x, y) => x.sortOrder - y.sortOrder);
}

/**
 * What groups actually paid for a family's tiers, by month, from the verified payments' own stored quotes (the add-on row only remembers
 * its current term). Net of the credit for the unused part of a tier it replaced. Kobo, keyed "YYYY-MM" in UTC.
 */
export async function tierRevenueByMonth(family: string, from: Date): Promise<Map<string, number>> {
  const addonIds = new Set((await prisma.addon.findMany({ where: { family }, select: { id: true } })).map((a) => a.id));
  const payments = await prisma.paymentHistory.findMany({ where: { status: 'SUCCESS', paidAt: { gte: from } }, select: { paidAt: true, quote: true } });
  const out = new Map<string, number>();
  for (const p of payments) {
    const lines = (p.quote as { lines?: { type?: string; amountKobo?: number; addonId?: number }[] } | null)?.lines ?? [];
    const net = lines.filter((l) => (l.type === 'ADDON' || l.type === 'CREDIT') && l.addonId !== undefined && addonIds.has(l.addonId)).reduce((sum, l) => sum + (l.amountKobo ?? 0), 0);
    if (net === 0 || !p.paidAt) continue;
    const key = `${p.paidAt.getUTCFullYear()}-${String(p.paidAt.getUTCMonth() + 1).padStart(2, '0')}`;
    out.set(key, (out.get(key) ?? 0) + net);
  }
  return out;
}
