/**
 * SocietyLedger staff oversight of Ajo groups across every tenant (T9.2).
 *
 * Read first: staff see every association's and standalone thrift group's circles, members, payouts and cases so they can spot a problem.
 * They do not run groups. The only things staff can change are overrides (void a payout, move a group to another tier), and each one
 * needs a written reason and leaves a row in the platform Action log.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { changeTier, getHeldTier, listTierOptions, previewTierChange } from '../../services/billing/tier-change.service';
import type { Actor } from '../../services/billing/lifecycle.service';
import { countActiveContributors } from './ajo-capacity';
import { TenantManagementService } from '../../services/tenant-management.service';
import { levyReport } from './ajo-levy.service';
import { voidPayout } from './ajo-payout.service';
import { RuleError } from '../finance/rule-error';

export const AJO_FAMILY = 'ajo';
/** The free trial tier is never something staff move a group to. */
const NOT_A_TARGET = new Set(['ajo-trial']);
export const MIN_OVERRIDE_REASON = 10;

export interface GroupFilters {
  search?: string;
  kind?: 'ASSOCIATION' | 'THRIFT_GROUP';
  status?: 'DRAFT' | 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  model?: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  take?: number;
  skip?: number;
}

const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** More active contributors than the tier allows (null = unlimited). New people cannot join until the count is back under the limit; nobody already in loses anything. */
export function isOverLimit(limit: number | null | undefined, count: number): boolean {
  return limit !== null && limit !== undefined && count > limit;
}

export async function listGroups(filters: GroupFilters) {
  const where: Prisma.AjoGroupWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    association: {
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: 'insensitive' } } : {}),
    },
  };
  const take = Math.min(Math.max(filters.take ?? 25, 1), 100);
  const [rows, total] = await Promise.all([
    prisma.ajoGroup.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip: Math.max(filters.skip ?? 0, 0),
      include: { association: { select: { id: true, name: true, kind: true, status: true } } },
    }),
    prisma.ajoGroup.count({ where }),
  ]);
  const ids = rows.map((r) => r.id);
  const assocIds = [...new Set(rows.map((r) => r.associationId))];
  const [members, payouts, cases, tiers, counts] = await Promise.all([
    prisma.ajoMembership.groupBy({ by: ['groupId'], where: { groupId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
    prisma.ajoPayout.groupBy({ by: ['groupId'], where: { groupId: { in: ids }, status: { in: ['PREPARED', 'APPROVED'] } }, _count: { _all: true } }),
    prisma.ajoDefaultCase.groupBy({ by: ['groupId'], where: { groupId: { in: ids }, status: { in: ['OPEN', 'PLAN_AGREED'] } }, _count: { _all: true } }),
    Promise.all(assocIds.map(async (id) => [id, await getHeldTier(id, AJO_FAMILY)] as const)),
    Promise.all(assocIds.map(async (id) => [id, await countActiveContributors(id)] as const)),
  ]);
  const count = (list: { groupId: number; _count: { _all: number } }[]) => new Map(list.map((x) => [x.groupId, x._count._all]));
  const m = count(members);
  const p = count(payouts);
  const c = count(cases);
  const tierOf = new Map(tiers);
  const countOf = new Map(counts);
  return {
    total,
    items: rows.map((g) => ({
      id: g.id,
      name: g.name,
      association: g.association,
      model: g.model,
      status: g.status,
      frequency: g.frequency,
      contributionKobo: num(g.contributionKobo),
      participants: m.get(g.id) ?? 0,
      maxParticipants: g.maxParticipants,
      openPayouts: p.get(g.id) ?? 0,
      openCases: c.get(g.id) ?? 0,
      tier: tierOf.get(g.associationId) ? { code: tierOf.get(g.associationId)!.code, name: tierOf.get(g.associationId)!.name } : null,
      overLimit: isOverLimit(tierOf.get(g.associationId)?.contributorLimit, countOf.get(g.associationId) ?? 0),
      createdAt: g.createdAt,
    })),
  };
}

export async function getGroup(groupId: number) {
  const g = await prisma.ajoGroup.findUnique({
    where: { id: groupId },
    include: { association: { select: { id: true, name: true, kind: true, status: true, subdomain: true } } },
  });
  if (!g) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  const [memberStatus, payouts, cases, held, options, activeContributors, levy] = await Promise.all([
    prisma.ajoMembership.groupBy({ by: ['status'], where: { groupId }, _count: { _all: true } }),
    prisma.ajoPayout.findMany({
      where: { groupId },
      orderBy: { preparedAt: 'desc' },
      take: 50,
      include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } },
    }),
    prisma.ajoDefaultCase.findMany({
      where: { groupId },
      orderBy: { openedAt: 'desc' },
      take: 50,
      include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } },
    }),
    getHeldTier(g.associationId, AJO_FAMILY),
    listTierOptions(AJO_FAMILY),
    countActiveContributors(g.associationId),
    levyReport({ associationId: g.associationId }),
  ]);
  const nameOf = (m: { member: { firstName: string; lastName: string } }) => `${m.member.firstName} ${m.member.lastName}`.trim();
  return {
    id: g.id,
    name: g.name,
    association: g.association,
    model: g.model,
    status: g.status,
    frequency: g.frequency,
    contributionKobo: num(g.contributionKobo),
    maxParticipants: g.maxParticipants,
    startDate: g.startDate,
    startedAt: g.startedAt,
    cancelReason: g.cancelReason,
    members: Object.fromEntries(memberStatus.map((s) => [s.status, s._count._all])),
    payouts: payouts.map((p) => ({
      id: p.id,
      name: nameOf(p.membership),
      round: p.round,
      cycleNo: p.cycleNo,
      status: p.status,
      netKobo: num(p.netKobo),
      preparedAt: p.preparedAt,
      paidAt: p.paidAt,
      voidReason: p.voidReason,
    })),
    cases: cases.map((c) => ({ id: c.id, name: nameOf(c.membership), status: c.status, outstandingKobo: num(c.outstandingKobo), openedAt: c.openedAt })),
    tier: {
      current: held
        ? { addonId: held.addonId, code: held.code, name: held.name, endsAt: held.endsAt, paid: held.amountPaidKobo > 0, pendingAddonId: held.pendingAddonId, contributorLimit: held.contributorLimit }
        : null,
      activeContributors,
      overLimit: isOverLimit(held?.contributorLimit, activeContributors),
      options: options
        .filter((o) => !NOT_A_TARGET.has(o.code))
        .map((o) => ({ addonId: o.addonId, code: o.code, name: o.name, priceMonthlyKobo: o.priceMonthlyKobo, priceAnnualKobo: o.priceAnnualKobo, contributorLimit: o.contributorLimit })),
    },
    levy,
  };
}

async function associationOfGroup(groupId: number): Promise<number> {
  const g = await prisma.ajoGroup.findUnique({ where: { id: groupId }, select: { associationId: true } });
  if (!g) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  return g.associationId;
}

export async function previewGroupTier(input: { groupId: number; targetAddonId: number }) {
  const associationId = await associationOfGroup(input.groupId);
  if ((await listTierOptions(AJO_FAMILY)).some((o) => o.addonId === input.targetAddonId && NOT_A_TARGET.has(o.code))) {
    throw new RuleError('Groups are not moved to the trial tier.', 400, 'TIER_NOT_ALLOWED');
  }
  const r = await previewTierChange({ associationId, family: AJO_FAMILY, targetAddonId: input.targetAddonId, activeContributors: (db) => countActiveContributors(associationId, db) });
  return { direction: r.decision.direction, timing: r.decision.timing, blockers: r.decision.blockers, effectiveAt: r.effectiveAt, from: r.current?.name ?? null, to: r.target.name };
}

export async function changeGroupTier(input: { groupId: number; targetAddonId: number; reason: string; actor: Actor }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_OVERRIDE_REASON) throw new RuleError(`Give a reason of at least ${MIN_OVERRIDE_REASON} characters.`, 400, 'REASON_REQUIRED');
  const associationId = await associationOfGroup(input.groupId);
  const options = await listTierOptions(AJO_FAMILY);
  if (options.some((o) => o.addonId === input.targetAddonId && NOT_A_TARGET.has(o.code))) {
    throw new RuleError('Groups are not moved to the trial tier.', 400, 'TIER_NOT_ALLOWED');
  }
  return changeTier({ associationId, family: AJO_FAMILY, targetAddonId: input.targetAddonId, activeContributors: (db) => countActiveContributors(associationId, db), reason, actor: input.actor });
}

/**
 * Staff void of a payout that has not been recorded as paid (a prepared or approved one). A payout already recorded as paid is never
 * touched here: that is the group admin's reversal, because the money has moved.
 */
export async function voidPayoutAsStaff(input: { payoutId: number; reason: string; actor: Actor }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_OVERRIDE_REASON) throw new RuleError(`Give a reason of at least ${MIN_OVERRIDE_REASON} characters.`, 400, 'REASON_REQUIRED');
  const payout = await prisma.ajoPayout.findUnique({ where: { id: input.payoutId }, select: { id: true, associationId: true, groupId: true, status: true, netKobo: true } });
  if (!payout) throw new RuleError('That payout was not found.', 404, 'PAYOUT_NOT_FOUND');
  const result = await voidPayout({ associationId: payout.associationId, payoutId: payout.id, actorUserId: input.actor.id, actorIsAdmin: true, reason: `Cancelled by SocietyLedger staff: ${reason}` });
  if (!result.replayed) {
    await prisma.platformActionLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        actionType: 'AJO_PAYOUT_VOIDED_BY_STAFF',
        targetType: 'ajo_payout',
        targetId: payout.id,
        associationId: payout.associationId,
        beforeState: { status: payout.status, netKobo: Number(payout.netKobo), groupId: payout.groupId },
        afterState: { status: 'VOID' },
        reason,
        ipAddress: input.actor.ipAddress,
        userAgent: input.actor.userAgent,
      },
    });
  }
  return { replayed: result.replayed };
}

/**
 * Suspend or reactivate the owner of a group (an association or a standalone thrift group). Suspension belongs to the owner, so this
 * applies to all of its circles; it uses the platform's one suspend path, which blocks access, keeps the data and writes the Action log.
 */
export async function setOwnerSuspended(input: { groupId: number; suspend: boolean; reason: string; actor: Actor }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_OVERRIDE_REASON) throw new RuleError(`Give a reason of at least ${MIN_OVERRIDE_REASON} characters.`, 400, 'REASON_REQUIRED');
  const associationId = await associationOfGroup(input.groupId);
  try {
    if (input.suspend) await TenantManagementService.suspend(associationId, input.actor.id, { reason, notifyUsers: false });
    else await TenantManagementService.reactivate(associationId, input.actor.id, reason);
  } catch (error) {
    // The service speaks in plain sentences ("Association is already suspended"); pass them on as a refusal, not a server error.
    throw new RuleError(error instanceof Error ? error.message : 'Could not change the status.', 409, 'OWNER_STATUS_UNCHANGED');
  }
  return { suspended: input.suspend };
}
